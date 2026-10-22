/**
 * Converts public-domain Bible Show installers into Lampstand Bibles for the website.
 * usage: BS_DIR=<folder of .exe installers> BS_MODULES=<bibleshow modules.json> npx vite-node scripts/convert-bibleshow.ts
 *
 * Only translations Bible Show itself marks as public domain are converted. The others are listed in the
 * catalogue with a link to Bible Show, which distributes them.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'
import { extractBibFromInstaller } from '../src/shared/nsis'
import { parseBib } from '../src/shared/bib'

const dir = process.env.BS_DIR!, modulesPath = process.env.BS_MODULES!
const OUT = join(__dirname, '..', 'website', 'public', 'bibles')
mkdirSync(OUT, { recursive: true })

interface Module { ID: string; Language: string; Name: string; Abbr: string; File: string; Size: string; Copyright: string; Details: string }
const modules: Module[] = JSON.parse(readFileSync(modulesPath, 'utf8').replace(/^﻿/, ''))
const out: { id: string; short: string; name: string; year?: number; language: string; license: string; file: string; size: number; verses: number }[] = []

for (const m of modules.filter((x) => /public domain/i.test(x.Copyright ?? ''))) {
  try {
    const bib = await extractBibFromInstaller(new Uint8Array(readFileSync(join(dir, m.File))))
    const parsed = parseBib(bib)
    const books: string[][][] = Array.from({ length: 66 }, () => [])
    let verses = 0
    for (const v of parsed.verses) {
      if (v.book < 0 || v.book > 65 || v.chapter < 1 || v.verse < 1) continue // deuterocanonical books: the app has 66 books for now
      const chapters = books[v.book]
      while (chapters.length < v.chapter) chapters.push([])
      const list = chapters[v.chapter - 1]
      while (list.length < v.verse) list.push('')
      list[v.verse - 1] = v.html
      verses++
    }
    const year = Number(m.Name.match(/\((\d{4})\)/)?.[1]) || undefined
    const name = m.Name.replace(/\s*\(\d{4}\)\s*$/, '')
    const doc = { format: 'lampstand-bible', version: 1, short: m.Abbr.toUpperCase(), name, year, language: m.Language, license: 'Public domain', source: 'Bible Show (bibleshow.net), public-domain module ' + m.ID, books }
    const file = `${m.ID}.lamp.json`
    writeFileSync(join(OUT, file), JSON.stringify(doc))
    out.push({ id: m.ID, short: doc.short, name, year, language: m.Language, license: 'Public domain', file, size: statSync(join(OUT, file)).size, verses })
    console.log(m.ID, m.Language, verses)
  } catch (e) {
    console.log('FAILED', m.ID, (e as Error).message)
  }
}
writeFileSync(join(OUT, 'bibleshow-pd.json'), JSON.stringify(out, null, 1))
