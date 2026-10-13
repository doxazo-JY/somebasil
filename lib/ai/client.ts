import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

// AI 업무팀 공통 — AI 호출 + 실행 기록(ai_runs). 서버 전용
//
// 어느 AI를 쓸지: 환경변수 AI_PROVIDER = 'openai' | 'anthropic'
//   미설정이면 키가 있는 쪽 (둘 다 있으면 anthropic)
//   - anthropic: ANTHROPIC_API_KEY, 모델 Claude Opus 5.5
//   - openai:    OPENAI_API_KEY + OPENAI_MODEL (키로 쓸 수 있는 모델 이름)
// 에이전트는 generateStructured()만 쓰므로 AI를 바꿔도 에이전트 코드는 그대로

export const ANTHROPIC_MODEL = 'claude-opus-5-5'

type Provider = 'anthropic' | 'openai'

export function aiProvider(): Provider | null {
  const forced = process.env.AI_PROVIDER
  if (forced === 'anthropic' || forced === 'openai') return forced
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return null
}

// 실행 가능한 상태인지 (업무함 버튼 활성화용) — 없으면 이유
export function aiConfigProblem(): string | null {
  const p = aiProvider()
  if (!p) return 'AI 키가 설정되지 않았어요 (OPENAI_API_KEY 또는 ANTHROPIC_API_KEY)'
  if (p === 'anthropic' && !process.env.ANTHROPIC_API_KEY) return 'ANTHROPIC_API_KEY가 설정되지 않았어요'
  if (p === 'openai' && !process.env.OPENAI_API_KEY) return 'OPENAI_API_KEY가 설정되지 않았어요'
  if (p === 'openai' && !process.env.OPENAI_MODEL) return 'OPENAI_MODEL(사용할 모델 이름)이 설정되지 않았어요'
  return null
}

let anthropicClient: Anthropic | null = null
let openaiClient: OpenAI | null = null

type StructuredResult<T> = { output: T; model: string; usage: { input_tokens: number; output_tokens: number } }

// 시스템 지시 + 사용자 메시지 → 스키마에 맞는 JSON 결과
export async function generateStructured<S extends z.ZodType>(opts: {
  system: string
  user: string
  schema: S
  name: string // 결과 형식 이름 (영문 snake_case)
}): Promise<StructuredResult<z.infer<S>>> {
  const problem = aiConfigProblem()
  if (problem) throw new Error(problem)

  if (aiProvider() === 'openai') {
    openaiClient ??= new OpenAI()
    const completion = await openaiClient.chat.completions.parse({
      model: process.env.OPENAI_MODEL!,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      response_format: zodResponseFormat(opts.schema, opts.name),
    })
    const message = completion.choices[0]?.message
    if (message?.refusal) throw new Error(`AI가 요청을 거절했습니다: ${message.refusal}`)
    if (!message?.parsed) throw new Error(`AI 결과를 읽지 못했습니다 (finish_reason: ${completion.choices[0]?.finish_reason})`)
    return {
      output: message.parsed as z.infer<S>,
      model: completion.model,
      usage: { input_tokens: completion.usage?.prompt_tokens ?? 0, output_tokens: completion.usage?.completion_tokens ?? 0 },
    }
  }

  anthropicClient ??= new Anthropic()
  const response = await anthropicClient.beta.messages.parse({
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    // 안전 분류기가 거절하면 서버가 권장 모델로 자동 재시도
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: betaZodOutputFormat(opts.schema) },
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  })
  if (response.stop_reason === 'refusal') throw new Error('AI가 요청을 거절했습니다 (refusal)')
  if (!response.parsed_output) throw new Error(`AI 결과를 읽지 못했습니다 (stop_reason: ${response.stop_reason})`)
  return {
    output: response.parsed_output as z.infer<S>,
    model: response.model,
    usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  }
}

// ─────────────────────────────────────────────
// 도구 쓰는 대화 (비서 AI) — AI가 필요한 조회 도구를 골라 부르고, 결과를 보고 답함
// 도구는 모두 조회 전용. 최대 MAX_TOOL_ROUNDS번 왕복
// ─────────────────────────────────────────────

export type AiTool = {
  name: string
  description: string
  schema: z.ZodObject<z.ZodRawShape>
  run: (input: Record<string, unknown>) => Promise<unknown>
}

type ChatTurn = { role: 'user' | 'assistant'; content: string }

const MAX_TOOL_ROUNDS = 6
const MAX_TOOL_RESULT_CHARS = 20000

