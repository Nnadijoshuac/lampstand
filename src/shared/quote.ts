/**
 * Spots a verse being quoted inside a spoken sentence ("…this is my beloved son, in whom I am well pleased…").
 * It is fast (an inverted index over the whole Bible, a fraction of a millisecond per sentence) and strict: a verse
 * counts as quoted only when the sentence shares several of its distinctive words and repeats short runs of
 * them in order. Loose descriptions are left to the slower meaning search and the AI.
 */

const STOP = new Set(('the a an and of to in is that it for was he his with as on be by at this but not are from you we they who which will shall unto ' +
  'thou thee thy ye i me my him her them their our us your have has had hath do did does so if or there what when all one said say says saith then now ' +
  'also upon into out up no yea o oh let came come go went even every like just know see look thing things people bible somebody anybody everybody ' +
  'gonna want yes okay amen hallelujah praise am were been being can could would should may might must very more most much such some any these those ' +
  'here where why how whom whose its about over after before again still because than too only own same other another off down ' +
  'year years day days morning night today time times many first last two three four five six seven eight nine twenty thirty forty fifty hundred').split(' '))

/** Words every prayer and sermon is full of ("in the name of Jesus", "the power of the Holy Spirit"): no evidence of a quote. */
const DEVOTIONAL = new Set(['god', 'lord', 'jesu', 'christ', 'holy', 'spirit', 'name', 'power', 'father', 'heaven', 'heavenly'])

/** "loveth", "loved", "love" and "loves" all become "lov". */
const stem = (w: string) => w.replace(/(ing|ed|es|s|eth|est)$/, '').replace(/e$/, '')

/** The distinctive words of a text, stemmed, in order. */
export function contentStems(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w)).map(stem).filter((w) => w.length > 1 && !DEVOTIONAL.has(w))
}

export interface QuoteVerse { book: number; chapter: number; verse: number; text: string }

export interface QuoteHit {
  book: number
  chapter: number
  verse: number
  /** Distinct verse words that were said. */
  matched: number
  /** Pairs of neighbouring verse words said in the same order. */
  runs: number
  /** Share of the verse's distinct words that were said. */
  coverage: number
  /** Rarity of the matched words (sum of IDF), and of those inside runs. */
  weight: number
  runWeight: number
  score: number
  index: number
}

export class QuoteIndex {
  private stems: string[][] = []
  private postings = new Map<string, number[]>()
  private idf = new Map<string, number>()
  private chapters = new Map<string, number[]>()

  constructor(private verses: QuoteVerse[]) {
    verses.forEach((v, i) => {
      const s = contentStems(v.text)
      this.stems.push(s)
      for (const w of new Set(s)) {
        let list = this.postings.get(w)
        if (!list) this.postings.set(w, (list = []))
        list.push(i)
      }
      const ch = `${v.book}:${v.chapter}`
      let list = this.chapters.get(ch)
      if (!list) this.chapters.set(ch, (list = []))
      list.push(i)
    })
    const n = verses.length
    for (const [w, list] of this.postings) this.idf.set(w, Math.log(1 + n / list.length))
  }

  private measure(i: number, where: Map<string, number[]>): QuoteHit | undefined {
    const vs = this.stems[i]
    const distinct = new Set(vs)
    const matched = [...distinct].filter((w) => where.has(w))
    if (!matched.length) return
    const weight = matched.reduce((s, w) => s + (this.idf.get(w) ?? 0), 0)
    let runs = 0
    const inRuns = new Set<string>()
    for (let k = 0; k + 1 < vs.length; k++) {
      const a = where.get(vs[k]), b = where.get(vs[k + 1])
      if (a && b && a.some((x) => b.some((y) => y > x && y - x <= 2))) { runs++; inRuns.add(vs[k]); inRuns.add(vs[k + 1]) }
    }
    const coverage = matched.length / distinct.size
    const runWeight = [...inRuns].reduce((s, w) => s + (this.idf.get(w) ?? 0), 0)
    const v = this.verses[i]
    return { book: v.book, chapter: v.chapter, verse: v.verse, matched: matched.length, runs, coverage, weight, runWeight, index: i, score: weight * (0.4 + coverage) + runs * 4 }
  }

  private positions(sentence: string): Map<string, number[]> {
    const where = new Map<string, number[]>()
    contentStems(sentence).forEach((w, i) => { const p = where.get(w); if (p) p.push(i); else where.set(w, [i]) })
    return where
  }

  /** Candidate verses across the Bible, ranked by how much of them the sentence quotes. */
  rank(sentence: string, limit = 5): QuoteHit[] {
    const where = this.positions(sentence)
    if (where.size < 3) return []
    // Verses sharing at least two distinctive words nominate themselves. Very common words (in more than 3% of verses) do not.
    const shared = new Map<number, number>()
    const cap = this.verses.length * 0.03
    for (const w of where.keys()) {
      const list = this.postings.get(w)
      if (!list || list.length > cap) continue
      for (const i of list) shared.set(i, (shared.get(i) ?? 0) + 1)
    }
    const hits: QuoteHit[] = []
    for (const [i, rare] of shared) {
      if (rare < 2) continue
      const h = this.measure(i, where)
      if (h && h.matched >= 3) hits.push(h)
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, limit)
  }

  /** The verse being quoted, when the evidence is clear. */
  find(sentence: string): QuoteHit | undefined {
    const [best, next] = this.rank(sentence, 2)
    if (!best) return
    const strong =
      // a phrase or two of the verse, in order, made of words that mean something
      (best.runs >= 2 && (best.coverage >= 0.4 || best.matched >= 5 || best.runs >= 3 || (best.runWeight >= 12 && best.coverage >= 0.25))) ||
      // nearly the whole verse, even reworded, in words that are not everyday ("the temptation ended, Satan departed for a season")
      (best.coverage >= 0.75 && best.matched >= 4 && best.weight >= 18)
    // The best must stand out, unless the runner-up says the same thing (parallel passages in the Gospels).
    const clear = !next || best.score >= next.score * 1.15 || this.alike(best.index, next.index)
    return strong && clear ? best : undefined
  }

  /**
   * The verse of an open chapter being read out. The chapter is already on screen, so less evidence is needed:
   * "he that loveth not, knoweth not God" is 1 John 4:8 once 1 John 4 is open.
   */
  inChapter(sentence: string, book: number, chapter: number): QuoteHit | undefined {
    const where = this.positions(sentence)
    if (where.size < 2) return
    const hits = (this.chapters.get(`${book}:${chapter}`) ?? [])
      .map((i) => this.measure(i, where))
      .filter((h): h is QuoteHit => !!h && h.matched >= 2 && h.runs >= 1 && (h.coverage >= 0.3 || h.matched >= 4))
      .sort((a, b) => b.score - a.score)
    const [best, next] = hits
    return best && (!next || best.score >= next.score * 1.2) ? best : undefined
  }

  /** Two verses with mostly the same words ("This is my beloved Son, in whom I am well pleased"). */
  private alike(a: number, b: number): boolean {
    const x = new Set(this.stems[a]), y = new Set(this.stems[b])
    const both = [...x].filter((w) => y.has(w)).length
    return both / Math.min(x.size, y.size) >= 0.6
  }
}
