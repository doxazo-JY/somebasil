import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { getRecentWeekOptions, getWeekDetail } from '@/lib/supabase/queries/weekly'
import { generateStructured, recordRun, type RunTrigger } from '../client'

// 마케팅 AI — 주제를 받아 인스타그램·네이버 블로그 초안을 씀 (자동 게시 없음, 점장 승인 후 직접 게시)
// 주제 출처: 점장이 직접 입력(manual) / 경영 AI가 넘긴 이번 주 주제(auto)
// 매장 말투: 아래 소개 문구 + 최근 승인·게시한 글을 예시로 참고

// 매장 인스타(@some_one_basil) 프로필 소개·게시글 기준 — 바뀌면 여기 수정
const STORE_FACTS = `- 카페 이름: 썸바실 (인스타그램 @some_one_basil), 인천 계양구
- 커피: 엄격한 기준으로 고른 하이엔드급 원두, 핸드드립, 디카페인
- 더치커피: 오랜 시간 디게싱한 예가체프 원두로 한 방울 한 방울 내림 (더치 원액·드립백도 판매)
- 말차: 일본 교토와 시즈오카에서 공수한 세레모니얼 말차
- 수제 메뉴: 수제 청(레몬·자몽·패션후르츠), 수제 바닐라 시럽으로 만든 리얼 바닐라빈 밀크, 딸기청 듬뿍 넣은 딸기라떼
- 베이커리: 수제 스콘, 마들렌, 베이글, 쿠키
- 아이 동반 모임(유치원 정모)도 많이 오는 매장`

// 실제 게시글 (2025.12 ~ 2026.5) — 승인한 글이 쌓이기 전에도 매장 말투로 쓰도록 항상 예시로 줌
// 가격·이벤트 내용은 그때 것이라 새 글에 그대로 쓰면 안 됨 (SYSTEM에 명시)
const SEED_EXAMPLES = [
  `가정의 달을 맞아 가족 및 친구 선생님 등 선물 할 일이 많은 요즘, 썸바실에서 합리적인 가격으로 구성한 선물세트를 판매합니다~!

1. 썸바실의 베스트셀러인 수제 청(레몬, 자몽, 패션후르츠) 280ml 3종! - 28,000원

2. 공들여 한 방울 한 방울 내린 더치 원액 250ml와 드립백 10개, 초코쿠키박스까지! - 28,000원

구매시 선물하시기 좋도록 예쁜 케이스에 포장해 드립니다~!!`,
  `지난 4개월간 썸바실에게 주신 사랑에 감사드리며 고객 감사 이벤트를 준비했습니다~!

첫번째, 썸모닝 이벤트!
오전 9시부터 11시까지 주문하시는 모든 분들께
인당 마들렌 1개를 서비스로 드립니다

두번째, 해피 런치 세트!!
오전 11시부터 오후 2시까지
플레인 베이글(크림치즈 3종 택1)+아메리카노가 7,000원!(정가 8,000원)`,
  `오랜 시간 디게싱한 예가체프 원두로 한 방울 한 방울 내린 더치커피 곧 시작합니다 👏`,
  `썸바실 카페
수제 바닐라 시럽으로 만든 리얼 바닐라빈 밀크와
딸기청 듬뿍 넣은 딸기라떼
#계양구커피맛집 #인천핸드드립신상카페`,
  `썸바실 인천 영업중입니다 :]
#수제스콘맛집`,
  `썸바실 디카페인 시작-
#썸바실 #디카페인맛집`,
]

const OutputSchema = z.object({
  instagram: z.object({
    body: z.string().describe('인스타그램 본문. 예시 글처럼 짧게: 소개 글은 1~3줄, 행사·이벤트는 번호 목록. 해시태그는 본문에 넣지 않음'),
    hashtags: z.string().describe('해시태그 2~5개, 공백으로 구분. 지역·특징 위주 (예: #계양구커피맛집 #인천핸드드립신상카페 #수제스콘맛집)'),
  }),
  blog: z.object({
    title: z.string().describe('네이버 블로그 제목 (검색되도록 "인천 계양구 카페" 같은 지역명 포함)'),
    body: z.string().describe('네이버 블로그 본문. 소제목 2개 정도, 400~700자. 같은 말을 반복하지 않음'),
  }),
})

const SYSTEM = `당신은 카페 "썸바실"의 마케팅 담당 AI입니다. 점장이 인스타그램과 네이버 블로그에 올릴 글 초안을 씁니다. 점장이 읽고 고친 뒤 직접 올립니다.

매장 정보 (이 사실만 사용):
${STORE_FACTS}

쓰는 원칙:
- 아래 "실제 게시글" 예시의 말투와 길이를 그대로 따릅니다. 짧고 밝게, "~합니다~!", "~시작합니다 👏", ":]" 같은 이 매장 특유의 끝맺음을 씁니다. 설명조로 길게 풀지 않습니다.
- 행사·이벤트·세트 글은 예시처럼 번호 목록(첫번째, 두번째 또는 1. 2.)으로 시간·구성을 정리합니다.
- 매장 정보와 판매 데이터에 없는 사실(가격, 재료, 원산지, 영업시간 등)은 지어내지 않습니다.
- 예시 글 속 가격·이벤트 내용은 지난 행사입니다. 새 글에 그대로 쓰지 않습니다.
- 할인·이벤트·증정은 주제에 명시된 경우에만 씁니다. 가격이나 내용이 정해지지 않았으면 "[가격]", "[이벤트 내용]"처럼 대괄호 칸으로 비워 둡니다.
- 판매 데이터의 숫자(판매량, 매출)는 글에 그대로 쓰지 않습니다. "요즘 많이 찾으시는" 정도로만 활용합니다.

실제 게시글 (말투 예시):
${SEED_EXAMPLES.map((e) => `---\n${e}`).join('\n')}`

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
      ? `\n\n점장이 최근 승인한 글 (가장 최근 말투 — 실제 게시글 예시보다 우선):\n${(examples ?? [])
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
