import { describe, it, expect } from 'vitest'
import { VerseTracker, findIntent, type Passage } from './tracker'

const TEXT: Record<string, string> = {
  '42:3:16': 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
  '42:3:17': 'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.',
  '42:3:18': 'He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God.',
  '58:1:2': 'My brethren, count it all joy when ye fall into divers temptations;',
  '58:1:3': 'Knowing this, that the trying of your faith worketh patience.',
  '58:1:4': 'But let patience have her perfect work, that ye may be perfect and entire, wanting nothing.',
  '58:1:5': 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.'
}
const COUNT: Record<string, number> = { '11:23': 37, '0:3': 24, '44:8': 39, '19:2': 22, '19:20': 30, '61:1': 10, '57:3': 19, '57:11': 40, '42:2': 25, '42:3': 36, '58:1': 27 }
const bible = {
  verseText: (b: number, c: number, v: number) => TEXT[`${b}:${c}:${v}`] ?? 'filler words here',
  chapterVerseCount: (b: number, c: number) => COUNT[`${b}:${c}`] ?? 0
}
const make = () => {
  const seen: Passage[] = []
  return { t: new VerseTracker(bible, (p) => seen.push(p)), seen }
}
/** Simulates a recogniser: interim results grow word by word, then the sentence is final. */
function say(t: VerseTracker, sentence: string) {
  const w = sentence.split(' ')
  for (let i = 3; i < w.length; i++) t.hear(w.slice(0, i).join(' '))
  t.feed(sentence)
}

