import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { extractBibFromInstaller, isJetDb } from './nsis'
import { parseBib } from './bib'

const dir = new URL('../../samples/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
describe.skipIf(!existsSync(dir + 'AMP2015.exe'))('Bible Show installers', () => {
  for (const n of ['AMP2015', 'ERV2005', 'KJ2000']) {
    it('opens ' + n, async () => {
      const bib = await extractBibFromInstaller(new Uint8Array(readFileSync(dir + n + '.exe')))
      expect(isJetDb(bib)).toBe(true)
      const m = parseBib(bib)
      expect(m.verses.length).toBeGreaterThan(30000)
      expect(m.verses.find((v) => v.book === 42 && v.chapter === 3 && v.verse === 16)?.text.length).toBeGreaterThan(40)
    })
  }
})
