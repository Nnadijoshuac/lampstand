import type { Library } from './library'
import * as idb from './idb'
import { BOOKS } from '@shared/books'
import { trace } from './stt'

export interface Hit { book: number; chapter: number; verse: number; score: number }

const DIM = 384
const STOP = new Set('the a an and of to in is that it for was he his with as on be by at this but not are from you we they who which will shall unto thou thee thy ye'.split(' '))
const tok = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
const stem = (w: string) => w.replace(/(ing|ed|es|s|eth|est)$/, '')

/**
 * Finds verses by meaning. Keyword (BM25) search works immediately;
 * a sentence-embedding index builds in the background and takes over when ready.
 * The index is built on the KJV; hits are (book, chapter, verse) so they display in any version.
 */
export class VerseSearch {
  private keys: [number, number, number][] = []
  private at = new Map<string, number>()
  private df = new Map<string, number>()
  private docs: Map<string, number>[] = []
  private lens: number[] = []
  private avg = 1
  private vecs?: Float32Array
  private worker = new Worker(new URL('./searchWorker.ts', import.meta.url), { type: 'module' })
  private waiting = new Map<number, (v: Float32Array) => void>()
  private seq = 0
  semanticReady = false

  constructor(private lib: Library, private onStatus: (s: string) => void) {}

  build(): void {
    const base = this.lib.modules.get('KJV')!
    base.verses.forEach((v) => {
      this.at.set(`${v.book}:${v.chapter}:${v.verse}`, this.keys.length)
      this.keys.push([v.book, v.chapter, v.verse])
      const words = tok(v.text).map(stem)
      const tf = new Map<string, number>()
      for (const w of words) tf.set(w, (tf.get(w) ?? 0) + 1)
      for (const w of tf.keys()) this.df.set(w, (this.df.get(w) ?? 0) + 1)
      this.docs.push(tf)
      this.lens.push(words.length)
    })
    this.avg = this.lens.reduce((a, b) => a + b, 0) / this.lens.length
    void this.buildSemantic(base.verses.map((v) => v.text))
  }

  private async buildSemantic(texts: string[]): Promise<void> {
    try {
      let cached: Float32Array | undefined
      try {
        const r = await fetch('/embeddings-kjv.i8')
        if (r.ok) { const i8 = new Int8Array(await r.arrayBuffer()); cached = Float32Array.from(i8, (x) => x / 127) }
      } catch { /* fall back to building the index */ }
      await new Promise<void>((res, rej) => {
        this.worker.onmessage = (e) => {
          const m = e.data
          if (m.type === 'ready') res()
          else if (m.type === 'vectors') this.waiting.get(m.id)?.(m.data)
          else if (m.type === 'error') rej(new Error(m.message))
        }
        this.worker.postMessage({ type: 'load' })
      })
      if (cached && cached.length === texts.length * DIM) {
        this.vecs = cached
      } else {
        const out = new Float32Array(texts.length * DIM)
        const B = 64
        for (let i = 0; i < texts.length; i += B) {
          out.set(await this.embed(texts.slice(i, i + B)), i * DIM)
          if ((i / B) % 10 === 0) this.onStatus(`Learning scripture meaning… ${Math.round((i / texts.length) * 100)}%`)
        }
        this.vecs = out
        await idb.set('embeddings:KJV:minilm', out)
      }
      this.semanticReady = true
      this.onStatus('')
      trace('search: meaning ready')
    } catch (err) {
      this.onStatus('Meaning search unavailable: ' + (err as Error).message)
      console.error(err)
      trace('search: meaning failed ' + (err as Error).message)
    }
  }

  private embed(texts: string[]): Promise<Float32Array> {
    const id = ++this.seq
    return new Promise((res) => { this.waiting.set(id, res); this.worker.postMessage({ type: 'embed', id, texts }) })
  }

  /**
   * How close each verse is in meaning to `text` (cosine, about -1..1), or undefined while the
   * meaning index is still loading. Used to check verses the AI recalls before trusting them.
   */
  async similarity(text: string, refs: { book: number; chapter: number; verse: number }[]): Promise<number[] | undefined> {
    if (!this.semanticReady || !this.vecs) return
    const q = await this.embed([text])
    return refs.map((r) => {
      const i = this.at.get(`${r.book}:${r.chapter}:${r.verse}`)
      if (i === undefined) return -1
      let s = 0
      for (let d = 0, o = i * DIM; d < DIM; d++) s += q[d] * this.vecs![o + d]
      return s
    })
  }

  async query(text: string, n = 5): Promise<Hit[]> {
    const kw = this.bm25(text, 40)
    if (!this.semanticReady || !this.vecs) return kw.slice(0, n)
    const q = await this.embed([text])
    const sims: { i: number; s: number }[] = []
    for (let i = 0; i < this.keys.length; i++) {
      let s = 0
      const o = i * DIM
      for (let d = 0; d < DIM; d++) s += q[d] * this.vecs[o + d]
      sims.push({ i, s })
    }
    sims.sort((a, b) => b.s - a.s)
    const boost = new Map(kw.map((h, r) => [`${h.book}:${h.chapter}:${h.verse}`, 0.12 / (r + 1)]))
    return sims.slice(0, 30).map(({ i, s }) => {
      const [book, chapter, verse] = this.keys[i]
      return { book, chapter, verse, score: s + (boost.get(`${book}:${chapter}:${verse}`) ?? 0) }
    }).sort((a, b) => b.score - a.score).slice(0, n)
  }

  private bm25(text: string, n: number): Hit[] {
    const q = tok(text).map(stem)
    if (!q.length) return []
    const N = this.docs.length
    const scored: { i: number; s: number }[] = []
    for (let i = 0; i < N; i++) {
      let s = 0
      for (const w of q) {
        const f = this.docs[i].get(w)
        if (!f) continue
        const d = this.df.get(w) ?? 0
        const idf = Math.log(1 + (N - d + 0.5) / (d + 0.5))
        s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (this.lens[i] / this.avg))))
      }
      if (s > 0) scored.push({ i, s })
    }
    scored.sort((a, b) => b.s - a.s)
    return scored.slice(0, n).map(({ i, s }) => {
      const [book, chapter, verse] = this.keys[i]
      return { book, chapter, verse, score: s / (q.length * 4) }
    })
  }
}

export const refLabel = (h: { book: number; chapter: number; verse: number }) => `${BOOKS[h.book].name} ${h.chapter}:${h.verse}`
