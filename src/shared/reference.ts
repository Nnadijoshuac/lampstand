import { BOOKS } from './books'

export interface Reference { book: number; chapter: number; start?: number; end?: number }

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19
}
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
}
// "the fifth chapter", "twenty-first verse"
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17,
  eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50
}
Object.assign(ONES, ORDINALS)

/** Lowercase, strip punctuation, turn "3:16" into "3 16", and spoken numbers into digits. */
export function normalize(input: string): string {
  const words = input
    .toLowerCase()
    .replace(/\b(vice|versus)\b/g, 'verse') // how recognisers often hear "verse"
    .replace(/(\d+)\s*[:.]\s*(\d+)/g, '$1 verse $2')
    .replace(/[–—]/g, ' to ')
    .replace(/(\d+)\s*-\s*(\d+)/g, '$1 to $2')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/([a-z])(\d)/g, '$1 $2') // "jn1" -> "jn 1", "chapter3" -> "chapter 3"
    .split(/\s+/)
    .filter(Boolean)

  const out: string[] = []
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w === 'hundred' && out.length && /^\d+$/.test(out[out.length - 1]) && +out[out.length - 1] < 10) {
      out[out.length - 1] = String(+out[out.length - 1] * 100)
      continue
    }
    // "Tony three": how the recogniser often hears "twenty-three"
    const tens = w === 'tony' && ONES[words[i + 1]] > 0 && ONES[words[i + 1]] < 10 ? 'twenty' : w
    if (tens in TENS) {
      let n = TENS[tens]
      if (words[i + 1] in ONES && ONES[words[i + 1]] > 0 && ONES[words[i + 1]] < 10) { n += ONES[words[i + 1]]; i++ }
      out.push(String(n))
    } else if (w in ONES) out.push(String(ONES[w]))
    else out.push(w)
  }
  // "one hundred and fifty" -> 100 and 50 -> 150
  for (let i = 1; i < out.length - 1; i++) {
    if (out[i] === 'and' && /^\d+$/.test(out[i - 1]) && /^\d+$/.test(out[i + 1]) && +out[i - 1] % 100 === 0 && +out[i + 1] < 100) {
      out.splice(i - 1, 3, String(+out[i - 1] + +out[i + 1]))
      i--
    }
  }
  return out.join(' ')
    // "the first epistle of Peter" -> "the 1 peter", "the gospel according to John" -> "the john"
    .replace(/\b(epistle|letter|gospel|book)( (of|to|according to))?( the)?( (saint|st))? (?=[a-z])/g, '')
}

interface Alias { text: string; book: number; typedOnly: boolean }
const ORD = ['', 'first', 'second', 'third']
const ROMAN = ['', 'i', 'ii', 'iii']
const ALIASES: Alias[] = (() => {
  const list: Alias[] = []
  BOOKS.forEach((b, i) => {
    const num = b.name.match(/^(\d) (.+)$/)
    const base = [num ? num[2].toLowerCase() : b.name.toLowerCase(), ...b.aliases]
    for (const a of base) {
      // Short abbreviations ("jn", "is", "so") are ordinary words in speech, so only typed input uses them.
      const typedOnly = a !== base[0] && a.length < 5 && !a.includes(' ')
      const forms = num ? [`${num[1]} ${a}`, `${num[1]}${a}`, `${ORD[+num[1]]} ${a}`, `${ROMAN[+num[1]]} ${a}`] : [a]
      // "First Samuel" often comes through as "for Samuel". Only for books that never stand alone, so "for John 3:16" stays John.
      if (num?.[1] === '1' && /^(samuel|kings|chronicles|corinthians|thessalonians|timothy)$/.test(a)) forms.push(`for ${a}`)
      for (const f of forms) list.push({ text: f, book: i, typedOnly })
    }
  })
  return list.sort((a, b) => b.text.length - a.text.length)
})()

const FILLER = /^(chapter|chapters|ch)$/
const VERSE_WORDS = /^(verse|verses|vs|v)$/

/**
 * Find every book+chapter(+verses) mention in a transcript chunk.
 * Accepts "John 3 verse 16", "John chapter 3 verses 16 to 18", "John 3:16-18".
 */
