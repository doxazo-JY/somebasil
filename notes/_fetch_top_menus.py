"""최근 N개월 매출 상위 메뉴 추출 — 점장이 우선 채울 메뉴 안내용.

매출 비중 누적 80% 도달까지의 메뉴 = 회수율/마진 분해 활성화의 키.
"""
import urllib.request, json, os, sys, pathlib, re
from collections import defaultdict

env_path = pathlib.Path(__file__).parent.parent / '.env.local'
env = {}
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        m = re.match(r'^([A-Z_]+)=(.+)$', line.strip())
        if m:
            env[m.group(1)] = m.group(2)

URL = env.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
KEY = env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY') or os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
if not URL or not KEY:
    sys.exit('SUPABASE URL/KEY 미설정')
HEADERS = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}


def get(path):
    req = urllib.request.Request(f'{URL}{path}', headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


# 최근 3개월 (2026-02 ~ 2026-04) POS 데이터
# range로 페이지네이션 (1000-row 제한 회피)
all_rows = []
offset = 0
PAGE = 1000
while True:
    path = (
        '/rest/v1/daily_sales'
        '?select=product_name,quantity,amount,date,category'
        '&source=eq.pos'
        '&date=gte.2026-02-01'
        '&date=lte.2026-04-30'
        f'&offset={offset}&limit={PAGE}'
    )
    rows = get(path)
    if not rows:
        break
    all_rows.extend(rows)
    if len(rows) < PAGE:
        break
    offset += PAGE

print(f'총 {len(all_rows)} 라인 로드')

# product_name (그대로) × 합계 (HOT/ICE 분리)
agg = defaultdict(lambda: {'qty': 0, 'amount': 0, 'category': ''})
for r in all_rows:
    name = (r.get('product_name') or '').strip()
    if not name:
        continue
    a = agg[name]
    a['qty'] += r.get('quantity') or 0
    a['amount'] += r.get('amount') or 0
    if not a['category']:
        a['category'] = r.get('category') or ''

# 카테고리 'etc' (할인/사이즈업/디카페인변경 등) 제외 — 메뉴 아님
items = sorted(
    [(k, v) for k, v in agg.items() if v['category'] != 'etc'],
    key=lambda x: x[1]['amount'],
    reverse=True,
)

total_amount = sum(v['amount'] for _, v in items)
print(f'\n총 매출 (etc 제외): {total_amount:,}원\n')

# 누적 매출 비중 80% 도달까지
cum = 0
print(f'{"순위":>3} {"누적%":>6} {"메뉴":<30} {"카테고리":<8} {"잔수":>6} {"매출":>10}')
print('-' * 80)
for i, (name, v) in enumerate(items, 1):
    cum += v['amount']
    cum_ratio = cum / total_amount * 100
    print(f'{i:>3} {cum_ratio:>6.1f} {name:<30} {v["category"]:<8} {v["qty"]:>6} {v["amount"]:>10,}')
    if cum_ratio >= 80:
        print(f'\n→ 상위 {i}개 메뉴가 매출의 {cum_ratio:.1f}% 차지')
        # 80% 이후도 5개만 더
        for j in range(i, min(i + 5, len(items))):
            n2, v2 = items[j]
            cum += v2['amount']
            print(f'    (참고) {j+1} {n2:<30} {v2["amount"]:>10,}')
        break

# 정규화된 이름 기준 매출 (HOT/ICE 통합) — 점장 입력 단위와 일치
import re as _re
PAREN_RE = _re.compile(r'\s*\((?:HOT|ICE|H|I|핫|아이스)\)', flags=_re.IGNORECASE)
WORD_RE = _re.compile(r'(?:^|\s)(?:HOT|ICE|핫|아이스)(?=\s|$)', flags=_re.IGNORECASE)

def normalize(n):
    return WORD_RE.sub(' ', PAREN_RE.sub('', n)).strip()

agg2 = defaultdict(lambda: {'qty': 0, 'amount': 0, 'category': ''})
for k, v in agg.items():
    if v['category'] == 'etc':
        continue
    nk = normalize(k)
    a = agg2[nk]
    a['qty'] += v['qty']
    a['amount'] += v['amount']
    if not a['category']:
        a['category'] = v['category']

items2 = sorted(agg2.items(), key=lambda x: x[1]['amount'], reverse=True)
total2 = sum(v['amount'] for _, v in items2)
print(f'\n\n=== HOT/ICE 통합 (점장 레시피 입력 단위) ===')
print(f'{"순위":>3} {"누적%":>6} {"메뉴":<30} {"카테고리":<8} {"잔수":>6} {"매출":>10}')
print('-' * 80)
cum = 0
top80 = []
for i, (name, v) in enumerate(items2, 1):
    cum += v['amount']
    cum_ratio = cum / total2 * 100
    print(f'{i:>3} {cum_ratio:>6.1f} {name:<30} {v["category"]:<8} {v["qty"]:>6} {v["amount"]:>10,}')
    top80.append({
        'rank': i,
        'name': name,
        'category': v['category'],
        'qty': v['qty'],
        'amount': v['amount'],
        'cum_ratio': round(cum_ratio, 1),
    })
    if cum_ratio >= 80:
        print(f'\n→ 상위 {i}개 메뉴가 매출의 {cum_ratio:.1f}% 차지')
        break

# JSON 저장
out = pathlib.Path(__file__).parent / '_top_menus.json'
out.write_text(json.dumps(top80, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'\nsaved: {out}')
