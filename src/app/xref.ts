/** Cross references from OpenBible.info (CC-BY), ranked by votes. Built by scripts/build-xref.py. */
export interface Link { book: number; chapter: number; verse: number; end: number; votes: number }

let table: Record<string, [number, number, number, number, number][]> | undefined
const ready = fetch('/xref.json').then((r) => r.json()).then((t) => { table = t }).catch(() => { table = {} })

export const xrefsReady = () => ready

export function related(book: number, chapter: number, verse: number): Link[] {
  return (table?.[`${book}:${chapter}:${verse}`] ?? []).map(([b, c, v, e, votes]) => ({ book: b, chapter: c, verse: v, end: e, votes }))
}

type Ref = { book: number; chapter: number; verse: number }

/** True when `to` is cross-referenced from `from`, in either direction. */
export function linked(from: Ref, to: Ref): boolean {
  const hit = (a: Ref, b: Ref) => related(a.book, a.chapter, a.verse).some((l) => l.book === b.book && l.chapter === b.chapter && b.verse >= l.verse && b.verse <= l.end)
  return hit(from, to) || hit(to, from)
}
