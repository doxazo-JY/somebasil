'use client'

import { useEffect, useRef } from 'react'
import { colorize } from './colorize'
import { COLS, DESK_SIT_OFFSET, FLOOR, FURNITURE, LOUNGE_COLS, REST_SPOTS, ROWS, SEATS, TILE, WALL, WALL_ROW, buildWalkable } from './layout'

// AI 사무실 장면 — Pixel Agents 그림(public/office) 위에서 AI들이 실제 상태대로 움직임
//   mode 'type' : 자기 책상에서 타이핑 (실행 중)
//   mode 'read' : 자기 책상에서 읽기 (점장이 확인할 일이 있음)
//   mode 'rest' : 라운지에서 쉼 (가끔 다른 쉬는 자리로 이동)
//   vacant      : 입사 전 — 캐릭터 없음
// 이름표·상태·말풍선은 HTML로 캐릭터 머리 위를 따라다님 (글자 선명하게)

export type SceneAgent = {
  key: string
  name: string
  mode: 'type' | 'read' | 'rest'
  vacant?: boolean
  chip: { label: string; cls: string }
  items: number
  warn: boolean
}

type Dir = 'down' | 'up' | 'right' | 'left'
type Char = {
  key: string
  sheet: HTMLImageElement
  x: number // 발 기준 칸 좌표(소수)
  y: number
  path: { col: number; row: number }[]
  dir: Dir
  pose: 'walk' | 'stand' | 'sit-type' | 'sit-read'
  target: string // 현재 목표 (seat | rest:i)
  t: number // 애니메이션 시간
  restTimer: number // 다음 이동까지 남은 시간(초)
}

const WALK_SPEED = 3 // 칸/초
const SIT_OFFSET = 6 // 앉으면 6px 아래로 (Pixel Agents 값)
const FRAME_W = 16
const FRAME_H = 32
const DIR_ROW: Record<Dir, number> = { down: 0, up: 1, right: 2, left: 2 }
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── 이미지 로드 (한 번만)
const imageCache = new Map<string, Promise<HTMLImageElement>>()
function loadImage(src: string) {
  let p = imageCache.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
    imageCache.set(src, p)
  }
  return p
}

// ── 길찾기 (4방향 BFS)
function findPath(walk: boolean[][], from: { col: number; row: number }, to: { col: number; row: number }) {
  const key = (c: number, r: number) => r * COLS + c
  const prev = new Map<number, number>()
  const queue = [from]
  prev.set(key(from.col, from.row), -1)
  while (queue.length) {
    const cur = queue.shift()!
    if (cur.col === to.col && cur.row === to.row) break
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = cur.col + dc
      const r = cur.row + dr
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS || !walk[r][c] || prev.has(key(c, r))) continue
      prev.set(key(c, r), key(cur.col, cur.row))
      queue.push({ col: c, row: r })
    }
  }
  if (!prev.has(key(to.col, to.row))) return []
  const path: { col: number; row: number }[] = []
  for (let k = key(to.col, to.row); k !== key(from.col, from.row); k = prev.get(k)!) path.unshift({ col: k % COLS, row: Math.floor(k / COLS) })
  return path
}

