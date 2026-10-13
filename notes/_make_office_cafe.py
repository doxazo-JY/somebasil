# 썸바실 사무실 카페 소품 픽셀 그림 (Pixel Agents 톤에 맞춤, 직접 그림)
import sys
from PIL import Image, ImageDraw
out = sys.argv[1]
OL = (59, 42, 30, 255)

def save(im, name):
    im.save(f'{out}/{name}.png')

# 카운터 48x32 (발자국 3x2) — 윗면 + 앞판 패널
im = Image.new('RGBA', (48, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rectangle([0, 8, 47, 31], fill=OL)
d.rectangle([1, 9, 46, 15], fill=(214, 176, 122, 255))      # 윗면
d.line([1, 9, 46, 9], fill=(232, 202, 152, 255))            # 윗면 하이라이트
d.line([1, 16, 46, 16], fill=OL)
d.rectangle([1, 17, 46, 29], fill=(138, 92, 56, 255))       # 앞판
for x in (1, 16, 31):
    d.rectangle([x + 2, 19, x + 13, 27], outline=(110, 70, 42, 255))  # 패널
    d.line([x + 3, 20, x + 12, 20], fill=(158, 110, 70, 255))
d.rectangle([1, 30, 46, 30], fill=(80, 52, 32, 255))
save(im, 'COUNTER')

# 에스프레소 머신 16x20
im = Image.new('RGBA', (16, 20), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rectangle([1, 3, 14, 18], fill=OL)
d.rectangle([2, 4, 13, 17], fill=(186, 190, 198, 255))
d.rectangle([2, 4, 13, 6], fill=(150, 154, 164, 255))       # 윗판
d.rectangle([3, 1, 5, 3], fill=(240, 240, 236, 255), outline=OL)  # 위에 컵
d.rectangle([10, 1, 12, 3], fill=(240, 240, 236, 255), outline=OL)
d.rectangle([4, 8, 11, 10], fill=(70, 72, 80, 255))         # 그룹헤드
d.point((12, 7), fill=(220, 60, 50, 255))                    # 전원 불
d.rectangle([5, 11, 6, 13], fill=(70, 72, 80, 255)); d.rectangle([9, 11, 10, 13], fill=(70, 72, 80, 255))
d.rectangle([5, 14, 10, 16], fill=(240, 240, 236, 255), outline=OL)  # 잔
d.line([2, 17, 13, 17], fill=(120, 124, 132, 255))
save(im, 'ESPRESSO')

# 케이크 진열장 16x16
im = Image.new('RGBA', (16, 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rectangle([0, 2, 15, 15], fill=OL)
d.rectangle([1, 3, 14, 12], fill=(214, 236, 240, 255))      # 유리
d.line([2, 4, 5, 4], fill=(250, 255, 255, 255))
d.rectangle([2, 8, 5, 11], fill=(236, 170, 186, 255)); d.line([2, 8, 5, 8], fill=(255, 236, 240, 255))   # 딸기 케이크
d.rectangle([7, 9, 9, 11], fill=(156, 104, 64, 255)); d.point((8, 8), fill=(196, 60, 60, 255))          # 초코
d.rectangle([11, 8, 13, 11], fill=(240, 214, 140, 255)); d.line([11, 8, 13, 8], fill=(126, 170, 90, 255))  # 바질 마들렌
d.rectangle([1, 13, 14, 14], fill=(138, 92, 56, 255))
save(im, 'CAKE_CASE')

# 메뉴판(칠판) 32x24 — 벽에 거는 것
im = Image.new('RGBA', (32, 24), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rectangle([0, 0, 31, 21], fill=OL)
d.rectangle([1, 1, 30, 20], fill=(138, 92, 56, 255))
d.rectangle([3, 3, 28, 18], fill=(46, 62, 52, 255))
chalk = (232, 236, 226, 255)
d.line([6, 5, 25, 5], fill=chalk)                            # 제목
for y in (9, 12, 15):
    d.line([6, y, 17, y], fill=(200, 206, 196, 255)); d.line([22, y, 25, y], fill=(240, 214, 140, 255))
d.point((5, 9), fill=(126, 190, 110, 255)); d.point((5, 12), fill=(126, 190, 110, 255)); d.point((5, 15), fill=(126, 190, 110, 255))
d.line([14, 21, 14, 23], fill=OL); d.line([17, 21, 17, 23], fill=OL)
save(im, 'MENU_BOARD')
print('ok')

# 안내 데스크 80x32 (발자국 5x2) — 책상 그림과 같은 높이(윗면 11px~), 앞판은 바질 초록
im = Image.new('RGBA', (80, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rectangle([3, 27, 76, 31], fill=(0, 0, 0, 51))                   # 그림자
d.rectangle([2, 11, 77, 26], fill=(83, 46, 61, 255))               # 외곽선
d.rectangle([3, 12, 76, 19], fill=(179, 136, 87, 255))             # 윗면
d.line([3, 12, 76, 12], fill=(207, 168, 109, 255))
d.line([3, 20, 76, 20], fill=(136, 92, 71, 255))
d.rectangle([3, 21, 76, 25], fill=(88, 128, 86, 255))              # 앞판 (바질 초록)
d.line([3, 21, 76, 21], fill=(122, 160, 112, 255))
for x in range(10, 76, 12):
    d.line([x, 22, x, 25], fill=(70, 104, 70, 255))
save(im, 'RECEPTION')
