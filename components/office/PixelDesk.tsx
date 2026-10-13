'use client'

import { useEffect, useRef } from 'react'

// 픽셀 직원 + 책상 (24×20 논리 픽셀을 4배로) — 고정 팔레트 일러스트
const BODY = [
  '...HHHHHH...',
  '..HHHHHHHH..',
  '..HSSSSSSH..',
  '..SSESSESS..',
  '..SSSSSSSS..',
  '...SSRRSS...',
  '....SSSS....',
  '..CCCCCCCC..',
  '.CCCCCCCCCC.',
  '.CCCCCCCCCC.',
  '.SCCCCCCCCS.',
  '.SCCCCCCCCS.',
]

export default function PixelDesk({ shirt, hair, screenOn, vacant }: { shirt: string; hair: string; screenOn: boolean; vacant: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const g = ref.current?.getContext('2d')
    if (!g) return
    g.clearRect(0, 0, 24, 20)
    const px = (x: number, y: number, w: number, h: number, c: string) => {
      g.fillStyle = c
      g.fillRect(x, y, w, h)
    }
    // 의자 등받이
    px(3, 6, 12, 8, '#5b4636')
    px(4, 7, 10, 6, '#6e5644')
    // 직원
    if (!vacant) {
      const pal: Record<string, string> = { H: hair, S: '#f2c9a0', E: '#2b2b2b', R: '#d98b7a', C: shirt }
      BODY.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] !== '.') px(3 + x, 2 + y, 1, 1, pal[row[x]])
      })
    }
    // 모니터
    px(15, 6, 8, 6, '#3a3f44')
    px(16, 7, 6, 4, screenOn ? '#8fe3b0' : '#2d3a35')
    if (screenOn) {
      px(17, 8, 3, 1, '#3f9e6a')
      px(17, 9, 4, 1, '#3f9e6a')
    }
    px(18, 12, 2, 1, '#3a3f44')
    // 책상
    px(0, 13, 24, 1, '#c98f5a')
    px(0, 14, 24, 2, '#9a6a40')
    px(1, 16, 2, 4, '#7a5232')
    px(21, 16, 2, 4, '#7a5232')
    // 컵
    if (!vacant) px(11, 11, 2, 2, '#ffffff')
  }, [shirt, hair, screenOn, vacant])

  return (
    <canvas
      ref={ref}
      width={24}
      height={20}
      className={`w-24 h-20 [image-rendering:pixelated] ${vacant ? 'opacity-60' : ''}`}
      aria-hidden
    />
  )
}
