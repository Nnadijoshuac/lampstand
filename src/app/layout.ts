/**
 * Widget layout. The grid is fine-grained (48 rows filling the window) so heights can follow content,
 * and every change is "settled": widgets fall up into free space, holes are filled by their neighbours,
 * nothing leaves the window, and the Screen widget is always exactly its header plus a 16:9 picture.
 */
export interface Item { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number; resizeHandles?: string[] }

export const ROWS = 48
export const MARGIN = 8
/** Header height of a widget, in pixels (see .w-head). */
const HEADER_PX = 31
/** No widget gets shorter than this many rows: its header and a little content. */
const MIN_H = 6

/** Rows the Screen widget needs to show a 16:9 picture at its width. */
export function screenRows(w: number, colW: number, rowH: number): number {
  const widthPx = colW * w + MARGIN * (w - 1)
  const need = HEADER_PX + (widthPx - 2) * (9 / 16) + 2
  return Math.max(4, Math.ceil((need + MARGIN) / (rowH + MARGIN)))
}

/** Pixels left in the Screen cell under its picture (grid rows come in steps). */
export function screenLeftover(w: number, h: number, colW: number, rowH: number): number {
  const widthPx = colW * w + MARGIN * (w - 1)
  const need = HEADER_PX + (widthPx - 2) * (9 / 16) + 2
  return Math.max(0, rowH * h + MARGIN * (h - 1) - need)
}

const overlapsX = (a: Item, b: Item) => a.x < b.x + b.w && b.x < a.x + a.w
const overlapsY = (a: Item, b: Item) => a.y < b.y + b.h && b.y < a.y + a.h
const collide = (a: Item, b: Item) => a.i !== b.i && overlapsX(a, b) && overlapsY(a, b)

export function settle(input: Item[], cols: number, colW: number, rowH: number, rows = ROWS): Item[] {
  const items = input.map((it) => {
    const w = Math.max(1, Math.min(it.w, cols))
    return { ...it, w, x: Math.max(0, Math.min(it.x, cols - w)), h: Math.max(MIN_H, it.h), y: Math.max(0, it.y) }
  })
  const screen = items.find((it) => it.i === 'screen')
  // Screen's picture may take at most 60% of the height; on a short window it gets narrower rather than
  // pushing the other widgets down to their headers.
  const screenFits = (w: number) => screenRows(w, colW, rowH) <= Math.floor(rows * 0.6)
  if (screen) {
    while (screen.w > 1 && !screenFits(screen.w)) screen.w--
    screen.h = Math.min(screenRows(screen.w, colW, rowH), rows - 4)
    screen.resizeHandles = ['e', 'w'] // height follows width
  }

  // 1. Fall upwards, top items first, never overlapping.
  const placed: Item[] = []
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    let y = 0
    while (placed.some((p) => collide({ ...it, y }, p))) y++
    it.y = y
    placed.push(it)
  }

  // 2. Nothing may leave the window: squeeze the tallest flexible widget of the stack that overflows.
  for (let guard = 0; guard < 200; guard++) {
    const over = placed.find((p) => p.y + p.h > rows)
    if (!over) break
    const stack = placed.filter((p) => overlapsX(p, over) && p.i !== 'screen' && p.h > MIN_H).sort((a, b) => b.h - a.h)
    if (!stack.length) { over.y = Math.max(0, rows - over.h); break }
    stack[0].h--
    // re-fall after shrinking
    for (const it of [...placed].sort((a, b) => a.y - b.y)) {
      let y = 0
      while (placed.some((p) => collide({ ...it, y }, p))) y++
      it.y = y
    }
  }

  // 3. Fill vertical holes: each widget grows down to the next widget below it, or the bottom.
  for (const it of [...placed].sort((a, b) => b.y - a.y)) {
    if (it.i === 'screen') continue
    let bottom = rows
    for (const p of placed) if (p !== it && overlapsX(p, it) && p.y >= it.y + it.h) bottom = Math.min(bottom, p.y)
    it.h = bottom - it.y
  }

  // 4. Fill horizontal holes: widgets widen into empty columns beside them.
  for (const it of [...placed].sort((a, b) => a.x - b.x)) {
    // Screen widens only while its picture still fits (a wider Screen is a taller one).
    const may = () => it !== screen || screenFits(it.w + 1)
    while (it.x + it.w < cols && may() && !placed.some((p) => collide({ ...it, w: it.w + 1 }, p))) it.w++
    while (it.x > 0 && may() && !placed.some((p) => collide({ ...it, x: it.x - 1, w: it.w + 1 }, p))) { it.x--; it.w++ }
  }
  if (screen) screen.h = Math.min(screenRows(screen.w, colW, rowH), rows - 4)
  // A wider Screen may now be taller; let the widgets under it make room.
  for (const it of [...placed].sort((a, b) => a.y - b.y)) {
    if (it === screen) continue
    while (placed.some((p) => collide(it, p))) { it.y++; it.h = Math.max(2, it.h - 1) }
  }
  return placed
}

export const sameLayout = (a: Item[], b: Item[]) =>
  a.length === b.length && a.every((x) => { const y = b.find((z) => z.i === x.i); return y && y.x === x.x && y.y === x.y && y.w === x.w && y.h === x.h })
