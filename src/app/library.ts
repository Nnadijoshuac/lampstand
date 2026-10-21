import { parseBib, type BibleModule } from '@shared/bib'
import { BOOKS } from '@shared/books'
import type { VerseLookup } from '@shared/tracker'
import { extractBibFromInstaller, isJetDb } from '@shared/nsis'
import * as idb from './idb'

/** Every Bible version the app knows, keyed by short name. */
export class Library {
  modules = new Map<string, BibleModule>()
  private index = new Map<string, Map<string, number>>()

  async load(): Promise<void> {
    const kjv = await this.builtinKjv()
    this.add(kjv)
    const saved = (await idb.get<string[]>('modules')) ?? []
    for (const s of saved) {
      const m = await idb.get<BibleModule>('module:' + s)
      if (m) this.add(m)
    }
  }

  /** Public-domain KJV ships with the app so it works with zero setup. */
  private async builtinKjv(): Promise<BibleModule> {
    const raw: { chapters: string[][] }[] = await (await fetch('/kjv.json')).json()
    const verses: BibleModule['verses'] = []
    raw.forEach((b, bi) => b.chapters.forEach((ch, ci) => ch.forEach((t, vi) => {
      const text = t.replace(/^\s*[#¶]\s*/, '').replace(/[{}]/g, '').trim()
      verses.push({ book: bi, chapter: ci + 1, verse: vi + 1, text, html: text })
    })))
    return { name: 'King James Version', short: 'KJV', description: 'Public domain.', verses, footnotes: [], titles: [] }
  }

  add(m: BibleModule): void {
    this.modules.set(m.short, m)
    const idx = new Map<string, number>()
    m.verses.forEach((v, i) => idx.set(`${v.book}:${v.chapter}:${v.verse}`, i))
    this.index.set(m.short, idx)
  }

  /** Import a Bible Show version: the installer .exe, or the .bib inside it. */
  async importFile(file: File): Promise<BibleModule> {
    let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer())
    if (!isJetDb(bytes)) bytes = await extractBibFromInstaller(bytes)
    const m = parseBib(bytes)
    if (!m.verses.length) throw new Error('No verses found in this file')
    this.add(m)
    await idb.set('module:' + m.short, m)
    const saved = new Set((await idb.get<string[]>('modules')) ?? [])
    saved.add(m.short)
    await idb.set('modules', [...saved])
    return m
  }

  async remove(short: string): Promise<void> {
    if (short === 'KJV') return
    this.modules.delete(short)
    this.index.delete(short)
    await idb.del('module:' + short)
    const saved = ((await idb.get<string[]>('modules')) ?? []).filter((s) => s !== short)
    await idb.set('modules', saved)
  }

  verse(short: string, book: number, chapter: number, verse: number) {
    const m = this.modules.get(short)
    const i = this.index.get(short)?.get(`${book}:${chapter}:${verse}`)
    return m && i !== undefined ? m.verses[i] : undefined
  }

  lookup(short: string): VerseLookup {
    return {
      verseText: (b, c, v) => this.verse(short, b, c, v)?.text,
      chapterVerseCount: (b, c) => {
        let n = 0
        while (this.verse(short, b, c, n + 1)) n++
        return n
      }
    }
  }
}

export const bookName = (i: number) => BOOKS[i]?.name ?? ''
