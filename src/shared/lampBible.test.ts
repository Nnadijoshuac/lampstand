import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { isLampBible, parseLampBible } from './lampBible'

const tiny = { format: 'lampstand-bible', version: 1, short: 'tst', name: 'Test Bible', year: 1901, license: 'Public domain', books: [[['In the beginning.', '', 'Third.']]] }

describe('Lampstand Bible format', () => {
  it('reads verses and skips ones the translation leaves out', () => {
    const m = parseLampBible(tiny)
    expect(m.short).toBe('TST')
    expect(m.verses).toEqual([
      { book: 0, chapter: 1, verse: 1, text: 'In the beginning.', html: 'In the beginning.' },
      { book: 0, chapter: 1, verse: 3, text: 'Third.', html: 'Third.' }
    ])
    expect(m.description).toBe('1901 · Public domain')
  })
  it('tells a Lampstand Bible from other files', () => {
    expect(isLampBible(new TextEncoder().encode('\uFEFF  {"format":"lampstand-bible"}'))).toBe(true)
    expect(isLampBible(new Uint8Array([0x00, 0x01, 0x00, 0x00, 0x53]))).toBe(false)
    expect(isLampBible(new TextEncoder().encode('MZ...'))).toBe(false)
  })
  it('refuses other JSON', () => expect(() => parseLampBible({ books: [] })).toThrow())
  it.skipIf(!existsSync('website/public/bibles/BSB.lamp.json'))('reads a published translation', () => {
    const m = parseLampBible(JSON.parse(readFileSync('website/public/bibles/BSB.lamp.json', 'utf8')))
    expect(m.verses.length).toBeGreaterThan(31000) // the BSB leaves out 16 verses missing from older manuscripts
    expect(m.verses.find((v) => v.book === 42 && v.chapter === 3 && v.verse === 16)?.text).toMatch(/^For God so loved the world/)
  })
})