export default function OfficeScene({ agents, selected, onSelect }: {
  agents: SceneAgent[]
  selected: string
  onSelect: (key: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  // 애니메이션 루프가 최신 값을 읽도록 ref로 전달 (렌더 후 갱신)
  const agentsRef = useRef(agents)
  const selectedRef = useRef(selected)
  useEffect(() => {
    agentsRef.current = agents
    selectedRef.current = selected
  }, [agents, selected])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let raf = 0
    let alive = true
    const walk = buildWalkable()
    const chars = new Map<string, Char>()
    const occupiedRest = () => new Set([...chars.values()].map((c) => c.target).filter((t) => t.startsWith('rest:')))

    const srcs = [FLOOR.lounge.src, FLOOR.office.src, WALL.src, ...new Set(FURNITURE.map((f) => f.src)), ...Object.values(SEATS).map((s) => s.char)]
    Promise.all(srcs.map(loadImage)).then((imgs) => {
      if (!alive) return
      const img = (src: string) => imgs[srcs.indexOf(src)]
      const floorLounge = colorize(img(FLOOR.lounge.src), FLOOR.lounge.color)
      const floorOffice = colorize(img(FLOOR.office.src), FLOOR.office.color)
      const wall = colorize(img(WALL.src), WALL.color)

      // 바닥·벽은 한 번 그려 두기
      const base = document.createElement('canvas')
      base.width = COLS * TILE
      base.height = ROWS * TILE
      const bg = base.getContext('2d')!
      for (let r = WALL_ROW + 1; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) bg.drawImage(c < LOUNGE_COLS ? floorLounge : floorOffice, c * TILE, r * TILE)
      }
      // 뒷벽: 1행 한 줄. 양 끝은 끝 조각, 가운데는 가로로 이어지는 조각 (비트마스크 E=2, W=8)
      for (let c = 0; c < COLS; c++) {
        const mask = (c < COLS - 1 ? 2 : 0) | (c > 0 ? 8 : 0)
        bg.drawImage(wall, (mask % 4) * 16, Math.floor(mask / 4) * 32, 16, 32, c * TILE, WALL_ROW * TILE + TILE - 32, 16, 32)
      }

      const furniture = FURNITURE.map((f) => {
        const im = img(f.src)
        const x = f.col * TILE + Math.round((f.fw * TILE - im.width) / 2)
        const y = (f.row + f.fh) * TILE - im.height + (f.dy ?? 0)
        return { im, x, y, zY: (f.row + f.fh) * TILE + (f.z ?? 0) * 0.5 - (f.onWall ? 1000 : 0) }
      })

      // ── 상태 → 목표
      const decide = (ch: Char, a: SceneAgent, dt: number) => {
        const seat = SEATS[a.key]
        let goal: { col: number; row: number } | null = null
        let goalKey = ch.target
        if (a.mode !== 'rest') {
          goal = seat
          goalKey = 'seat'
        } else if (!ch.target.startsWith('rest:') || (ch.path.length === 0 && (ch.restTimer -= dt) <= 0)) {
          // 쉬는 자리 고르기 (이미 다른 AI가 쓰는 자리는 피함)
          const taken = occupiedRest()
          const free = REST_SPOTS.map((s, i) => ({ s, i })).filter(({ i }) => !taken.has(`rest:${i}`) || ch.target === `rest:${i}`)
          const pick = free[Math.floor(Math.random() * free.length)] ?? { s: REST_SPOTS[0], i: 0 }
          goal = pick.s
          goalKey = `rest:${pick.i}`
          ch.restTimer = 20 + Math.random() * 40
        }
        if (goal && goalKey !== ch.target) {
          ch.target = goalKey
          ch.path = findPath(walk, { col: Math.round(ch.x), row: Math.round(ch.y) }, goal)
        }
      }

      const ensureChars = () => {
        for (const a of agentsRef.current) {
          if (a.vacant || chars.has(a.key)) continue
          const seat = SEATS[a.key]
          if (!seat) continue
          // 처음엔 이미 제자리에 있는 상태로 시작 (화면 열자마자 걸어 다니지 않게)
          const restIdx = [...chars.values()].filter((c) => c.target.startsWith('rest:')).length % REST_SPOTS.length
          const startAtSeat = a.mode !== 'rest'
          const spot = startAtSeat ? seat : REST_SPOTS[restIdx]
          chars.set(a.key, {
            key: a.key,
            sheet: img(seat.char),
            x: spot.col,
            y: spot.row,
            path: [],
            dir: startAtSeat ? 'down' : REST_SPOTS[restIdx].dir,
            pose: 'stand',
            target: startAtSeat ? 'seat' : `rest:${restIdx}`,
            t: Math.random() * 2,
            restTimer: 20 + Math.random() * 40,
          })
        }
        for (const k of [...chars.keys()]) if (!agentsRef.current.some((a) => a.key === k && !a.vacant)) chars.delete(k)
      }

      const ctx = canvas.getContext('2d')!
      let last = performance.now()

      const frame = (now: number) => {
        if (!alive) return
        const dt = Math.min(0.1, (now - last) / 1000)
        last = now
        ensureChars()
        const still = reducedMotion()

        for (const ch of chars.values()) {
          const a = agentsRef.current.find((x) => x.key === ch.key)!
          decide(ch, a, dt)
          ch.t += dt
          if (ch.path.length) {
            const next = ch.path[0]
            const dx = next.col - ch.x
            const dy = next.row - ch.y
            const dist = Math.hypot(dx, dy)
            const step = still ? dist : WALK_SPEED * dt
            ch.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
            if (dist <= step) {
              ch.x = next.col
              ch.y = next.row
              ch.path.shift()
            } else {
              ch.x += (dx / dist) * step
              ch.y += (dy / dist) * step
            }
            ch.pose = 'walk'
          } else if (ch.target === 'seat') {
            ch.dir = 'down'
            ch.pose = a.mode === 'type' ? 'sit-type' : 'sit-read'
          } else {
            const spot = REST_SPOTS[Number(ch.target.split(':')[1])]
            ch.dir = spot?.dir ?? 'down'
            ch.pose = spot?.sit ? 'sit-read' : 'stand'
          }
        }

        // ── 그리기 (원본 해상도 → 캔버스 배율)
        const scale = canvas.width / (COLS * TILE)
        ctx.setTransform(scale, 0, 0, scale, 0, 0)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(base, 0, 0)

        type Drawable = { zY: number; draw: () => void }
        const drawables: Drawable[] = furniture.map((f) => ({ zY: f.zY, draw: () => ctx.drawImage(f.im, f.x, f.y) }))

        for (const ch of chars.values()) {
          const sitting = ch.pose === 'sit-type' || ch.pose === 'sit-read'
          const sitOff = sitting ? (ch.target === 'seat' ? DESK_SIT_OFFSET : SIT_OFFSET) : 0
          const frameIdx =
            ch.pose === 'walk' ? [0, 1, 2, 1][Math.floor(ch.t / 0.15) % 4]
              : ch.pose === 'sit-type' ? (still ? 3 : 3 + (Math.floor(ch.t / 0.3) % 2))
                : ch.pose === 'sit-read' ? (still ? 5 : 5 + (Math.floor(ch.t / 1.2) % 2))
                  : 1
          const px = Math.round(ch.x * TILE)
          const py = Math.round((ch.y + 1) * TILE - FRAME_H + sitOff)
          const zY = (ch.y + 1) * TILE + 0.25
          const isSel = ch.key === selectedRef.current
          drawables.push({
            zY,
            draw: () => {
              // 발밑 그림자 (선택한 AI는 초록)
              ctx.fillStyle = isSel ? 'rgba(26,92,58,0.55)' : 'rgba(0,0,0,0.18)'
              if (ch.target !== 'seat' || !sitting) {
                ctx.beginPath()
                ctx.ellipse(px + 8, (ch.y + 1) * TILE - 2 + (sitting ? SIT_OFFSET - 4 : 0), 6, 2.5, 0, 0, Math.PI * 2)
                ctx.fill()
              }
              ctx.save()
              if (ch.dir === 'left') {
                ctx.translate(px + FRAME_W, py)
                ctx.scale(-1, 1)
                ctx.drawImage(ch.sheet, frameIdx * FRAME_W, DIR_ROW[ch.dir] * FRAME_H, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H)
              } else {
                ctx.drawImage(ch.sheet, frameIdx * FRAME_W, DIR_ROW[ch.dir] * FRAME_H, FRAME_W, FRAME_H, px, py, FRAME_W, FRAME_H)
              }
              ctx.restore()
            },
          })
        }
        drawables.sort((a, b) => a.zY - b.zY).forEach((d) => d.draw())

        // ── 이름표 위치 (캔버스 CSS 크기 기준)
        const cssScale = canvas.clientWidth / (COLS * TILE)
        for (const a of agentsRef.current) {
          const el = labelRefs.current[a.key]
          if (!el) continue
          const ch = chars.get(a.key)
          const seat = SEATS[a.key]
          const sitting = ch && (ch.pose === 'sit-type' || ch.pose === 'sit-read')
          const ax = ch ? ch.x * TILE + 8 : seat.col * TILE + 8
          const sitOff = sitting ? (ch.target === 'seat' ? DESK_SIT_OFFSET : SIT_OFFSET) : 0
          const ay = ch ? (ch.y + 1) * TILE - FRAME_H + sitOff - 4 : seat.row * TILE - 2
          // 가운데·아래 맞춤까지 정수 px로 — 소수 px 위치면 글자가 뿌옇게 보임
          const tx = Math.round(ax * cssScale - el.offsetWidth / 2)
          const ty = Math.round(ay * cssScale - el.offsetHeight)
          const t = `translate(${tx}px, ${ty}px)`
          if (el.style.transform !== t) el.style.transform = t
        }

        raf = requestAnimationFrame(frame)
      }
      frame(performance.now()) // 첫 장면은 바로 그림 (탭이 가려져 있어도)
    })

    // 캔버스 내부 해상도 = 화면 크기 × 기기 배율 (픽셀이 또렷하게)
    const resize = () => {
      const w = canvas.clientWidth * (window.devicePixelRatio || 1)
      const scale = Math.max(1, Math.round(w / (COLS * TILE)))
      canvas.width = COLS * TILE * scale
      canvas.height = ROWS * TILE * scale
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    // 클릭: 캐릭터 → 책상 영역 순서로
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * COLS * TILE
      const y = ((e.clientY - rect.top) / rect.height) * ROWS * TILE
      for (const ch of chars.values()) {
        const cx = ch.x * TILE
        const cy = (ch.y + 1) * TILE - FRAME_H
        if (x >= cx && x <= cx + FRAME_W && y >= cy && y <= cy + FRAME_H) return onSelect(ch.key)
      }
      for (const [key, s] of Object.entries(SEATS)) {
        const d = s.desk
        if (x >= d.col * TILE && x <= (d.col + d.w) * TILE && y >= d.row * TILE && y <= (d.row + d.h) * TILE) return onSelect(key)
      }
    }
    canvas.addEventListener('click', onClick)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('click', onClick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: `${COLS} / ${ROWS}` }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-pointer [image-rendering:pixelated]"
        role="img"
        aria-label="AI 사무실. 일하는 AI는 자기 책상에서 타이핑하고, 쉬는 AI는 왼쪽 카페 라운지에 있어요."
      />
      {agents.map((a) => (
        <button
          key={a.key}
          ref={(el) => {
            labelRefs.current[a.key] = el
          }}
          onClick={() => onSelect(a.key)}
          aria-pressed={a.key === selected}
          className="absolute left-0 top-0 flex flex-col items-center gap-0.5"
          style={{ transform: 'translate(-9999px, 0)' }}
        >
          {a.items > 0 && (
            <span className={`text-[10px] leading-none px-1.5 py-0.5 border whitespace-nowrap ${a.warn ? 'bg-[#fff1a8] border-[#9a5b00] text-[#6b4400]' : 'bg-white border-[#2a2a2a] text-[#2a2a2a]'}`}>
              챙길 일 {a.items}
            </span>
          )}
          <span
            className={`text-[10px] leading-none px-1.5 py-1 rounded-full whitespace-nowrap font-semibold shadow-sm ${
              a.key === selected ? 'bg-[#1a5c3a] text-white' : 'bg-white text-[#2a2a2a]'
            }`}
          >
            {a.name}
            <span className={`ml-1 font-medium ${a.key === selected ? 'text-white/80' : a.chip.cls}`}>· {a.chip.label}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
