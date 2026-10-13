import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getRecentWeekOptions, getWeekDetail } from '@/lib/supabase/queries/weekly'
import { generateStructured, recordRun, type RunTrigger } from '../client'

// 마케팅 AI — 주제를 받아 인스타그램·네이버 블로그 초안을 씀 (자동 게시 없음, 점장 승인 후 직접 게시)
// 주제 출처: 점장이 직접 입력(manual) / 경영 AI가 넘긴 이번 주 주제(auto)
// 매장 말투: 아래 소개 문구 + 최근 승인·게시한 글을 예시로 참고

// 매장 인스타(@some_one_basil) 프로필 소개 기준 — 바뀌면 여기 수정
const STORE_FACTS = `- 카페 이름: 썸바실 (인스타그램 @some_one_basil)
- 커피: 엄격한 기준으로 고른 하이엔드급 원두, 첫 모금부터 깊고 진한 풍미
- 말차: 일본 교토와 시즈오카에서 공수한 세레모니얼 말차`

const OutputSchema = z.object({
  instagram: z.object({
    body: z.string().describe('인스타그램 본문. 5~8줄, 줄바꿈 사용. 이모지는 1~2개만'),
    hashtags: z.string().describe('해시태그 5~8개, 공백으로 구분 (예: #썸바실 #말차라떼)'),
  }),
  blog: z.object({
    title: z.string().describe('네이버 블로그 제목'),
    body: z.string().describe('네이버 블로그 본문. 소제목 2~3개, 문단 나눔. 600~1000자'),
  }),
})

const SYSTEM = `당신은 카페 "썸바실"의 마케팅 담당 AI입니다. 점장이 인스타그램과 네이버 블로그에 올릴 글 초안을 씁니다. 점장이 읽고 고친 뒤 직접 올립니다.

매장 정보 (이 사실만 사용):
${STORE_FACTS}

쓰는 원칙:
- 광고처럼 과장하지 않고, 동네 카페 사장이 직접 쓴 듯한 담백한 말투로 씁니다.
- 매장 정보와 아래 판매 데이터에 없는 사실(가격, 재료, 원산지, 수상 경력, 영업시간 등)은 지어내지 않습니다.
- 할인·이벤트·증정은 주제에 명시된 경우에만 씁니다. 내용이 정해지지 않았으면 "[이벤트 내용]"처럼 대괄호 칸으로 비워 둡니다.
- 판매 데이터의 숫자(판매량, 매출)는 글에 그대로 쓰지 않습니다. "요즘 가장 많이 찾으시는" 정도로만 활용합니다.
- 예시 글이 주어지면 그 말투와 길이를 따릅니다.`

export type MarketingOutput = z.infer<typeof OutputSchema>

export async function runMarketingAgent(opts: { trigger: RunTrigger; source: 'auto' | 'manual'; topic: string }) {
  return recordRun('marketing', opts.trigger, async (runId) => {
    const supabase = createServerClient()
    const last = getRecentWeekOptions(2)[1]
    const [week, { data: examples }] = await Promise.all([
      getWeekDetail(last.weekStart, last.weekEnd),
      supabase
        .from('marketing_posts')
        .select('channel, title, body, hashtags')
        .in('status', ['approved', 'posted'])
        .order('approved_at', { ascending: false })
        .limit(4),
    ])

    const sales = {
      지난주상위메뉴: week.topProducts.slice(0, 10).map((p) => ({ 메뉴: p.product_name, 카테고리: p.category, 수량: p.quantity })),
      카테고리비중: week.categoryMix.map((c) => ({ category: c.category, 비중: Math.round(c.pct * 10) / 10 })),
    }
    const exampleText = (examples ?? []).length
      ? `\n\n참고할 예전 글 (말투·길이를 따라 주세요):\n${(examples ?? [])
          .map((e) => `[${e.channel === 'instagram' ? '인스타' : '블로그'}] ${e.title ? e.title + '\n' : ''}${e.body}${e.hashtags ? '\n' + e.hashtags : ''}`)
          .join('\n---\n')}`
      : ''

    const { output, model, usage } = await generateStructured({
      system: SYSTEM,
      user: `주제: ${opts.topic}\n\n판매 데이터 (참고용, 숫자를 글에 쓰지 말 것): ${JSON.stringify(sales)}${exampleText}`,
      schema: OutputSchema,
      name: 'marketing_drafts',
    })

    const { data: posts, error } = await supabase
      .from('marketing_posts')
      .insert([
        { run_id: runId, source: opts.source, topic: opts.topic, channel: 'instagram', body: output.instagram.body, hashtags: output.instagram.hashtags },
        { run_id: runId, source: opts.source, topic: opts.topic, channel: 'blog', title: output.blog.title, body: output.blog.body },
      ])
      .select('id')
    if (error) throw error

    // 자동 초안은 업무함에도 알림
    if (opts.source === 'auto') {
      await supabase.from('ai_inbox').insert({
        run_id: runId,
        agent: 'marketing',
        kind: 'draft',
        severity: 'info',
        title: `이번 주 게시글 초안: ${opts.topic}`,
        body: '경영 AI가 찾은 내용으로 인스타그램·블로그 초안을 썼어요. 읽고 고친 뒤 승인하면 복사해서 올릴 수 있어요.',
        action: '마케팅 화면에서 초안 확인 → 수정 → 승인',
        link: '/marketing',
      })
    }

    return {
      summary: `"${opts.topic}" 인스타·블로그 초안 ${posts?.length ?? 0}개`,
      output,
      usage,
      model,
    }
  })
}
