import { findReferences, findVerseOnly, normalize } from './reference'

export interface VerseLookup {
  verseText(book: number, chapter: number, verse: number): string | undefined
  chapterVerseCount(book: number, chapter: number): number
}

export interface Passage {
  book: number
  chapter: number
  /** First and last verse the preacher announced. A lone verse has first === last. */
  first: number
  last: number
  /** Verse currently on screen. */
  current: number
  /** True when the announced reference was a chapter with no verse. */
  wholeChapter: boolean
}

const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'in', 'is', 'that', 'it', 'for', 'was', 'he', 'his', 'with', 'as', 'on', 'be', 'by', 'at', 'this', 'but', 'not', 'are', 'from', 'unto', 'i', 'you', 'ye', 'thou', 'they', 'them', 'shall', 'will', 'which', 'who'])
const SPOKEN_WINDOW = 12
const MIN_EVIDENCE = 4.5
/** Within this many words of a verse's end, the reader is treated as finished with it. */
const END_ZONE = 1

const words = (s: string) => normalize(s).split(' ').filter(Boolean)

/** Spoken and printed words match when equal, or close enough to absorb recognition slips and translation spelling. */
function same(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length < 4 || b.length < 4) return false
  if (a.slice(0, 4) === b.slice(0, 4) && Math.abs(a.length - b.length) <= 3) return true // loveth / loves, believeth / believes
  let diff = Math.abs(a.length - b.length)
  for (let i = 0; i < Math.min(a.length, b.length) && diff <= 1; i++) if (a[i] !== b[i]) diff++
  return diff <= 1
}

export type Intent =
  | { kind: 'next' }
  | { kind: 'previous' }
  | { kind: 'verse'; verse: number; end?: number }
  | { kind: 'chapter'; chapter: number; verse?: number }
  | { kind: 'chapterStep'; delta: 1 | -1; verse?: number }
  | { kind: 'start' }
  | { kind: 'lastScripture' }

const MOVE = /\b(go|jump|move|skip|turn|back|look|show|read|take|bring|to|at|see)\b/
/** Words that can stand before "chapter 3" when the preacher means this book's chapter 3. */
const SAME_BOOK = /^(turn|back|same|next|open|into|unto|that|this|read|from|with|over|then|look|down|again|also|now|let|lets|going|start|starting|reading|skip|jump|move|show|bring)$/

/**
 * Spoken navigation, written for how people actually talk:
 * "next verse", "the one before", "jump to the thirteenth one", "let's go back to verse 2",
 * "chapter 2" (same book), "where we started", "the previous scripture we read".
 */
