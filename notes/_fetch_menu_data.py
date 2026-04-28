"""활성 메뉴 + 카테고리 매핑을 뽑아서 JSON으로 저장.

실행 전 .env.local에서 SUPABASE 정보를 읽어옴 — 키를 코드에 하드코딩하지 말 것.
"""
import urllib.request, urllib.parse, json, os, sys, pathlib, re

# .env.local 파싱
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
    sys.exit('SUPABASE URL/KEY 미설정 — .env.local 확인')
HEADERS = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}

def get(path):
    req = urllib.request.Request(f'{URL}{path}', headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

# 1) 활성 메뉴
products = get('/rest/v1/products?select=id,name,price,is_active&is_active=eq.true&order=name')

# 2) daily_sales의 product_name × category 페어 (전체 기간) → 카테고리 매핑
sales = get('/rest/v1/daily_sales?select=product_name,category&source=eq.pos&limit=10000')
cat_map = {}
for s in sales:
    n = s.get('product_name')
    c = s.get('category')
    if n and c and n not in cat_map:
        cat_map[n] = c

# 카테고리 분포
from collections import Counter
cat_counts = Counter(cat_map.values())

OUT = r"C:\Users\admin\Desktop\지농\coding\somebasil\notes\_menu_data.json"
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump({
        'products': products,
        'category_by_name': cat_map,
        'category_counts': dict(cat_counts),
    }, f, ensure_ascii=False, indent=2)

print(f'활성 메뉴: {len(products)}개')
print(f'카테고리 분포: {dict(cat_counts)}')
print(f'saved: {OUT}')
