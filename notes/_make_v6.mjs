// v6 수정 — 점장 4/30 피드백 반영
//   1) 제조크림(수제재료) 추가 + 1배치 배합 (식물성480+동물성1500+설탕384=2364g)
//   2) 시트2 흑임자크림 "생크림" → "제조크림"
//   3) 시트3 "휘핑크림" → "제조크림" (바닐라슈페너, 아인슈페너)
//   4) 시트1 바닐라시럽: 매입 → 수제 (가격 칸 '-', 배합은 시트2에 ❓로)
//   5) 시트2 레몬청 비고 갱신: "마들렌 부산물 — 옵션A=원가0 처리 권장"
//   6) 시트3 카테고리 누락 행 채우기 (메뉴명 기반 자동 추정)

import XlsxPopulate from 'xlsx-populate';

const SRC = 'notes/레시피_템플릿_점장_26.04.29.xlsx';
const OUT = 'notes/레시피_템플릿_v6.xlsx';

// 시트3 카테고리 자동 추정 (메뉴명 패턴 기반)
const CATEGORY_MAP = {
  'TWG  레이디그레이티': 'tea',
  'TWG  페퍼민트티': 'tea',
  '교토 말차세트': 'matcha',
  '드립백 A': 'drip_coffee',
  '드립백 B': 'drip_coffee',
  '라우치병 주스(딸기)': 'beverage',
  '라우치병 주스(망고)': 'beverage',
  '라우치병 주스(오렌지)': 'beverage',
  '리얼바닐라빈 밀크': 'beverage',
  '순수 말차세트': 'matcha',
  '아인슈페너': 'coffee',
  '자몽티': 'tea',
  '잠봉뵈르&고메버터베이글샌드위치': 'dessert',
  '잠봉뵈르&루꼴라베이글샌드위치': 'dessert',
  '카라멜마끼아또': 'coffee',
  '카푸치노': 'coffee',
  '패션후르츠티': 'tea',
  '플레인베이글+아메리카노 세트': 'dessert',
  '핸드드립': 'drip_coffee',
  '흑임자슈페너': 'coffee',
};

const wb = await XlsxPopulate.fromFileAsync(SRC);

// ============= 시트1: 재료 =============
const s1 = wb.sheet('재료');

// (4) 바닐라시럽 — 행 7. 종류 매입 → 수제, 결제방식/용량/세트수/총가격을 '-'로, 단가 자리에 '(서브레시피 자동계산)'
s1.cell('C7').value('수제');
s1.cell('D7').value('-');
s1.cell('E7').value('-');
s1.cell('F7').value('-');
s1.cell('G7').value('-');
s1.cell('H7').value('(서브레시피 자동계산)');
s1.cell('J7').value('수제로 변경 (4/30 점장) — 시트2에 배합 입력 필요');

// (1) 제조크림 추가 — 시트1 마지막에. 자유추가 영역(83행)이 마커. 수제재료는 65~82.
// 기존 마지막 수제재료 행 = 82 (수제 호두파이). 마커 = 83. 그 위/아래 어디든 가능.
// 안전하게 마커 행 다음(84)부터 사용 — 마커 자체는 안 건드림
s1.cell('A84').value('제조크림');
s1.cell('B84').value('g');
s1.cell('C84').value('수제');
s1.cell('D84').value('-');
s1.cell('E84').value('-');
s1.cell('F84').value('-');
s1.cell('G84').value('-');
s1.cell('H84').value('(서브레시피 자동계산)');
s1.cell('J84').value('식물성480 + 동물성1500 + 설탕384 = 1배치 2364g (4/30 점장 정의)');

// ============= 시트2: 서브레시피 =============
const s2 = wb.sheet('서브레시피');

// (2) 흑임자크림 "생크림" (행 17) → "제조크림"
s2.cell('C17').value('제조크림');
// 1배치 80g 흑임자20+제조크림60 — 사용량은 그대로 60. 비고 추가
const oldNote17 = s2.cell('E17').value();
s2.cell('E17').value('생크림 → 제조크림 변경 (4/30)');

// (5) 레몬청 — 행 4-5. 비고에 처리방식 메모
s2.cell('E4').value('마들렌 부산물 — 옵션A: 원가0 처리 권장 (4/30 점장)');
s2.cell('E5').value('설탕만 추가 비용 — 점장 추정값 입력 가능');

// (4) 바닐라시럽 — 시트2에 신규 추가. 마지막 행 다음.
// 현재 마지막 데이터 행 = 43 (수제 호두파이 버터 ❓). 44 = 수제 호두파이 버터.
// 다시 확인: 마지막 = 행 44? 출력에서 44행이 마지막. 45부터 추가.
s2.cell('A45').value('바닐라시럽');
s2.cell('B45').value('❓');
s2.cell('C45').value('❓');
s2.cell('D45').value('❓');
s2.cell('E45').value('수제 변경 (4/30 점장) — 어떤 재료로 만드는지 추가 질문 필요');

// (1) 제조크림 1배치 배합 — 점장이 명확히 알려준 값
const proCreamRows = [
  { batch: 2364, ing: '식물성생크림', qty: 480, note: '480g (4/30 점장 정의)' },
  { batch: 2364, ing: '동물성생크림', qty: 1500, note: '500g × 3' },
  { batch: 2364, ing: '설탕', qty: 384, note: '192g × 2' },
];
proCreamRows.forEach((r, i) => {
  const row = 46 + i;
  s2.cell(`A${row}`).value('제조크림');
  s2.cell(`B${row}`).value(r.batch);
  s2.cell(`C${row}`).value(r.ing);
  s2.cell(`D${row}`).value(r.qty);
  s2.cell(`E${row}`).value(r.note);
});

// ============= 시트3: 레시피 =============
const s3 = wb.sheet('레시피');

// (3) 휘핑크림 → 제조크림 (재료명 컬럼 = C)
// (6) 카테고리 누락 채우기 (B 컬럼)
const usedRange = s3.usedRange();
const lastRow = usedRange.endCell().rowNumber();
for (let r = 2; r <= lastRow; r++) {
  const ing = s3.cell(`C${r}`).value();
  if (typeof ing === 'string' && ing.trim() === '휘핑크림') {
    s3.cell(`C${r}`).value('제조크림');
    const oldNote = s3.cell(`E${r}`).value();
    s3.cell(`E${r}`).value(`${oldNote || ''} / 휘핑크림→제조크림 (4/30)`.trim());
  }
  const cat = s3.cell(`B${r}`).value();
  const menu = s3.cell(`A${r}`).value();
  if ((cat === null || cat === undefined || String(cat).trim() === '') && CATEGORY_MAP[menu]) {
    s3.cell(`B${r}`).value(CATEGORY_MAP[menu]);
  }
}

await wb.toFileAsync(OUT);
console.log('saved:', OUT);