export function findReferences(text: string, typed = false): Reference[] {
  const tokens = normalize(text).split(' ')
  const refs: Reference[] = []
  for (let i = 0; i < tokens.length; i++) {
    let matched: { book: number; len: number } | undefined
    for (const a of ALIASES) {
      if (a.typedOnly && !typed) continue
      const parts = a.text.split(' ')
      if (parts.every((p, k) => tokens[i + k] === p)) { matched = { book: a.book, len: parts.length }; break }
    }
    if (!matched && (/^\d+$/.test(tokens[i + 1] ?? '') || FILLER.test(tokens[i + 1] ?? ''))) matched = fuzzyBook(tokens[i], tokens[i - 1], FILLER.test(tokens[i + 1] ?? ''))
    if (!matched) continue
    let j = i + matched.len
    if (tokens[j] === 'for' && /^\d+$/.test(tokens[j + 1] ?? '')) tokens[j] = '4' // "first John for eight" is 1 John 4:8
    const num = (k: number) => /^\d+$/.test(tokens[k] ?? '')
    let chapter: number
    if (FILLER.test(tokens[j] ?? '') && num(j + 1)) { chapter = +tokens[j + 1]; j += 2 } // "chapter 5"
    else if (tokens[j] === 'the' && num(j + 1) && FILLER.test(tokens[j + 2] ?? '')) { chapter = +tokens[j + 1]; j += 3 } // "the fifth chapter"
    else if (num(j)) { chapter = +tokens[j++]; if (FILLER.test(tokens[j] ?? '')) j++ }
    else continue
    const ref: Reference = { book: matched.book, chapter }
    // "and verse 6", "from verse 6", "starting at verse 6"
    let v = j
    while (/^(and|from|at|starting|beginning|reading|in)$/.test(tokens[v] ?? '')) v++
    if (VERSE_WORDS.test(tokens[v] ?? '') && num(v + 1)) {
      ref.start = +tokens[v + 1]
      j = v + 2
      if (/^(to|through|till|until|thru)$/.test(tokens[j] ?? '') && num(j + 1)) { ref.end = +tokens[j + 1]; j += 2 }
    } else if (num(j)) {
      // "jn 3 16" typed, or "John one twenty-four" spoken (recognisers often drop the colon)
      ref.start = +tokens[j++]
      if (/^\d+$/.test(tokens[j] ?? '') || (tokens[j] === 'to' && /^\d+$/.test(tokens[++j] ?? ''))) ref.end = +tokens[j++]
    }
    refs.push(ref)
    i = j - 1
  }
  return refs
}

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const t = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = t
    }
  }
  return d[b.length]
}

/** Rough sound of a word, so "Havakuck" and "Habakkuk" compare as equal: v/b, ph/f, c/k/q, z/s merge and doubles collapse. */
function soundKey(w: string): string {
  return w
    .replace(/ph/g, 'f').replace(/v/g, 'b').replace(/(ck|q|c(?=[aou])|kh)/g, 'k').replace(/z/g, 's').replace(/th/g, 't')
    .replace(/(.)\1+/g, '$1')
}

/** Everyday words that sit one letter from a book name ("number one" is not Numbers). */
const NOT_BOOKS = new Set(['number', 'numbered', 'james', 'mark', 'marks', 'judge', 'judges', 'genesis', 'romance', 'acts', 'act', 'lamentation', 'revelation', 'proverb', 'ruth', 'job', 'jobs'])

/**
 * Speech recognisers and accents bend book names ("Philippines", "Habakuk", "romance", "genes").
 * Only used when a number or the word "chapter" follows, so ordinary words are never mistaken for books.
 * "Chapter" is strong evidence a book was meant, so then everyday words count too and the match may be looser.
 */
/** How the recogniser has actually heard some book names in services (only trusted before a number or "chapter"). */
const MISHEARD: Record<string, string> = { efficient: 'Ephesians', official: 'Ephesians', ephesian: 'Ephesians', effusions: 'Ephesians', affusions: 'Ephesians', romance: 'Romans', genes: 'Genesis' }

function fuzzyBook(word: string, before: string | undefined, chapterNext = false): { book: number; len: number } | undefined {
  const known = MISHEARD[word]
  if (known && (chapterNext || !NOT_BOOKS.has(word))) return { book: BOOKS.findIndex((b) => b.name === known), len: 1 }
  if (!word || word.length < 5 || (!chapterNext && NOT_BOOKS.has(word))) return
  let best: { book: number; d: number } | undefined
  BOOKS.forEach((b, i) => {
    const m = b.name.match(/^(\d) (.+)$/)
    const base = (m ? m[2] : b.name).toLowerCase()
    if (base.includes(' ')) return
    if (m && before !== m[1]) return // "2 Corinthians" needs its number; "Corinthians" alone matches neither
    let d = Math.min(editDistance(word, base), editDistance(soundKey(word), soundKey(base)))
    if (chapterNext && base.startsWith(word)) d = Math.min(d, 1) // "genes chapter three"
    const loose = base.length >= 8 || (chapterNext && word[0] === base[0]) // "romance chapter", never "later chapter"
    if (d <= (loose ? 2 : 1) && (!best || d < best.d)) best = { book: i, d }
  })
  return best && { book: best.book, len: 1 }
}

/** Bare "verse 17" / "verses 3 to 5" with no book, used while a passage is open. */
export function findVerseOnly(text: string): { start: number; end?: number } | undefined {
  const t = normalize(text).split(' ')
  for (let i = 0; i < t.length - 1; i++) {
    if (VERSE_WORDS.test(t[i]) && /^\d+$/.test(t[i + 1])) {
      const r: { start: number; end?: number } = { start: +t[i + 1] }
      if (t[i + 2] === 'to' && /^\d+$/.test(t[i + 3] ?? '')) r.end = +t[i + 3]
      return r
    }
  }
}