export function findIntent(text: string): Intent | undefined {
  const t = normalize(text)
  const n = t.split(' ').length
  // "…wiles of the devil. Next verse, for we wrestle not…": an unmistakable instruction counts in any sentence,
  // and so does "go on" when it ends one ("…spiritual wickedness. Go on.").
  if (/\b(next verse|following verse|the verse after)\b/.test(t) || /\b(go on|carry on|keep going|continue)$/.test(t)) return { kind: 'next' }
  if (n > 14) return
  // "Go back to the scripture we read" is an instruction; "I love the scripture we read" is not.
  if (/\b(previous|last|other|earlier) (scripture|passage|reference|text|bible reading)\b|\b(scripture|passage) (we|i) (just )?(read|had)\b/.test(t) &&
    (/\b(go|turn|back|bring|show|return|take|put|open)\b/.test(t) || n <= 4)) return { kind: 'lastScripture' }
  // "1" here is the spoken "one" in "the next one" / "the one before".
  if (/\b(next verse|the next 1|next 1|move on|following verse|keep going|carry on|continue reading)\b/.test(t)) return { kind: 'next' }
  if (/\b(previous verse|verse before|the 1 before|1 before|go back a verse|back 1 verse|go back 1|back a verse)\b/.test(t)) return { kind: 'previous' }
  // "go to the next chapter, verse four", "verse four of the next chapter", "the previous chapter"
  const step = t.match(/\b(next|following|previous|last) chapter\b/)
  if (step) {
    const v = t.match(/\bverse (\d+)\b/)
    return { kind: 'chapterStep', delta: /next|following/.test(step[1]) ? 1 : -1, verse: v ? +v[1] : undefined }
  }
  const ch = t.match(/(?:^|(\S+) )chapter (\d+)(?: (?:verse |and verse |vs )?(\d+))?\b/)
  // "genes chapter three": an unknown word right before "chapter" is a misheard book, not chapter 3 of this one.
  if (ch && ch[1] && ch[1].length >= 4 && !SAME_BOOK.test(ch[1])) return
  if (ch) return { kind: 'chapter', chapter: +ch[2], verse: ch[3] ? +ch[3] : undefined }
  const explicit = t.match(/\bverses? (\d+)(?: (?:to|through|and) (\d+))?\b/)
  const vs = explicit ?? (MOVE.test(t) ? t.match(/\b(?:the|number) (\d+)(?: 1| verse)?\b/) : null)
  if (vs && (explicit || MOVE.test(t) || n <= 4)) return { kind: 'verse', verse: +vs[1], end: vs[2] ? +vs[2] : undefined }
  if (/\b(where we started|from the (top|beginning)|back to the (top|beginning|start))\b/.test(t)) return { kind: 'start' }
}

/**
 * Follows a preacher through scripture with no operator.
 * Spoken references open passages; while a passage is open, the live transcript is aligned
 * word by word against the verse text, so the screen moves to the next verse the moment the
 * reader finishes the current one.
 */
export class VerseTracker {
  passage?: Passage
  /** When false, spoken references and commands still work but the tracker no longer follows the reading. */
  autoFollow = true
  /** Recent words from finished sentences. */
  private heard: string[] = []
  /** Words of the sentence still being spoken (replaced on every interim result). */
  private partial: string[] = []

  constructor(private bible: VerseLookup, private onChange: (p: Passage) => void) {}

  /** A finished sentence. */
  /** True while the passage is only the one shown at start-up (nobody has named or opened anything yet). */
  placeholder = false
  /** The screen moved forward with the reading while the current sentence was still being spoken. */
  private movedWhileSpeaking = false
  /** The previous sentence, kept briefly: "…the book of Hebrews" / "chapter 11" / "verse one" arrive as separate pieces. */
  private prevSentence = { text: '', at: 0 }

