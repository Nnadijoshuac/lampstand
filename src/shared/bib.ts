import MDBReader from 'mdb-reader'

/** A Bible Show ".bib" module (Microsoft Jet 4 database) converted to a plain structure. */
export interface BibleModule {
  name: string
  short: string
  description: string
  /** Verses in canonical order. `html` keeps markup (words of Jesus, italics); `text` is plain, for search. */
  verses: { book: number; chapter: number; verse: number; text: string; html: string }[]
  footnotes: { book: number; chapter: number; verse: number; text: string }[]
  titles: { book: number; chapter: number; verse: number; text: string }[]
}

const stripTags = (s: string) =>
  s.replace(/<[^>]*>/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim()

export function parseBib(data: Uint8Array): BibleModule {
  const db = new MDBReader(Buffer.from(data))
  const names = db.getTableNames()
  const rows = (t: string) => (names.includes(t) ? db.getTable(t).getData() : [])
  const info = Object.fromEntries(rows('Info').map((r) => [String(r.Parameter), String(r.Value ?? '')]))

  const verses = rows('Bible')
    .map((r) => {
      const html = String(r.Scripture ?? '')
      return { book: Number(r.Book) - 1, chapter: Number(r.Chapter), verse: Number(r.Verse), text: stripTags(html), html }
    })
    .sort((a, b) => a.book - b.book || a.chapter - b.chapter || a.verse - b.verse)

  const side = (t: string, col: string) =>
    rows(t).map((r) => ({ book: Number(r.Book) - 1, chapter: Number(r.Chapter), verse: Number(r.Verse), text: stripTags(String(r[col] ?? '')) }))

  return {
    name: info.BibleFullName ?? 'Unknown',
    short: info.BibleShortName ?? 'UNK',
    description: info.Description ?? '',
    verses,
    footnotes: side('Footnotes', 'Footnote'),
    titles: side('Titles', 'Title')
  }
}
