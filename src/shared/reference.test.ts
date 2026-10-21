import { describe, it, expect } from 'vitest'
import { findReferences, findVerseOnly } from './reference'

describe('findReferences', () => {
  it('parses colon form with range', () => {
    expect(findReferences("let's read John 3:16-18")).toEqual([{ book: 42, chapter: 3, start: 16, end: 18 }])
  })
  it('parses spoken form', () => {
    expect(findReferences('open to the book of John chapter three verse sixteen')).toEqual([{ book: 42, chapter: 3, start: 16 }])
  })
  it('handles numbered books', () => {
    expect(findReferences('first Corinthians 13 verse 4')[0]).toMatchObject({ book: 45, chapter: 13, start: 4 })
  })
  it('chapter only', () => {
    expect(findReferences('turn to Psalm 23')).toEqual([{ book: 18, chapter: 23 }])
  })
  it('verse-only follow-up', () => {
    expect(findVerseOnly('now verse 17')).toEqual({ start: 17 })
  })
})

describe('typed abbreviations', () => {
  const t = (s: string) => findReferences(s, true)[0]
  it('jn1 1', () => expect(t('jn1 1')).toEqual({ book: 42, chapter: 1, start: 1 }))
  it('jhn 3 16', () => expect(t('jhn 3 16')).toEqual({ book: 42, chapter: 3, start: 16 }))
  it('gn 1', () => expect(t('gn 1')).toEqual({ book: 0, chapter: 1 }))
  it('1co13:4', () => expect(t('1co13:4')).toEqual({ book: 45, chapter: 13, start: 4 }))
  it('1 jn 4 8', () => expect(t('1 jn 4 8')).toEqual({ book: 61, chapter: 4, start: 8 }))
  it('ps 23 1-3', () => expect(t('ps 23 1-3')).toEqual({ book: 18, chapter: 23, start: 1, end: 3 }))
  it('rom 8 28', () => expect(t('rom 8 28')).toEqual({ book: 44, chapter: 8, start: 28 }))
  it('speech ignores short words', () => expect(findReferences('the answer is 5 so 3 people')).toEqual([]))
  it('speech: second kings', () => expect(findReferences('second Kings chapter 2')[0]).toEqual({ book: 11, chapter: 2 }))
  it('bark style chapter3 verse16', () => expect(findReferences('the Book of John, Chapter3, verse16 .')[0]).toEqual({ book: 42, chapter: 3, start: 16 }))
})

describe('spoken without "verse"', () => {
  it('John one twenty-four', () => expect(findReferences('John one twenty-four')[0]).toEqual({ book: 42, chapter: 1, start: 24 }))
  it('John 1 24', () => expect(findReferences('turn to John 1 24')[0]).toEqual({ book: 42, chapter: 1, start: 24 }))
})

describe('preacher phrasing', () => {
  const r = (s: string) => findReferences(s)[0]
  it('first epistle of Peter, fifth chapter, from verse six', () => expect(r('the first epistle of Peter the fifth chapter from verse six')).toEqual({ book: 59, chapter: 5, start: 6 }))
  it('gospel according to John chapter 1 and verse 24', () => expect(r('the gospel according to John chapter one and verse twenty four')).toEqual({ book: 42, chapter: 1, start: 24 }))
  it('letter to the Romans eight twenty eight', () => expect(r('the letter to the Romans eight twenty eight')).toEqual({ book: 44, chapter: 8, start: 28 }))
  it('James 1 verse 3 through 4', () => expect(r('James 1 verse 3 through 4')).toEqual({ book: 58, chapter: 1, start: 3, end: 4 }))
  it('second Corinthians five seventeen', () => expect(r('second Corinthians five seventeen')).toEqual({ book: 46, chapter: 5, start: 17 }))
})

describe('misheard book names', () => {
  const r = (s: string) => findReferences(s)[0]
  it('Philippines chapter 2 verse 1', () => expect(r('open to Philippines chapter 2 verse 1')).toEqual({ book: 49, chapter: 2, start: 1 }))
  it('Habakuk 2 3', () => expect(r('Habakuk 2 3')).toEqual({ book: 34, chapter: 2, start: 3 }))
  it('1 Corintians 13', () => expect(r('1 Corintians 13')).toEqual({ book: 45, chapter: 13 }))
  it('no false book from ordinary words', () => expect(findReferences('the people 2 times')).toEqual([]))
})

describe('sound-alike book names', () => {
  it('Havakuck chapter two verse three', () => expect(findReferences('Then Havakuck chapter two verse three')[0]).toEqual({ book: 34, chapter: 2, start: 3 }))
  it('Filipians 4 13', () => expect(findReferences('Filipians 4 13')[0]).toEqual({ book: 49, chapter: 4, start: 13 }))
  it('Duteronomy 6 4', () => expect(findReferences('Duteronomy 6 4')[0]).toEqual({ book: 4, chapter: 6, start: 4 }))
})

describe('everyday words are not books', () => {
  it('number one', () => expect(findReferences('number one keep serving where you are')).toEqual([]))
  it('number three', () => expect(findReferences('number three wait on the lord')).toEqual([]))
  it('Numbers itself still works', () => expect(findReferences('Numbers 6 24')[0]).toEqual({ book: 3, chapter: 6, start: 24 }))
})

describe('misheard book names before "chapter"', () => {
  it('romance chapter', () => expect(findReferences('romance chapter eight vice twelve')[0]).toEqual({ book: 44, chapter: 8, start: 12 }))
  it('genes chapter', () => expect(findReferences('genes chapter three')[0]).toEqual({ book: 0, chapter: 3 }))
  it('versus means verse', () => expect(findReferences('john chapter three versus sixteen')[0]).toEqual({ book: 42, chapter: 3, start: 16 }))
  it('romance alone is still not Romans', () => expect(findReferences('romance 2 people')).toEqual([]))
  for (const s of ['the whole chapter 3', 'the next chapter 3', 'another chapter 3', 'the same chapter 3', 'the entire chapter 3', 'the previous chapter 3', 'the following chapter 3', 'the final chapter 3', 'the opening chapter 3', 'every chapter 3', 'this chapter 3', 'later chapter 3', 'early chapter 3', 'second chapter 3'])
    it(`"${s}" is not a book`, () => expect(findReferences(s)).toEqual([]))
})

describe('heard in services', () => {
  it('official chapter six verse ten', () => expect(findReferences('right official chapter six verse ten')[0]).toEqual({ book: 48, chapter: 6, start: 10 }))
  it('efficient chapter six verse ten', () => expect(findReferences('all right efficient chapter six verse ten')[0]).toEqual({ book: 48, chapter: 6, start: 10 }))
  it('an efficient way is not a book', () => expect(findReferences('an efficient way to pray')).toEqual([]))
})

describe('heard in a recorded service', () => {
  it('"first john for eight"', () => expect(findReferences('first john for eight')[0]).toEqual({ book: 61, chapter: 4, start: 8 }))
  it('"for samuel sixteen eighteen"', () => expect(findReferences('please everybody turn with me for samuel sixteen eighteen')[0]).toEqual({ book: 8, chapter: 16, start: 18 }))
  it('"for John 3:16" stays John', () => expect(findReferences('for John 3:16 says')[0]).toEqual({ book: 42, chapter: 3, start: 16 }))
})