  feed(text: string): void {
    this.partial = []
    const moved = this.movedWhileSpeaking
    this.movedWhileSpeaking = false
    const prev = this.prevSentence
    this.prevSentence = { text, at: Date.now() }
    if (!findReferences(text).length && prev.text && Date.now() - prev.at < 8000 && !findReferences(prev.text).length) {
      const joined = findReferences(prev.text + ' ' + text)
      if (joined.length) text = prev.text + ' ' + text // a book named at the end of the last sentence, its chapter in this one
    }
    const refs = findReferences(text)
    if (refs.length) {
      const r = refs[refs.length - 1]
      let count = this.bible.chapterVerseCount(r.book, r.chapter)
      // "Proverb2027": chapter and verse run together. Split where both exist, preferring the longer chapter.
      if (count === 0 && r.start === undefined && r.chapter >= 100) {
        const s = String(r.chapter)
        for (let k = s.length - 1; k >= 1 && !count; k--) {
          const c = +s.slice(0, k), v = +s.slice(k)
          if (s[k] !== '0' && v >= 1 && v <= this.bible.chapterVerseCount(r.book, c)) { r.chapter = c; r.start = v; count = this.bible.chapterVerseCount(r.book, c) }
        }
      }
      if (count === 0) return
      const p0 = this.passage
      // "First John, chapter one…" while 1 John 1:6 is up: naming the open chapter again is not a move to verse 1.
      if (p0 && p0.book === r.book && p0.chapter === r.chapter && r.start === undefined) { this.heard = []; return }
      const first = Math.min(r.start ?? 1, count)
      const end = r.end !== undefined && r.end < first ? count : r.end
      const last = Math.min(end ?? (r.start ?? count), count)
      // Words after the reference in the same sentence are the start of the reading.
      this.heard = words(text).slice(-SPOKEN_WINDOW)
      const p = this.passage
      const same = p && p.book === r.book && p.chapter === r.chapter && p.first === first && p.last === last
      const restated = p && p.book === r.book && p.chapter === r.chapter && r.end === undefined && r.start !== undefined && first >= p.first && first <= p.last && p.last > p.first
      if (restated) { this.heard = []; if (p.current !== first) this.set({ ...p, current: first }); return }
      if (!same) this.set({ book: r.book, chapter: r.chapter, first, last, current: first, wholeChapter: r.start === undefined })
      this.heard = []
      return
    }
    if (!this.passage) return

    // "official chapter six verse ten": a book was named but not recognised. This is not verse 10 of the open
    // passage; leave it for the app to work out (the AI reads it as Ephesians 6:10).
    const named = normalize(text).match(/(?:^| )(\S+) chapter \d+/)
    if (named && named[1].length >= 4 && !SAME_BOOK.test(named[1])) { this.heard = []; return }

    // A sentence that starts with "verse 28" finishes a reference begun in the previous sentence ("…Romans chapter eight" / "verse 28, and we know…").
    const lead = normalize(text).match(/^(?:and |at |from )?verses? (\d+)(?: (?:to|through) (\d+))?/)
    if (lead && this.apply({ kind: 'verse', verse: +lead[1], end: lead[2] ? +lead[2] : undefined })) return

    const intent = findIntent(text)
    // "…next verse, and knowing this…": the reading already carried the screen forward while it was spoken.
    if (intent?.kind === 'next' && moved) return
    if (intent && this.apply(intent)) return
    if (intent?.kind === 'chapter') return // a chapter it could not act on is not "verse N" of the open one

    const v = findVerseOnly(text)
    if (v && words(text).length <= 10) { this.apply({ kind: 'verse', verse: v.start, end: v.end }); return }

    this.heard = [...this.heard, ...words(text)].slice(-SPOKEN_WINDOW * 2)
    this.follow()
  }

  /** The sentence being spoken right now, re-sent as it grows. Lets the screen move mid-sentence. */
  hear(partialText: string): void {
    if (!this.passage) return
    this.partial = words(partialText)
    const before = this.passage.current
    this.follow()
    if (this.passage.current > before) this.movedWhileSpeaking = true
  }

  /** Open a passage directly (typed reference, clicked suggestion). */
  open(book: number, chapter: number, first?: number, last?: number): void {
    const count = this.bible.chapterVerseCount(book, chapter)
    if (!count) return
    const f = Math.min(first ?? 1, count)
    this.heard = []; this.partial = []
    this.set({ book, chapter, first: f, last: Math.min(last ?? (first ? f : count), count), current: f, wholeChapter: first === undefined })
  }

  /** Move to a verse of the open passage (operator click, arrow keys). */
  goto(verse: number): void {
    if (!this.passage) return
    const count = this.bible.chapterVerseCount(this.passage.book, this.passage.chapter)
    const v = Math.max(1, Math.min(verse, count))
    this.heard = []; this.partial = []
    this.set({ ...this.passage, current: v, first: Math.min(this.passage.first, v), last: Math.max(this.passage.last, v) })
  }

  step(d: number): void {
    if (this.passage) this.goto(this.passage.current + d)
  }

  /** Carries out spoken navigation. "lastScripture" needs the app's history, so it is reported through `onIntent`. */
  onIntent?: (i: Intent) => void