describe('VerseTracker', () => {
  it('single verse stays put', () => {
    const { t } = make()
    say(t, 'open to John 3:16')
    say(t, 'For God so loved the world that he gave his only begotten Son')
    expect(t.passage).toMatchObject({ first: 16, last: 16, current: 16 })
  })

  it('James 1:3-4: moves to verse 4 as soon as verse 3 is read, with no command', () => {
    const { t, seen } = make()
    say(t, "let's read James chapter 1 verse 3 to 4")
    expect(t.passage?.current).toBe(3)
    t.hear('Knowing this that the trying of your faith worketh')
    expect(t.passage?.current).toBe(3)
    t.hear('Knowing this that the trying of your faith worketh patience')
    expect(t.passage?.current).toBe(4) // moved mid-sentence, before the pause
    expect(seen.map((p) => p.current)).toEqual([3, 4])
  })

  it('John 3:16-18 follows every verse through a continuous reading', () => {
    const { t } = make()
    say(t, "let's read John 3:16-18")
    say(t, 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.')
    expect(t.passage?.current).toBe(17)
    say(t, 'For God sent not his Son into the world to condemn the world; but that the world through him might be saved.')
    expect(t.passage?.current).toBe(18)
  })

  it('copes with recognition slips and modern wording', () => {
    const { t } = make()
    say(t, 'James 1 verse 3 to 4')
    say(t, 'knowing this that the testing of your faith works patience')
    expect(t.passage?.current).toBe(4)
  })

  it('does not drift when the preacher comments between verses', () => {
    const { t } = make()
    say(t, 'James 1:2-5')
    say(t, 'church I want you to see something here this morning')
    expect(t.passage?.current).toBe(2)
  })

  it('jumps on "verse 18" and on "next verse"', () => {
    const { t } = make()
    say(t, 'John 3:16-18')
    say(t, 'now verse 18')
    expect(t.passage?.current).toBe(18)
    say(t, 'go back one')
    expect(t.passage?.current).toBe(17)
    say(t, 'next verse')
    expect(t.passage?.current).toBe(18)
  })
})

describe('human navigation', () => {
  const open = () => { const { t } = make(); say(t, 'John 3:16-18'); return t }
  it('jump to the thirteenth one', () => { const t = open(); say(t, 'eh, jump to, to the thirteenth one'); expect(t.passage?.current).toBe(13) })
  it("let's go back to verse 2", () => { const t = open(); say(t, "let's go back to verse two"); expect(t.passage?.current).toBe(2) })
  it('chapter 2 of the same book', () => { const t = open(); say(t, "let's move to chapter two"); expect(t.passage).toMatchObject({ book: 42, chapter: 2 }) })
  it('the one before', () => { const t = open(); say(t, 'now verse 18'); say(t, 'can we see the one before'); expect(t.passage?.current).toBe(17) })
  it('where we started', () => { const t = open(); say(t, 'next verse'); say(t, 'take us back to where we started'); expect(t.passage?.current).toBe(16) })
  it('previous scripture asks the app', () => {
    const t = open(); let asked = false
    t.onIntent = () => { asked = true }
    say(t, 'go to the previous scripture we read'); expect(asked).toBe(true)
  })
  it('ordinary preaching is not a command', () => { const t = open(); say(t, 'God has a plan for your life, two things I want you to know'); expect(t.passage?.current).toBe(16) })
})

describe('reference split across sentences', () => {
  it('"Romans chapter eight" then "verse 28 and we know…"', () => {
    const { t } = make()
    COUNT['44:8'] = 39
    say(t, 'that is why Paul could write in the book of Romans chapter eight')
    expect(t.passage).toMatchObject({ book: 44, chapter: 8, current: 1 })
    say(t, 'verse 28 and we know that all things work together for good to them that love God')
    expect(t.passage?.current).toBe(28)
  })
})

describe('restated range', () => {
  it('"four to seven" then "from verse four" keeps reading through 7', () => {
    const { t } = make()
    COUNT['45:13'] = 13
    say(t, 'first Corinthians thirteen four to seven')
    say(t, 'first Corinthians chapter thirteen from verse four')
    expect(t.passage).toMatchObject({ first: 4, last: 7, current: 4 })
  })
})

describe('more navigation', () => {
  it('correction "17, sorry, 16" is a single verse', () => {
    const { t } = make()
    say(t, 'turn with me to John chapter 3 verse 17')
    say(t, 'sorry sorry verse sixteen')
    expect(t.passage).toMatchObject({ first: 16, last: 16, current: 16 })
  })
  it('"in verse six of the same chapter"', () => {
    const { t } = make()
    say(t, 'John 3:16')
    say(t, 'and then in verse six of the same chapter it says')
    expect(t.passage?.current).toBe(6)
  })
})

describe('reference split into pieces', () => {
  it('"the book of Hebrews" / "chapter 11" / "verse one"', () => {
    const { t } = make()
    COUNT['57:11'] = 40
    say(t, 'Jeremiah 29 11')
    say(t, 'let us go to the book of hebrews')
    say(t, 'chapter11')
    say(t, 'verse one')
    expect(t.passage).toMatchObject({ book: 57, chapter: 11, current: 1 })
  })
})

describe('first live service', () => {
  it('"romance chapter eight vice twelve" is Romans 8:12, not chapter 8 of the open book', () => {
    const { t } = make()
    say(t, 'genesis chapter three verse one')
    say(t, 'romance chapter eight vice twelve')
    expect(t.passage).toMatchObject({ book: 44, chapter: 8, current: 12 })
  })
  it('"genes chapter three" is Genesis 3, not Hebrews 3', () => {
    const { t } = make()
    say(t, 'Hebrews eleven twelve')
    say(t, 'genes chapter three')
    expect(t.passage).toMatchObject({ book: 0, chapter: 3 })
  })
  it('an unknown word before "chapter" does not move within the open book', () => {
    const { t } = make()
    say(t, 'Hebrews eleven twelve')
    say(t, 'jinks chapter three')
    expect(t.passage).toMatchObject({ book: 57, chapter: 11, current: 12 })
  })
  it('"go to chapter three" still moves within the open book', () => {
    const { t } = make()
    say(t, 'Hebrews eleven twelve')
    say(t, 'go to chapter three')
    expect(t.passage).toMatchObject({ book: 57, chapter: 3 })
  })
  it('naming the open chapter again keeps the verse', () => {
    const { t } = make()
    say(t, 'first john chapter one verse six')
    say(t, 'First John, chapter one versus.')
    expect(t.passage).toMatchObject({ book: 61, chapter: 1, current: 6 })
  })
  it('"Proverb2027" is Proverbs 20:27', () => {
    const { t } = make()
    say(t, 'Proverb2027 .')
    expect(t.passage).toMatchObject({ book: 19, chapter: 20, current: 27 })
  })
})

describe('second live run', () => {
  it('reads on past a single named verse when the next verse is actually read', () => {
    const { t } = make()
    say(t, 'James chapter one verse two')
    say(t, 'My brethren, count it all joy when ye fall into divers temptations')
    say(t, 'Knowing this, that the trying of your faith worketh patience')
    expect(t.passage).toMatchObject({ book: 58, chapter: 1, current: 3 })
  })
  it('finishing a single named verse does not jump ahead by itself', () => {
    const { t } = make()
    say(t, 'James chapter one verse two')
    say(t, 'My brethren, count it all joy when ye fall into divers temptations')
    expect(t.passage).toMatchObject({ current: 2 })
  })
  it('"next verse" inside a long sentence', () => {
    const { t } = make()
    say(t, 'James chapter one verse two')
    say(t, 'count it all joy when ye fall into divers temptations next verse and knowing this that the trying of your faith')
    expect(t.passage).toMatchObject({ current: 3 })
  })
  it('"go on" at the end of a sentence', () => {
    const { t } = make()
    say(t, 'James chapter one verse two')
    say(t, 'so you want to see what he says go on')
    expect(t.passage).toMatchObject({ current: 3 })
  })
})

describe('third live run', () => {
  it('an unrecognised book before "chapter N verse M" does not jump within the open chapter', () => {
    const { t } = make()
    say(t, 'James chapter one verse two')
    say(t, 'right blorpians chapter six verse four')
    expect(t.passage).toMatchObject({ book: 58, chapter: 1, current: 2 })
  })
})

describe('YouTube service run', () => {
  it('"chapter six verse ten" with no book does not jump inside the start-up passage', () => {
    const { t } = make()
    t.open(42, 3, 16, 16)
    t.placeholder = true
    say(t, 'chapter six verse ten')
    expect(t.passage).toMatchObject({ book: 42, chapter: 3, current: 16 })
  })
  it('it still works once the preacher has named a book', () => {
    const { t } = make()
    say(t, 'John chapter three verse sixteen')
    say(t, 'chapter two verse one')
    expect(t.passage).toMatchObject({ book: 42, chapter: 2, current: 1 })
  })
})

describe('talking about scripture is not a command', () => {
  it('"I love the scripture we read"', () => expect(findIntent('i i love the scripture we read')).toBeUndefined())
  it('"go back to the scripture we read"', () => expect(findIntent('go back to the scripture we read')).toEqual({ kind: 'lastScripture' }))
  it('"the previous scripture"', () => expect(findIntent('the previous scripture')).toEqual({ kind: 'lastScripture' }))
})

describe('spoken at home after the service', () => {
  it('"go to the next chapter verse four"', () => {
    const { t } = make()
    say(t, 'John chapter two verse one')
    say(t, 'uh go to the next chapter verse four')
    expect(t.passage).toMatchObject({ book: 42, chapter: 3, current: 4 })
  })
  it('"go to verse four of the next chapter"', () => {
    const { t } = make()
    say(t, 'John chapter two verse one')
    say(t, 'go to verse four of the next chapter')
    expect(t.passage).toMatchObject({ book: 42, chapter: 3, current: 4 })
  })
  it('"second kings" / "Tony three vs one"', () => {
    const { t } = make()
    say(t, 'second kings')
    say(t, 'Tony three vs one.')
    expect(t.passage).toMatchObject({ book: 11, chapter: 23, current: 1 })
  })
})