function toolJsonSchema(schema: z.ZodObject<z.ZodRawShape>) {
  const { $schema, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>
  void $schema
  return rest
}

async function callTool(tools: AiTool[], name: string, rawInput: unknown) {
  const tool = tools.find((t) => t.name === name)
  if (!tool) return { error: `없는 도구: ${name}` }
  const parsed = tool.schema.safeParse(rawInput)
  if (!parsed.success) return { error: `입력이 올바르지 않음: ${parsed.error.message}` }
  try {
    return await tool.run(parsed.data)
  } catch (err) {
    return { error: err instanceof Error ? err.message : '조회 실패' }
  }
}

const stringifyResult = (v: unknown) => JSON.stringify(v).slice(0, MAX_TOOL_RESULT_CHARS)

export async function runToolChat(opts: { system: string; turns: ChatTurn[]; tools: AiTool[] }): Promise<{
  text: string
  toolsUsed: string[]
  model: string
  usage: { input_tokens: number; output_tokens: number }
}> {
  const problem = aiConfigProblem()
  if (problem) throw new Error(problem)
  const toolsUsed: string[] = []
  const usage = { input_tokens: 0, output_tokens: 0 }

  if (aiProvider() === 'openai') {
    // 추론 모델의 도구 호출은 Responses API만 지원 (Chat Completions는 400)
    // store:false — OpenAI 쪽에 대화를 남기지 않음. 대신 추론 내용을 암호화된 형태로 받아 다음 왕복에 그대로 돌려줌
    openaiClient ??= new OpenAI()
    const input: OpenAI.Responses.ResponseInputItem[] = opts.turns.map((t) => ({ role: t.role, content: t.content }))
    const tools: OpenAI.Responses.FunctionTool[] = opts.tools.map((t) => ({
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: toolJsonSchema(t.schema),
      strict: false,
    }))
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await openaiClient.responses.create({
        model: process.env.OPENAI_MODEL!,
        instructions: opts.system,
        input,
        tools,
        store: false,
        include: ['reasoning.encrypted_content'],
        ...(round === MAX_TOOL_ROUNDS ? { tool_choice: 'none' as const } : {}),
      })
      usage.input_tokens += response.usage?.input_tokens ?? 0
      usage.output_tokens += response.usage?.output_tokens ?? 0
      const calls = response.output.filter((o): o is OpenAI.Responses.ResponseFunctionToolCall => o.type === 'function_call')
      if (calls.length === 0) return { text: response.output_text ?? '', toolsUsed, model: response.model, usage }
      // 추론·도구 호출 항목을 그대로 이어 붙인 뒤 결과 추가
      input.push(...(response.output as OpenAI.Responses.ResponseInputItem[]))
      for (const call of calls) {
        toolsUsed.push(call.name)
        let args: unknown = {}
        try {
          args = JSON.parse(call.arguments || '{}')
        } catch {
          args = {}
        }
        const result = await callTool(opts.tools, call.name, args)
        input.push({ type: 'function_call_output', call_id: call.call_id, output: stringifyResult(result) })
      }
    }
    throw new Error('조회를 너무 많이 반복해서 멈췄습니다')
  }

  anthropicClient ??= new Anthropic()
  const messages: Anthropic.Beta.BetaMessageParam[] = opts.turns.map((t) => ({ role: t.role, content: t.content }))
  const tools: Anthropic.Beta.BetaTool[] = opts.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: toolJsonSchema(t.schema) as Anthropic.Beta.BetaTool['input_schema'],
  }))
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await anthropicClient.beta.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: opts.system,
      messages,
      tools,
      ...(round === MAX_TOOL_ROUNDS ? { tool_choice: { type: 'none' as const } } : {}),
    })
    usage.input_tokens += response.usage.input_tokens
    usage.output_tokens += response.usage.output_tokens
    if (response.stop_reason === 'refusal') throw new Error('AI가 요청을 거절했습니다 (refusal)')
    const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    if (response.stop_reason !== 'tool_use' || calls.length === 0) {
      const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('\n')
      return { text, toolsUsed, model: response.model, usage }
    }
    // 생각 블록 포함 응답 전체를 그대로 이어 붙임
    messages.push({ role: 'assistant', content: response.content })
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const call of calls) {
      toolsUsed.push(call.name)
      const result = await callTool(opts.tools, call.name, call.input)
      results.push({ type: 'tool_result', tool_use_id: call.id, content: stringifyResult(result) })
    }
    messages.push({ role: 'user', content: results })
  }
  throw new Error('조회를 너무 많이 반복해서 멈췄습니다')
}

export type AgentKey = 'business' | 'marketing' | 'attendance' | 'cashflow' | 'assistant'

export const AGENT_LABEL: Record<AgentKey, string> = {
  business: '경영 AI',
  marketing: '마케팅 AI',
  attendance: '직원 관리 AI',
  cashflow: '자금 관리 AI',
  assistant: '비서 AI',
}

export type RunTrigger = 'schedule' | 'manual'

type RunResult<T> = {
  summary: string
  output: T
  period?: string | null
  usage?: { input_tokens: number; output_tokens: number } | null
  model?: string | null
}

// 실행 1회를 ai_runs에 기록하며 감쌈 — 실패해도 기록이 남음
export async function recordRun<T>(agent: AgentKey, trigger: RunTrigger, work: (runId: number) => Promise<RunResult<T>>) {
  const supabase = createServerClient()
  const { data: run, error } = await supabase
    .from('ai_runs')
    .insert({ agent, trigger, status: 'running' })
    .select('id')
    .single()
  if (error) throw error

  try {
    const result = await work(run.id)
    await supabase
      .from('ai_runs')
      .update({
        status: 'succeeded',
        summary: result.summary,
        output: result.output,
        period: result.period ?? null,
        model: result.model ?? null,
        input_tokens: result.usage?.input_tokens ?? null,
        output_tokens: result.usage?.output_tokens ?? null,
        finished_at: new Date().toISOString(),
      })
      .eq('id', run.id)
    return { runId: run.id as number, ...result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('ai_runs')
      .update({ status: 'failed', error: message.slice(0, 1000), finished_at: new Date().toISOString() })
      .eq('id', run.id)
    throw err
  }
}
