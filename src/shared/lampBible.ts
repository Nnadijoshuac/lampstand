/**
 * The Lampstand Bible format: one JSON file per translation, the standard way to add a translation to Lampstand.
 *
 *   { "format": "lampstand-bible", "version": 1, "short": "ASV", "name": "American Standard Version",
 *     "year": 1901, "language": "en", "license": "Public domain",
 *     "books": [ [ ["verse 1", "verse 2", ...], ...chapters ], ...66 books in Protestant canonical order ] }
 *
 * Verse n of a chapter is at index n - 1. A verse the translation leaves out is "". Verses may carry the same
 * light markup as Bible Show (<span class="jesus">…</span> for the words of Jesus). Built by scripts/build-bibles.py.
 */
import type { BibleModule } from './bib'

export interface LampBible {
  format: 'lampstand-bible'
  version: number
  short: string
  name: string
  year?: number
  language?: string
  license?: string
  books: string[][][]
}

/**
 * One entry of the online catalogue (website/public/bibles/index.json, built by scripts/build-catalog.py): every
 * translation Bible Show offers, and where to get it. "lampstand": hosted as a Lampstand Bible (`file`).
 * "bibleshow": belongs to its publisher, download it from Bible Show. "builtin": the KJV. "held": coming soon.
 */
export interface CatalogEntry {
  id: string
  short: string
  name: string
  year?: number
  language: string
  copyright: string
  source: 'lampstand' | 'bibleshow' | 'builtin' | 'held'
  file?: string
  size?: number | string
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

/** True when the bytes look like a Lampstand Bible (JSON), rather than a Bible Show database or installer. */
export function isLampBible(bytes: Uint8Array): boolean {
  for (let i = 0; i < Math.min(bytes.length, 64); i++) {
    const c = bytes[i]
    if (c === 0xef || c === 0xbb || c === 0xbf || c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09) continue // BOM, whitespace
    return c === 0x7b // {
  }
  return false
}

export function parseLampBible(json: unknown): BibleModule {
  const d = json as Partial<LampBible>
  if (d?.format !== 'lampstand-bible' || !Array.isArray(d.books)) throw new Error('Not a Lampstand Bible file')
  if ((d.version ?? 1) > 1) throw new Error('This translation needs a newer Lampstand')
  if (!d.short || !d.name) throw new Error('The file has no translation name')
  const verses: BibleModule['verses'] = []
  d.books.slice(0, 66).forEach((chapters, book) =>
    (chapters ?? []).forEach((list, ci) =>
      (list ?? []).forEach((html, vi) => {
        if (html) verses.push({ book, chapter: ci + 1, verse: vi + 1, text: stripTags(html), html })
      })))
  const about = [d.year, d.license].filter(Boolean).join(' · ')
  return { name: d.name, short: d.short.toUpperCase(), description: about, verses, footnotes: [], titles: [] }
}