  apply(i: Intent): boolean {
    const p = this.passage
    if (!p) return false
    const count = this.bible.chapterVerseCount(p.book, p.chapter)
    this.heard = []; this.partial = []
    switch (i.kind) {
      case 'next': this.step(1); return true
      case 'previous': this.step(-1); return true
      case 'start': this.goto(p.first); return true
      case 'verse': {
        if (i.verse < 1 || i.verse > count) return false
        const inRange = i.verse >= p.first && i.verse <= p.last && p.last > p.first
        this.set({ ...p, first: i.verse, last: Math.min(i.end ?? (inRange ? p.last : i.verse), count), current: i.verse, wholeChapter: false })
        return true
      }
      case 'chapter': {
        // "chapter six verse ten" with no book means the book being preached from; the passage the app opens
        // at start-up is not one, so the book was probably missed by the recogniser.
        if (this.placeholder || !this.bible.chapterVerseCount(p.book, i.chapter)) return false
        this.open(p.book, i.chapter, i.verse, i.verse)
        return true
      }
      case 'chapterStep': {
        const c = p.chapter + i.delta
        if (c < 1 || !this.bible.chapterVerseCount(p.book, c)) return false
        this.open(p.book, c, i.verse ?? 1, i.verse ?? 1)
        return true
      }
      case 'lastScripture': this.onIntent?.(i); return !!this.onIntent
    }
  }

  /**
   * Where in the passage is the reader? Local alignment of the latest spoken words against the
   * passage text (current verse onward, plus the one before), anchored at the newest word.
   */
  private follow(): void {
    if (!this.autoFollow) return
    const p = this.passage!
    const total = this.bible.chapterVerseCount(p.book, p.chapter)
    // The announced range. Preachers often read on past it ("Ephesians 6:10", then 6:11, 6:12…), so the next
    // few verses are listened for too, but the screen only goes past the range once those words are heard.
    const hi = p.wholeChapter ? total : Math.max(p.last, p.current)
    const lo = Math.max(1, p.current - 1)
    const spoken = [...this.heard, ...this.partial].slice(-SPOKEN_WINDOW)
    if (spoken.length < 3) return

    const text: { w: string; verse: number; fromEnd: number }[] = []
    for (let v = lo; v <= Math.min(total, p.current + 3); v++) {
      const vw = words(this.bible.verseText(p.book, p.chapter, v) ?? '')
      vw.forEach((w, i) => text.push({ w, verse: v, fromEnd: vw.length - 1 - i }))
    }
    if (!text.length) return

    // Smith-Waterman: rows = spoken words, columns = passage words.
    const n = spoken.length, m = text.length
    let prev = new Float32Array(m + 1), cur = new Float32Array(m + 1)
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const match = same(spoken[i - 1], text[j - 1].w) ? (STOP.has(spoken[i - 1]) ? 1 : 2) : -1
        cur[j] = Math.max(0, prev[j - 1] + match, prev[j] - 0.8, cur[j - 1] - 0.8)
      }
      if (i < n) { [prev, cur] = [cur, prev]; cur.fill(0) }
    }
    // Best alignment that ends on the newest spoken word.
    let bestJ = -1, best = 0
    for (let j = 1; j <= m; j++) if (cur[j] > best || (cur[j] === best && j > bestJ && best > 0)) { best = cur[j]; bestJ = j }
    if (best < MIN_EVIDENCE || bestJ < 0) return

    const at = text[bestJ - 1]
    let target = at.verse
    if (at.fromEnd < END_ZONE && target < hi) target++ // finished this verse: show the next one now
    if (target === p.current) return
    if (target < p.current && best < MIN_EVIDENCE + 3) return // only go back on strong evidence
    if (target > hi && best < MIN_EVIDENCE + 2) return // reading on past the range: be sure first
    this.heard = this.heard.slice(-2); this.partial = []
    this.set({ ...p, current: target, last: Math.max(p.last, target) })
  }

  private set(p: Passage): void {
    this.placeholder = false
    this.passage = p
    this.onChange(p)
  }
}
