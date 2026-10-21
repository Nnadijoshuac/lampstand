import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { parseBib } from './bib'

const samples = '../../samples'
// Samples are NSIS installers; tests use the extracted .bib if present.
const kj = process.env.KJ_BIB
describe.skipIf(!kj || !existsSync(kj))('parseBib', () => {
  it('reads KJ2000', () => {
    const m = parseBib(readFileSync(kj!))
    expect(m.short).toBe('KJ2000')
    expect(m.verses.length).toBeGreaterThan(31000)
    const jn = m.verses.find((v) => v.book === 42 && v.chapter === 3 && v.verse === 16)!
    expect(jn.text).toMatch(/^For God so loved the world/)
  })
})
void samples
