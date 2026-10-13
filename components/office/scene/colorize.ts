// 회색조 바닥·벽 그림에 색 입히기 (Photoshop "색상화" 방식)
// Pixel Agents(MIT, Copyright (c) 2026 Pablo De Lucca)의 colorizeSprite 공식을 캔버스용으로 옮김 — public/office/CREDITS.md
//   1) 픽셀 밝기(지각 휘도) → 2) 대비 c → 3) 밝기 b → 4) 지정 색상 h·채도 s로 HSL 색 생성

export type TileColor = { h: number; s: number; b: number; c: number }

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = l - c / 2
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

// 이미지(또는 그 일부)를 색 입힌 캔버스로
export function colorize(img: CanvasImageSource & { width: number; height: number }, color: TileColor): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = img.width
  cv.height = img.height
  const g = cv.getContext('2d')!
  g.drawImage(img, 0, 0)
  const data = g.getImageData(0, 0, cv.width, cv.height)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue
    let l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255
    if (color.c !== 0) l = 0.5 + (l - 0.5) * ((100 + color.c) / 100)
    if (color.b !== 0) l += color.b / 200
    l = Math.max(0, Math.min(1, l))
    const [r, gg, b] = hslToRgb(color.h, color.s / 100, l)
    px[i] = r
    px[i + 1] = gg
    px[i + 2] = b
  }
  g.putImageData(data, 0, 0)
  return cv
}
