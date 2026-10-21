import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { QuoteIndex } from './quote'

// The whole KJV, so word rarity is realistic; sentences are as a recogniser actually produced them during a sermon.
const raw: { chapters: string[][] }[] = JSON.parse(readFileSync('public/kjv.json', 'utf8').replace(/^﻿/, ''))
const V: { book: number; chapter: number; verse: number; text: string }[] = []
raw.forEach((b, bi) => b.chapters.forEach((ch, ci) => ch.forEach((t, vi) => V.push({ book: bi, chapter: ci + 1, verse: vi + 1, text: t }))))
const q = new QuoteIndex(V)
const ref = (h?: { book: number; chapter: number; verse: number }) => h && `${h.book}:${h.chapter}:${h.verse}`

describe('QuoteIndex', () => {
  it('finds a quote inside a long sentence', () =>
    expect(ref(q.find('as soon as jesus was commissioned into ministry this is my beloved son in woman well pleased heavens open'))).toBe('39:3:17'))
  it('finds a reworded verse in rare words', () =>
    expect(ref(q.find('the bible said even when the temptation ended satan departed for a me for a season'))).toBe('41:4:13'))
  it('finds a short distinctive phrase', () => expect(ref(q.find('over no let no man despise your youth be matured'))).toBe('53:4:12'))
  it('ignores prayer language', () =>
    expect(q.find('let the power of the holy spirit now visit you now in the name of jesus christ')).toBeUndefined())
  it('ignores ordinary talk', () => expect(q.find('many years ago i went for a training on the use of tyres')).toBeUndefined())
  it('follows the reading further down an open chapter', () => {
    expect(ref(q.inChapter('he that loveth not knoweth not god for god is what', 61, 4))).toBe('61:4:8')
    expect(ref(q.inChapter('and he that dwelleth in love dwelleth in god and god will', 61, 4))).toBe('61:4:16')
    expect(q.inChapter('we are talking about hosting god is that correct', 61, 4)).toBeUndefined()
  })
})
