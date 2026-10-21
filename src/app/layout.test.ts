import { describe, it, expect } from 'vitest'
import { settle, screenRows, ROWS } from './layout'

const base = [
  { i: 'reference', x: 0, y: 0, w: 2, h: 48 }, { i: 'scripture', x: 2, y: 0, w: 4, h: 48 },
  { i: 'screen', x: 6, y: 0, w: 3, h: 20 }, { i: 'related', x: 6, y: 20, w: 3, h: 28 },
  { i: 'suggest', x: 9, y: 0, w: 3, h: 20 }, { i: 'find', x: 9, y: 20, w: 3, h: 12 },
  { i: 'heard', x: 9, y: 32, w: 3, h: 8 }, { i: 'history', x: 9, y: 40, w: 3, h: 8 }
]
const check = (out: ReturnType<typeof settle>) => {
  for (const a of out) {
    expect(a.y + a.h).toBeLessThanOrEqual(ROWS)
    for (const b of out) if (a !== b) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false)
  }
}
describe('settle', () => {
  it('keeps the default tidy and sizes Screen to 16:9', () => {
    const out = settle(base, 12, 120, 12)
    check(out)
    expect(out.find((x) => x.i === 'screen')!.h).toBe(screenRows(3, 120, 12))
    expect(out.find((x) => x.i === 'related')!.y).toBe(out.find((x) => x.i === 'screen')!.h) // Related moves up under it
  })
  it('a widget dropped on top of others snaps in without overlap or overflow', () => {
    const moved = base.map((x) => (x.i === 'screen' ? { ...x, x: 0, y: 10, w: 6 } : x))
    check(settle(moved, 12, 120, 12))
  })
  it('a widget dragged far down stays inside the window', () => {
    const moved = base.map((x) => (x.i === 'find' ? { ...x, y: 60, h: 30 } : x))
    check(settle(moved, 12, 120, 12))
  })
})

describe('a short window (1920x1080 at 150%: 1280x720 to work with)', () => {
  // 1280 wide, about 660 tall for the stage: 12 columns of ~99px, 48 rows of ~5.6px.
  const colW = (1280 - 16 - 11 * 8) / 12, rowH = (660 - 16 - 47 * 8) / 48
  it('a very wide Screen gets narrower instead of crushing its neighbours', () => {
    const wide = base.map((x) => (x.i === 'screen' ? { ...x, x: 2, w: 8 } : x.i === 'scripture' ? { ...x, h: 2 } : x))
    const out = settle(wide, 12, colW, rowH)
    check(out)
    const screen = out.find((x) => x.i === 'screen')!
    expect(screen.h).toBeLessThanOrEqual(Math.floor(ROWS * 0.6))
    for (const it of out) if (it.i !== 'screen') expect(it.h).toBeGreaterThanOrEqual(3)
  })
})
