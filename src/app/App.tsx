import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import { BOOKS } from '@shared/books'
import { findReferences, normalize } from '@shared/reference'
import { findVersion } from '@shared/versions'
import { VerseTracker, type Passage } from '@shared/tracker'
import { QuoteIndex } from '@shared/quote'
import { Library } from './library'
import { VerseSearch, refLabel, type Hit } from './search'
import { MARGIN, ROWS, sameLayout, screenLeftover, settle, type Item } from './layout'
import { BarkEngine, Listener, isDesktop, trace, type SttEngine } from './stt'
import { linked, related, xrefsReady } from './xref'
import { CUE, aiReady, recall, rerank, route, type Action } from './ai'
import { DEFAULT_STYLE, SlideView, themeScale } from './Output'
import { Slider, SpringPill, WindowControls, glideIndicators } from './controls'
import { closeProjector, openProjector } from './projector'
import { importBibleShowFolder, loadThemes, saveThemes } from './themes'
import type { SlideTheme } from '@shared/bsTheme'
import type { CatalogEntry } from '@shared/lampBible'
import { ACTIONS, DEFAULT_BINDINGS, actionFor, comboOf, pretty, type ActionId, type Bindings } from './shortcuts'
import { bus, type BusMessage, type OutputStyle, type Slide } from './bus'

const lib = new Library()
/** Where the free translations live (the Lampstand website). */
const SITE = 'https://nnadijoshuac.github.io/lampstand/'
const CATALOG = SITE + 'bibles/'
const engine: SttEngine = new BarkEngine()
const Grid = WidthProvider(Responsive)
let engineReady: Promise<string> | undefined
const loadEngine = (cb: (p: number) => void = () => {}) => (engineReady ??= engine.load(cb))

// 48 fine rows fill the window, so heights can follow content (see layout.ts).
const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'reference', x: 0, y: 0, w: 2, h: 48 },
    { i: 'scripture', x: 2, y: 0, w: 4, h: 48 },
    { i: 'screen', x: 6, y: 0, w: 3, h: 16 },
    { i: 'related', x: 6, y: 16, w: 3, h: 32 },
    { i: 'suggest', x: 9, y: 0, w: 3, h: 20 },
    { i: 'find', x: 9, y: 20, w: 3, h: 12 },
    { i: 'heard', x: 9, y: 32, w: 3, h: 8 },
    { i: 'history', x: 9, y: 40, w: 3, h: 8 }
  ],
  md: [
    { i: 'reference', x: 0, y: 0, w: 2, h: 48 },
    { i: 'scripture', x: 2, y: 0, w: 4, h: 48 },
    { i: 'screen', x: 6, y: 0, w: 4, h: 16 },
    { i: 'suggest', x: 6, y: 16, w: 4, h: 12 },
    { i: 'related', x: 6, y: 28, w: 4, h: 12 },
    { i: 'find', x: 6, y: 40, w: 2, h: 8 },
    { i: 'heard', x: 8, y: 40, w: 2, h: 4 },
    { i: 'history', x: 8, y: 44, w: 2, h: 4 }
  ],
  sm: ['scripture', 'screen', 'reference', 'suggest', 'related', 'find', 'heard', 'history'].map((i, n) => ({ i, x: 0, y: n * 30, w: 1, h: 30 }))
} as any
const COLS = { lg: 12, md: 10, sm: 1 } as const

function useSaved<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { return JSON.parse(localStorage.getItem(key) ?? '') as T } catch { return init } })
  return [v, (n: T) => { setV(n); try { localStorage.setItem(key, JSON.stringify(n)) } catch { /* ignore */ } }]
}

function Widget({ title, right, children, className }: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className="widget">
      <div className="w-head drag"><h3>{title}</h3><div className="w-right">{right}</div></div>
      <div className={'w-body ' + (className ?? '')}>{children}</div>
    </div>
  )
}

type Line = { text: string; at: number }

const STOPWORDS = new Set('the a an and of to in is it that for was he his him with as on be by at this but not are from you we they who which will shall unto thou thee thy ye i my me our us so if or there where said say says remember when what how then than into upon them their all have hath had do did done like just one also about'.split(' '))
const stemOf = (w: string) => w.replace(/(eth|est|ing|ed|es|s)$/, '')
const contentList = (s: string) => normalize(s).split(' ').filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w)).map(stemOf)
const contentWords = (s: string) => new Set(contentList(s))
/** True when the verse's words appear one after another in what was said ("the Bible tells us, Jesus wept"). */
const saidAsPhrase = (verse: string, said: string) => {
  const v = contentList(verse), s = contentList(said)
  return v.length > 0 && s.some((_, i) => v.every((w, k) => s[i + k] === w))
}
/** Share of the spoken content words that also appear in the verse (0..1). */
function wordOverlap(said: string, verse: string): number {
  const a = contentWords(said), b = contentWords(verse)
  if (!a.size) return 0
  let hit = 0
  for (const w of a) if (b.has(w)) hit++
  return hit / a.size
}

/** Bible Show marks footnotes with "*". The operator sees a small marker with the note on hover; the screen shows nothing. */
function operatorHtml(html: string, notes: string[]): string {
  let n = 0
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  return html.replace(/<p>/g, ' ').replace(/<span class='Isus'>/g, "<span class='jesus'>").replace(/\*/g, () => {
    const note = notes[n++]
    return note ? `<sup class="fn" title="${esc(note)}">${n}</sup>` : ''
  })
}

export function App() {
  const [ready, setReady] = useState(false)
  const [preferred, setPreferred] = useSaved('sf-preferred', 'KJV')
  const preferredRef = useRef(preferred)
  preferredRef.current = preferred
  const [version, setVersion] = useState(() => { try { return JSON.parse(localStorage.getItem('sf-preferred') ?? '"KJV"') as string } catch { return 'KJV' } })
  /** When the current translation was explicitly asked for (spoken, AI route or operator). */
  const versionUsedAt = useRef(Date.now())
  const [passage, setPassage] = useState<Passage>()
  const [live, setLive] = useState(true) // the screen opens on Genesis 1:1, not blank
  const [mode, setMode] = useSaved<'autopilot' | 'assist'>('sf-mode', 'autopilot')
  const auto = mode === 'autopilot'
  const [held, setHeld] = useState(false)
  const [aiOk, setAiOk] = useState(false)
  const [versionFilter, setVersionFilter] = useState('')
  const [refTab, setRefTab] = useState<'books' | 'translations'>('books')
  /** Picking an animation style flips the preview to the next verse so the transition is actually shown. */
  const [previewStep, setPreviewStep] = useState(0)
  const [bindings, setBindings] = useSaved<Bindings>('sf-keys-single', DEFAULT_BINDINGS)
  const bindingsRef = useRef(bindings)
  bindingsRef.current = { ...DEFAULT_BINDINGS, ...bindings }
  /** The shortcut slot being recorded ([action, index]); index === length means "add a new one". */
  const [recording, setRecording] = useState<[ActionId, number] | null>(null)
  const recordingRef = useRef(recording)
  recordingRef.current = recording
  const [conflict, setConflict] = useState<{ combo: string; target: [ActionId, number]; owner: ActionId } | null>(null)
  const [settingsTab, setSettingsTab] = useState<'appearance' | 'projector' | 'operator' | 'ai' | 'keyboard'>('appearance')
  const [lines, setLines] = useState<Line[]>([])
  const [hits, setHits] = useState<Hit[]>([])
  const [status, setStatus] = useState('Loading scripture…')
  const [searchStatus, setSearchStatus] = useState('')
  const [listening, setListening] = useState(false)
  const [level, setLevel] = useState(0)
  const [modelPct, setModelPct] = useState<number | null>(null)
  const [command, setCommand] = useState('')
  const [style, setStyle] = useSaved<OutputStyle>('sf-screen-style', DEFAULT_STYLE)
  /** Themes imported from Bible Show. The chosen one travels with the style to the projector. */
  const [themes, setThemes] = useState<SlideTheme[]>([])
  useEffect(() => { void loadThemes().then(setThemes) }, [])
  const look = style.lookId ? themes.find((t) => t.id === style.lookId) : undefined
  const screenStyle: OutputStyle = { ...style, look }
  const [versions, setVersions] = useState<string[]>(['KJV'])
  const [msg, setMsg] = useState('')
  const [msgLeaving, setMsgLeaving] = useState(false)
  // Notifications stay about ten seconds, then fade out.
  useEffect(() => {
    if (!msg) return
    setMsgLeaving(false)
    const fade = setTimeout(() => setMsgLeaving(true), 9600)
    const clear = setTimeout(() => setMsg(''), 10000)
    return () => { clearTimeout(fade); clearTimeout(clear) }
  }, [msg])
  const [theme, setTheme] = useSaved<'dark' | 'cream'>('sf-theme', 'dark')
  const [layouts, setLayouts] = useSaved<any>('sf-layouts-8', DEFAULT_LAYOUTS)
  const [interim, setInterim] = useState('')
  const [findText, setFindText] = useState('')
  const [found, setFound] = useState<Hit[]>([])
  const [tab, setTab] = useState<'live' | 'bibles' | 'settings'>('live')
  const [refText, setRefText] = useState('')
  const [bookFilter, setBookFilter] = useState('')
  const [frozen, setFrozen] = useState(false)
  const [frozenSlide, setFrozenSlide] = useState<Slide>()
  const [program, setProgram] = useSaved<{ book: number; chapter: number; verse: number; end: number }[]>('sf-program', [])
  const [programAt, setProgramAt] = useState(-1)
  const [sideTab, setSideTab] = useState<'program' | 'history'>('program')
  const findBox = useRef<HTMLInputElement>(null)
  const [breathing, setBreathing] = useSaved('sf-breathing', true)
  const [glide, setGlide] = useSaved('sf-glide', true)
  const [xrefOk, setXrefOk] = useState(false)
  useEffect(() => { void xrefsReady().then(() => setXrefOk(true)) }, [])
  const [history, setHistory] = useState<{ book: number; chapter: number; verse: number }[]>([])
  const historyRef = useRef(history)
  historyRef.current = history
  const [gridH, setGridH] = useState(() => window.innerHeight - 56)
  const stageRef = useRef<HTMLDivElement>(null)
  const [stageW, setStageW] = useState(() => window.innerWidth)
  const [bp, setBp] = useState<'lg' | 'md' | 'sm'>('lg')
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => { setStageW(el.clientWidth); setGridH(el.clientHeight) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The native title bar follows the app's appearance too.
  useEffect(() => { if (isDesktop) void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => getCurrentWindow().setTheme(theme === 'dark' ? 'dark' : 'light')).catch(() => {}) }, [theme])
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme])
  useEffect(() => { const f = () => setGridH(window.innerHeight - 56); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  useEffect(() => { const t = setTimeout(async () => { setFound(findText.trim().length > 2 && searchRef.current ? await searchRef.current.query(findText, 8) : []) }, 250); return () => clearTimeout(t) }, [findText])

  const trackerRef = useRef<VerseTracker>()
  /** Set when a new passage is looked up; the first verse of it to reach the projector goes into History. */
  const pendingHistory = useRef(false)
  const searchRef = useRef<VerseSearch>()
  /** Finds verses quoted word for word, instantly; built from the KJV after start-up. */
  const quoteRef = useRef<QuoteIndex>()
  const lastFinal = useRef({ text: '', at: 0 })
  /** Chapters the preacher has named in this service, newest first: the sermon's own passages. */
  const namedChapters = useRef<{ book: number; chapter: number }[]>([])
  const listenerRef = useRef<Listener>()
  useEffect(() => { void aiReady().then(setAiOk) }, [])
  const heldRef = useRef(false)
  const liveRef = useRef(live), autoRef = useRef(auto), versionRef = useRef(version), passageRef = useRef<Passage>()
  liveRef.current = live; autoRef.current = auto; versionRef.current = version; passageRef.current = passage

  const makeTracker = useCallback((v: string, keep?: Passage) => {
    const t = new VerseTracker(lib.lookup(v), (p) => {
      const prev = passageRef.current
      const newPassage = !prev || prev.book !== p.book || prev.chapter !== p.chapter
      if (newPassage && prev) pendingHistory.current = true
      const pref = preferredRef.current
      if (newPassage && versionRef.current !== pref && Date.now() - versionUsedAt.current > 2 * 60_000 && lib.modules.has(pref)) {
        trace(`version ${pref} (back to preferred)`)
        versionRef.current = pref
        setVersion(pref)
        queueMicrotask(() => makeTrackerRef.current?.(pref, p))
      }
      setPassage(p)
    })
    trackerRef.current = t
    t.autoFollow = autoRef.current && !heldRef.current
    // "Go back to the previous scripture": the latest History entry from a different passage.
    t.onIntent = () => {
      const p = t.passage
      const prev = historyRef.current.find((h) => !p || h.book !== p.book || h.chapter !== p.chapter)
      if (prev) { pendingHistory.current = true; t.open(prev.book, prev.chapter, prev.verse, prev.verse) }
    }
    if (keep) { t.open(keep.book, keep.chapter, keep.first, keep.last); t.goto(keep.current) }
    return t
  }, [])
  const makeTrackerRef = useRef(makeTracker)
  makeTrackerRef.current = makeTracker

  useEffect(() => {
    (async () => {
      await lib.load()
      setVersions([...lib.modules.keys()])
      const start = lib.modules.has(versionRef.current) ? versionRef.current : 'KJV'
      if (start !== versionRef.current) setVersion(start)
      const first = makeTracker(start)
      first.open(0, 1, 1, 1)
      first.placeholder = true
      const s = new VerseSearch(lib, setSearchStatus)
      searchRef.current = s
      setTimeout(() => {
        const kjv = lib.modules.get('KJV')
        if (kjv) quoteRef.current = new QuoteIndex(kjv.verses.map((v) => ({ book: v.book, chapter: v.chapter, verse: v.verse, text: v.text })))
      }, 1500)
      s.build()
      setReady(true)
      void loadEngine().catch((e) => { engineReady = undefined; setStatus('Speech model failed: ' + e.message) })
      setStatus('Ready')
    })().catch((e) => setStatus('Could not load scripture: ' + e))
  }, [makeTracker])

  const slideFor = useCallback((p: Passage | undefined, v: string): Slide => {
    if (!p) return { reference: '', version: v, html: '', blank: true }
    const verse = lib.verse(v, p.book, p.chapter, p.current) ?? lib.verse('KJV', p.book, p.chapter, p.current)
    const html = (verse?.html ?? '').replace(/<p>/g, '<br/>').replace(/<span class='Isus'>/g, "<span class='jesus'>").replace(/\*/g, '')
    return { reference: `${BOOKS[p.book].name} ${p.chapter}:${p.current} (${v})`, version: '', html }
  }, [])

  // Push to the projector whenever the verse changes and we're live.
  useEffect(() => {
    if (frozen) return
    bus.postMessage({ type: 'slide', slide: live ? slideFor(passage, version) : { reference: '', version, html: '', blank: true } } satisfies BusMessage)
  }, [passage, live, version, slideFor, frozen])
  useEffect(() => { setFrozenSlide(frozen ? (live ? slideFor(passageRef.current, versionRef.current) : { reference: '', version: '', html: '', blank: true }) : undefined) }, [frozen])
  useEffect(() => { bus.postMessage({ type: 'style', style: screenStyle } satisfies BusMessage) }, [style, look])
  useEffect(() => {
    bus.onmessage = (e: MessageEvent<BusMessage>) => {
      if (e.data.type !== 'hello') return
      bus.postMessage({ type: 'style', style: screenStyle } satisfies BusMessage)
      bus.postMessage({ type: 'slide', slide: liveRef.current ? slideFor(passageRef.current, versionRef.current) : { reference: '', version: versionRef.current, html: '', blank: true } } satisfies BusMessage)
    }
  })

  useEffect(() => { if (trackerRef.current) trackerRef.current.autoFollow = auto && !held }, [auto, held])

  /** A person moved the screen: Autopilot steps back until the next spoken reference. */
  function takeOver() {
    if (!autoRef.current) return
    heldRef.current = true
    setHeld(true)
    if (trackerRef.current) trackerRef.current.autoFollow = false
  }
  function resumeAutopilot() {
    heldRef.current = false
    setHeld(false)
    if (trackerRef.current) trackerRef.current.autoFollow = autoRef.current
  }

  /** "…in the Amplified Classic" switches translation, keeping the verse. */
  const switchVersionFromSpeech = useCallback((text: string) => {
    const v = findVersion(text, [...lib.modules.values()].map((m) => ({ short: m.short, name: m.name })))
    if (v && v !== versionRef.current) { trace(`version ${v} (spoken: ${text})`); versionUsedAt.current = Date.now(); versionRef.current = v; setVersion(v); makeTracker(v, trackerRef.current?.passage) }
  }, [makeTracker])

  /** Applies an AI action after checking the words really support it (small models can invent things). */
  const applyAction = useCallback((a: Action, said: string): boolean => {
    const t = trackerRef.current
    if (!t) return false
    const nums = new Set((normalize(said).match(/\d+/g) ?? []).map(Number))
    if (a.action === 'open' && a.book && a.chapter && nums.has(a.chapter)) {
      const r = findReferences(`${a.book} ${a.chapter}`, true)[0]
      const named = r && normalize(said).includes(BOOKS[r.book].name.toLowerCase().replace(/^\d /, '').slice(0, 4))
      if (!r || !named || (a.verse && !nums.has(a.verse))) return false
      pendingHistory.current = true
      resumeAutopilot()
      t.open(r.book, a.chapter, a.verse, a.end && nums.has(a.end) ? a.end : a.verse)
      return true
    }
    if (a.action === 'verse' && a.verse && nums.has(a.verse) && t.passage) { t.goto(a.verse); return true }
    if (a.action === 'next' && /\b(next|on|forward|following)\b/i.test(said)) { t.step(1); return true }
    if (a.action === 'previous' && /\b(previous|back|before|last)\b/i.test(said)) { t.step(-1); return true }
    if (a.action === 'version' && a.version && lib.modules.has(a.version.toUpperCase())) {
      const v = a.version.toUpperCase()
      trace(`version ${v} (AI route: ${said})`); versionUsedAt.current = Date.now(); versionRef.current = v; setVersion(v); makeTracker(v, t.passage)
      return true
    }
    return false
  }, [makeTracker])

  const speechSeq = useRef(0)
  const allusionSeq = useRef(0)
  const allusionBusy = useRef(false)
  const pendingLatest = useRef<string>()
  const lastPick = useRef({ key: '', strength: 0, at: 0 })
  /** When the preacher last named a passage outright; for a while only near-certain matches may replace it. */
  const namedAt = useRef(0)
  /** Top search result of the previous search, to spot one that stays on top across sentences. */
  const lastTop = useRef('')
  const pendingAllusion = useRef<string>()
  /** Recent finished sentences: a description is often split across pauses, so the search reads them together. */
  const recentFinals = useRef<{ text: string; at: number }[]>([])

  /**
   * Finds the verse a preacher is quoting or describing, even loosely ("the eye of a needle").
   * Meaning search and the AI's own recall run side by side; every candidate is checked against
   * what was said, then the AI picks. Suggestions update as each step lands.
   */
  const screenKey = () => { const p = trackerRef.current?.passage; return p ? `${p.book}:${p.chapter}:${p.current}` : '' }

  /** True when the words are the text of the open passage being read aloud. */
  function isReadingOpenPassage(text: string, p: Passage, min = 0.6): boolean {
    let around = ''
    for (let v = Math.max(1, p.current - 1); v <= p.current + 2; v++) around += ' ' + (verseText({ book: p.book, chapter: p.chapter, verse: v }) ?? '')
    return contentWords(text).size >= 2 && wordOverlap(text, around) >= min
  }

  /** Joins sentences from the last 6 seconds; undefined when there is too little to search on. */
  function describedText(text: string): string | undefined {
    const now = Date.now()
    recentFinals.current = [...recentFinals.current.filter((f) => now - f.at < 8000), { text, at: now }].slice(-4)
    const joined = recentFinals.current.map((f) => f.text).join(' ')
    return contentWords(joined).size >= 4 ? joined : undefined
  }

  const findAllusion = useCallback(async (text: string, seq: number, latest = text): Promise<{ hits: Hit[]; pick?: Hit; sure?: boolean } | undefined> => {
    const search = searchRef.current
    if (!search || text.split(/\s+/).length < 5) return
    const p = trackerRef.current?.passage
    trace(`allusion search: ${text}`)
    const [res, near, recalled] = await Promise.all([search.query(text, 8), search.query(latest, 5), recall(text).catch(() => [] as string[])])
    for (const h of near) if (!res.some((x) => x.book === h.book && x.chapter === h.chapter && x.verse === h.verse)) res.push(h)
    trace(`ai recalled: ${recalled.join(', ')}`)
    const latestSeq = () => seq === allusionSeq.current
    const lift = (h: Hit) => (p && linked({ book: p.book, chapter: p.chapter, verse: p.current }, h) ? 0.05 : 0)
    const same = (a: Hit, b: Hit) => a.book === b.book && a.chapter === b.chapter && a.verse === b.verse

    // The AI's recalled verses, kept only when they share the key words of what was said.
    const fromAi: (Hit & { overlap: number })[] = []
    for (const r of recalled) {
      const ref = findReferences(r, true)[0]
      if (!ref?.start) continue
      // A few verses either side: the AI often names the right passage but slightly the wrong verses ("19:1-3" for 19:4).
      for (let v = Math.max(1, ref.start - 2); v <= Math.min((ref.end ?? ref.start) + 3, ref.start + 60); v++) {
        const h = { book: ref.book, chapter: ref.chapter, verse: v, score: 0 }
        const t = verseText(h)
        if (!t || fromAi.some((x) => same(x, h))) continue
        // Either most of what was said is in the verse, or (for short verses like "Jesus wept") all of the verse was said.
        const overlap = Math.max(wordOverlap(text, t), contentWords(t).size >= 2 ? wordOverlap(t, text) : 0)
        if (overlap >= 0.34) fromAi.push({ ...h, overlap, score: 1 + overlap + lift(h) })
      }
    }
    fromAi.sort((a, b) => b.score - a.score)
    const searchHits = res.map((h) => ({ ...h, score: h.score + lift(h) })).filter((h) => !fromAi.some((x) => same(x, h)))
    // A short verse quoted whole in the latest sentence ("the Bible tells us, Jesus wept") is certain.
    // Certain matches: a short verse quoted whole ("Jesus wept"), or a longer one read nearly word for word.
    const verbatim = (h: Hit) => {
      const t = verseText(h) ?? ''
      const n = contentWords(t).size
      if (n >= 2 && n <= 6 && saidAsPhrase(t, latest)) return true
      return contentWords(latest).size >= 6 && wordOverlap(latest, t) >= 0.75
    }
    const quoted = [...fromAi, ...searchHits].find(verbatim)
    if (quoted) { trace(`read word for word: ${refLabel(quoted)}`); const hs = [quoted, ...[...fromAi, ...searchHits].filter((h) => !same(h, quoted))]; if (latestSeq()) setHits(hs.slice(0, 5)); return { hits: hs, pick: quoted, sure: true } }
    const hits: Hit[] = [...fromAi, ...searchHits]
    if (!hits.length) return
    if (latestSeq()) setHits(hits.slice(0, 5))

    // A verified AI recall is precise: use it straight away.
    // Quotes are caught earlier by the quote index; what reaches here is a loose description, so only a close match
    // goes up by itself ("be led by the Spirit" in a sermon title is not Romans 8:14 being read). The rest are suggestions.
    if (fromAi.length) { trace(`ai verified ${refLabel(fromAi[0])} overlap ${fromAi[0].overlap.toFixed(2)}`); return { hits, pick: fromAi[0].overlap >= 0.7 ? fromAi[0] : undefined, sure: fromAi[0].overlap >= 0.7 } }

    // Otherwise let the AI choose among search results, but only act on a choice the words clearly support.
    const top = searchHits[0]
    const topKey = top ? `${top.book}:${top.chapter}:${top.verse}` : ''
    // Needs real content: a short slogan ("God has not forgotten your address") can match some verse twice by chance.
    const [lb, lc, lv] = lastTop.current.split(':').map(Number)
    const sameArea = !!top && top.book === lb && top.chapter === lc && Math.abs(top.verse - lv) <= 3
    const steady = sameArea && contentWords(text).size >= 5 && wordOverlap(text, verseText(top) ?? '') >= 0.4
    lastTop.current = topKey
    if (steady) trace(`steady top ${refLabel(top)}`)
    if (steady) return { hits, pick: top, sure: true }
    if (pendingLatest.current) return { hits } // newer speech is waiting: don't spend seconds choosing for old speech
    const pickAt = await rerank(text, searchHits.slice(0, 5).map((h) => ({ label: refLabel(h), text: verseText(h) ?? '' }))).catch(() => -2)
    if (!latestSeq()) return { hits }
    const chosen = pickAt >= 0 ? searchHits[pickAt] : pickAt === -2 ? searchHits[0] : undefined
    if (!chosen) return { hits }
    const supported = wordOverlap(text, verseText(chosen) ?? '') >= 0.55
    const ordered = [chosen, ...hits.filter((h) => !same(h, chosen))].slice(0, 5)
    if (latestSeq()) setHits(ordered)
    trace(`ai chose ${refLabel(chosen)} supported=${supported}`)
    return { hits: ordered, pick: supported ? chosen : undefined }
  }, [])
  const lastInterim = useRef('')
  const lastInterimRef = useRef('')
  const onSpeech = useCallback(async (text: string) => {
    const seq = ++speechSeq.current
    setLines((l) => [...l.slice(-300), { text, at: Date.now() }])

    // Assist: nothing moves by itself; references the preacher names become suggestions.
    if (!autoRef.current) {
      const refs = findReferences(text).map((r) => ({ book: r.book, chapter: r.chapter, verse: r.start ?? 1, score: 1 }))
      if (refs.length) { setHits(refs.slice(0, 5)); return }
      const quoted = quoteRef.current?.find(text)
      if (quoted) { setHits([{ book: quoted.book, chapter: quoted.chapter, verse: quoted.verse, score: 1 }]); return }
      const said = describedText(text)
      if (said) await findAllusion(said, ++allusionSeq.current)
      return
    }

    switchVersionFromSpeech(text)
    const t = trackerRef.current!
    const before = t.passage
    t.feed(text)
    const opened = t.passage !== before && findReferences(text).length > 0
    if (opened && t.passage) namedChapters.current = [{ book: t.passage.book, chapter: t.passage.chapter }, ...namedChapters.current.filter((c) => c.book !== t.passage!.book || c.chapter !== t.passage!.chapter)].slice(0, 6)
    if (opened) { namedAt.current = Date.now(); resumeAutopilot(); pendingHistory.current = true; recentFinals.current = []; setHits([]); setLive(true); return }
    if (before && t.passage !== before) return

    // A verse quoted (nearly) word for word is put up at once, without waiting for the AI.
    if (followQuote(text)) { recentFinals.current = []; return }

    // The fast rules found nothing. If it sounds like an instruction, ask the AI what to do.
    // Instructions are short; long sentences that mention the Bible are usually descriptions, which go straight to the verse search.
    if (CUE.test(text) && text.split(/\s+/).length <= 12) {
      const p = t.passage
      const action = await route(text, { open: p ? `${BOOKS[p.book].name} ${p.chapter}:${p.current}` : undefined, versions: [...lib.modules.keys()] })
      if (seq !== speechSeq.current) return
      if (action.action !== 'none' && applyAction(action, text)) { setLive(true); return }
    }

    // Reading the passage that is open (or one verse around it) is not a new reference: leave the screen to the follower.
    const open = trackerRef.current?.passage
    if (open && isReadingOpenPassage(text, open)) { recentFinals.current = []; return }

    // Is the preacher quoting or describing a verse? Read the last few seconds together.
    // Talk about translations ("…in the New King James") is not a description of a verse.
    if (/(version|translation|king james|amplified|easy to read|new living|niv|nkjv|kjv)/i.test(text)) return
    // Prayer is not a scripture reference.
    if (/\b(let us pray|let's pray|in jesus'? name|we pray|amen)\b/i.test(text)) return
    const said = describedText(text)
    if (!said) return
    // One search at a time (they share the CPU). Sentences that arrive meanwhile are kept, all of them, and
    // searched next. A finished search only takes the screen if newer speech isn't waiting, or if its answer is
    // a verified AI match (the slower, less certain kind of answer must not override what came after it).
    if (allusionBusy.current) {
      pendingAllusion.current = said
      pendingLatest.current = pendingLatest.current ? pendingLatest.current + ' ' + text : text
      return
    }
    allusionBusy.current = true
    try {
      let next: string | undefined = said
      let lastSaid = text
      while (next) {
        pendingAllusion.current = undefined
        pendingLatest.current = undefined
        const before = screenKey()
        const startedAt = Date.now()
        const found = await findAllusion(next, ++allusionSeq.current, lastSaid)
        const newer = pendingAllusion.current !== undefined
        const strength = found?.pick ? wordOverlap(lastSaid || next, verseText(found.pick) ?? '') + (found.sure ? 0.5 : 0) : 0
        const recent = Date.now() - lastPick.current.at < 15_000 && screenKey() === lastPick.current.key
        // The preacher called one reference but is reading another ("Genesis 1:1… For God so loved the world"):
        // follow what is actually being read, even inside the protection window.
        const open = trackerRef.current?.passage
        const misquote = !!found?.pick && !!open && contentWords(lastSaid || next).size >= 6 &&
          wordOverlap(lastSaid || next, verseText(found.pick) ?? '') >= 0.7 && !isReadingOpenPassage(lastSaid || next, open, 0.25)
        if (misquote) trace(`reading differs from the called reference: following ${refLabel(found!.pick!)}`)
        const protectedNamed = !misquote && Date.now() - namedAt.current < 25_000 && !(found?.sure && strength >= 1.1)
        if (found?.pick && !protectedNamed && (!newer || found.sure) && autoRef.current && !heldRef.current && (screenKey() === before || (misquote && namedAt.current < startedAt)) && (!recent || strength > lastPick.current.strength)) {
          openHit(found.pick)
          lastPick.current = { key: screenKey(), strength, at: Date.now() }
        }
        lastSaid = pendingLatest.current ?? ''
        next = lastSaid ? recentFinals.current.map((f) => f.text).join(' ') : undefined
      }
    } finally { allusionBusy.current = false }
  }, [])

  function verseText(h: { book: number; chapter: number; verse: number }) {
    return (lib.verse(versionRef.current, h.book, h.chapter, h.verse) ?? lib.verse('KJV', h.book, h.chapter, h.verse))?.text
  }

  /**
   * The preacher is quoting a verse, or reading further down the chapter that is open. Strong word-for-word evidence,
   * so it may override the protection after a named reference (they named 2 Kings 23 but read 2 Kings 20:3).
   */
  function followQuote(text: string, live = false): boolean {
    const q = quoteRef.current, t = trackerRef.current
    const prev = lastFinal.current
    // `live`: the sentence is still being spoken (an interim result), so the quote can go up before it ends.
    if (!live) lastFinal.current = { text, at: Date.now() }
    if (!q || !t || heldRef.current) return false
    const joined = Date.now() - prev.at < 8000 ? prev.text + ' ' + text : text
    const p = t.passage
    // Reading on in the open chapter: 1 John 4 is up and they read "he that loveth not, knoweth not God" (verse 8).
    if (p && !t.placeholder) {
      const near = q.inChapter(joined, p.book, p.chapter)
      if (near && Math.abs(near.verse - p.current) >= 2) {
        trace(`reading ${refLabel(near)} further down the open chapter`)
        t.goto(near.verse)
        return true
      }
    }
    // A passage named earlier in the sermon beats a look-alike elsewhere ("praying always with all prayer and
    // supplication" is Ephesians 6:18 in a sermon on Ephesians 6, not Solomon's prayer in 1 Kings 8).
    for (const c of namedChapters.current) {
      if (p && c.book === p.book && c.chapter === p.chapter) continue
      const h = q.inChapter(joined, c.book, c.chapter, true)
      if (h) {
        trace(`quoted ${refLabel(h)} from a passage named earlier`)
        openHit({ book: h.book, chapter: h.chapter, verse: h.verse, score: 1 })
        lastPick.current = { key: screenKey(), strength: 2, at: Date.now() }
        return true
      }
    }
    for (const said of [text, joined]) {
      const h = q.find(said)
      if (!h) continue
      if (p && h.book === p.book && h.chapter === p.chapter && Math.abs(h.verse - p.current) <= 1) return false // the reading follower has it
      // A parallel of the verse already up ("a man shall leave his father" is in Genesis, Mark and Ephesians) stays put.
      if (p && q.alike(h, p.book, p.chapter, p.current)) return true
      trace(`quoted ${refLabel(h)} (${h.matched} words, ${h.runs} in order)`)
      namedChapters.current = [{ book: h.book, chapter: h.chapter }, ...namedChapters.current.filter((c) => c.book !== h.book || c.chapter !== h.chapter)].slice(0, 6)
      openHit({ book: h.book, chapter: h.chapter, verse: h.verse, score: 1 })
      lastPick.current = { key: screenKey(), strength: 2, at: Date.now() }
      return true
    }
    return false
  }

  function openHit(h: Hit) {
    trace(`opened ${refLabel(h)}`)
    pendingHistory.current = true
    trackerRef.current?.open(h.book, h.chapter, h.verse, h.verse)
    setLive(true)
  }

  // Testing aid: started with SF_FEED, the app listens to a recording instead of the microphone, on Autopilot.
  const [feedUrl, setFeedUrl] = useState<string>()
  useEffect(() => {
    if (!isDesktop) return
    void import('@tauri-apps/api/core').then(({ invoke }) => invoke<string | null>('debug_feed')).then((u) => { if (u) setFeedUrl(u) })
  }, [])
  useEffect(() => {
    if (feedUrl && ready && !listening) { setMode('autopilot'); void toggleListen() }
  }, [feedUrl, ready])

  async function toggleListen() {
    if (listening) { listenerRef.current?.stop(); setListening(false); setLevel(0); return }
    try {
      if (!listenerRef.current) {
        setStatus('Loading speech model…')
        setModelPct(0)
        const device = await loadEngine((p) => setModelPct(Math.round(p)))
        setModelPct(null)
        setStatus(device === 'webgpu' ? 'Listening (GPU)' : 'Listening')
        listenerRef.current = new Listener(engine, (t) => { setInterim(''); lastInterim.current = ''; lastInterimRef.current = ''; void onSpeech(t) }, setLevel, (t) => {
          // Show only the words two partial results agree on, so the transcript grows steadily instead of rewriting itself.
          const prev = lastInterim.current
          lastInterim.current = t
          const a = prev.split(' '), b = t.split(' ')
          let k = 0
          while (k < a.length && k < b.length && a[k].toLowerCase().replace(/[^a-z0-9]/g, '') === b[k].toLowerCase().replace(/[^a-z0-9]/g, '')) k++
          if (k > 0) setInterim(b.slice(0, k).join(' '))
          if (!autoRef.current) return
          // A reference counts once it is settled: more words follow it, or the same reference came back twice.
          const settled = t.replace(/\s*\S+\s*$/, '')
          switchVersionFromSpeech(settled)
          const r = findReferences(t)[0]
          const shorter = findReferences(settled)[0]
          const key = JSON.stringify(r)
          const repeated = key === lastInterimRef.current
          lastInterimRef.current = key
          if (!r) {
            // A quote can go up while the sentence is still being spoken; otherwise follow the reading mid-sentence.
            if (!followQuote(t, true)) trackerRef.current?.hear(t)
            return
          }
          if (key !== JSON.stringify(shorter) && !repeated) return
          const p = trackerRef.current?.passage
          if (r && (!p || p.book !== r.book || p.chapter !== r.chapter || (r.start !== undefined && p.current !== r.start && p.first !== r.start))) { namedAt.current = Date.now(); resumeAutopilot(); pendingHistory.current = true; trackerRef.current?.open(r.book, r.chapter, r.start, r.end); setLive(true) }
        })
      }
      await listenerRef.current.start(undefined, feedUrl)
      setListening(true)
      setStatus('Listening')
    } catch (e) {
      setModelPct(null)
      setStatus('Microphone or speech model problem: ' + (e as Error).message)
    }
  }

  function chaptersIn(book: number) {
    let n = 0
    while (lib.verse('KJV', book, n + 1, 1)) n++
    return n
  }
  function stepChapter(d: number) {
    takeOver()
    const p = passageRef.current
    if (!p) return
    let book = p.book, ch = p.chapter + d
    if (ch < 1) { book = (book + 65) % 66; ch = chaptersIn(book) }
    else if (ch > chaptersIn(book)) { book = (book + 1) % 66; ch = 1 }
    trackerRef.current?.open(book, ch)
  }

  const programRef = useRef(program)
  programRef.current = program
  const programAtRef = useRef(programAt)
  programAtRef.current = programAt
  function addToProgram() {
    const p = passageRef.current
    if (!p) return
    const item = { book: p.book, chapter: p.chapter, verse: p.current, end: p.wholeChapter ? p.current : Math.max(p.current, p.last) }
    setProgram([...programRef.current, item])
    setSideTab('program')
  }
  function playProgram(i: number) {
    const item = programRef.current[i]
    if (!item) return
    setProgramAt(i)
    pendingHistory.current = true
    trackerRef.current?.open(item.book, item.chapter, item.verse, item.end)
    setLive(true)
  }
  function stepProgram(d: number) {
    const n = programRef.current.length
    if (!n) return
    playProgram(Math.max(0, Math.min(n - 1, programAtRef.current + d)))
  }

  /** Next/previous verse, flowing into the neighbouring chapter at either end. */
  function stepVerse(d: number) {
    takeOver()
    const p = passageRef.current
    if (!p) return
    const count = lib.lookup(versionRef.current).chapterVerseCount(p.book, p.chapter)
    if (p.current + d > count) { stepChapter(1); return }
    if (p.current + d < 1) {
      stepChapter(-1)
      const q = trackerRef.current?.passage
      if (q) trackerRef.current?.goto(lib.lookup(versionRef.current).chapterVerseCount(q.book, q.chapter))
      return
    }
    trackerRef.current?.goto(p.current + d)
  }

  function submitCommand(text: string) {
    const r = findReferences(text, true)[0]
    if (!r) { setMsg('Try "John 3:16" or "Psalm 23"'); return }
    pendingHistory.current = true
    trackerRef.current?.open(r.book, r.chapter, r.start, r.end)
    setMsg(''); setRefText(''); setLive(true)
  }

  /** Brings Bible Show's themes (and its red-letter setting) across from its program folder. */
  async function importBibleShow(files: FileList | null) {
    if (!files?.length) return
    setMsg('Bringing your Bible Show themes across…')
    try {
      const r = await importBibleShowFolder(files)
      if (!r.themes.length) { setMsg('No Bible Show themes in that folder. Choose the BibleShow folder itself.'); return }
      const keep = themes.filter((t) => !r.themes.some((n) => n.id === t.id))
      const all = [...r.themes, ...keep]
      await saveThemes(all)
      setThemes(all)
      setStyle({ ...style, lookId: r.current ?? r.themes[0].id, redLetters: r.redLetters ?? style.redLetters })
      const extra = [r.missing.length ? `${r.missing.length} background${r.missing.length > 1 ? 's' : ''} missing (${r.missing.slice(0, 2).join(', ')}${r.missing.length > 2 ? '…' : ''})` : '',
        r.bibles ? `${r.bibles} Bibles are in that folder: add the ones you use from the Bibles page` : ''].filter(Boolean).join('. ')
      setMsg(`Imported ${r.themes.length} Bible Show themes.${extra ? ' ' + extra + '.' : ''}`)
    } catch (e) { setMsg('Could not import: ' + (e as Error).message) }
  }

  async function removeThemes() {
    await saveThemes([])
    setThemes([])
    setStyle({ ...style, lookId: undefined })
  }

  /** "+ Add translation": closed, or showing the two ways to add one. */
  const [adding, setAdding] = useState<'menu' | 'online' | null>(null)
  const [catalog, setCatalog] = useState<CatalogEntry[] | 'loading' | 'offline'>()
  const [fetching, setFetching] = useState<string>()
  async function openCatalog() {
    setAdding('online')
    if (Array.isArray(catalog)) return
    setCatalog('loading')
    try {
      const r = await fetch(CATALOG + 'index.json', { cache: 'no-cache' })
      if (!r.ok) throw new Error(String(r.status))
      setCatalog(await r.json())
    } catch { setCatalog('offline') }
  }
  async function addFromCatalog(e: CatalogEntry) {
    setFetching(e.short)
    try {
      const m = await lib.importFromCatalog(e, CATALOG)
      setVersions([...lib.modules.keys()])
      setMsg(`Added ${m.name}`)
    } catch (err) { setMsg(`${e.name}: ${(err as Error).message}`) }
    setFetching(undefined)
  }
  const [catalogQuery, setCatalogQuery] = useState('')
  const [catalogLang, setCatalogLang] = useState('All')
  /** Bible Show's downloads page: the translation is picked there (language, then version), then uploaded here. */
  function openBibleShow(e: CatalogEntry) {
    setMsg(`On Bible Show, pick ${e.language}, then ${e.name}. Then come back and choose Upload a file.`)
    const url = 'https://www.bibleshow.net/download.php'
    if (isDesktop) void import('@tauri-apps/api/core').then(({ invoke }) => invoke('open_site', { url })).catch(() => setMsg('Could not open the browser'))
    else window.open(url, '_blank')
  }
  function openWebsite(path = 'translations') {
    const url = SITE + '#' + path
    if (isDesktop) void import('@tauri-apps/api/core').then(({ invoke }) => invoke('open_site', { url })).catch(() => setMsg('Could not open the browser'))
    else window.open(url, '_blank')
  }

  async function importFiles(files: FileList | null) {
    if (!files) return
    for (const f of Array.from(files)) {
      try {
        const m = await lib.importFile(f)
        setMsg(`Added ${m.name}`)
      } catch (e) { setMsg(`${f.name}: ${(e as Error).message}. `) }
    }
    setVersions([...lib.modules.keys()])
  }

  function changeVersion(v: string) {
    trace(`version ${v} (operator)`)
    versionUsedAt.current = Date.now()
    versionRef.current = v
    setVersion(v)
    makeTracker(v, passageRef.current)
  }

  const openOutput = () => openProjector()
  const closeOutput = () => closeProjector()

  // Keyboard (works while a passage is open and no text box is focused).
  const hitsRef = useRef<Hit[]>([])
  hitsRef.current = hits
  const refBox = useRef<HTMLInputElement>(null)
  useEffect(() => {
    // Hotkeys come from the bindings table (Bible Show defaults, editable in Settings).
    const k = (e: KeyboardEvent) => {
      if (recordingRef.current) return // Settings is capturing a new shortcut
      const el = e.target as HTMLElement
      const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.getAttribute?.('role') === 'slider'
      const combo = comboOf(e)
      if (!combo) return
      const action = actionFor(bindingsRef.current, combo)
      if (typing) {
        if (e.key === 'Escape') el.blur()
        if (!action || !ACTIONS.find((a) => a.id === action)?.global || combo.length === 1) return
      }
      if (!action) {
        if (/^[1-5]$/.test(e.key) && hitsRef.current[+e.key - 1]) openHit(hitsRef.current[+e.key - 1]) // AI suggestions
        return
      }
      e.preventDefault()
      switch (action) {
        case 'reference': refBox.current?.focus(); refBox.current?.select(); break
        case 'find': findBox.current?.focus(); findBox.current?.select(); break
        case 'next': stepVerse(1); break
        case 'previous': stepVerse(-1); break
        case 'nextChapter': stepChapter(1); break
        case 'previousChapter': stepChapter(-1); break
        case 'toggle': setLive((v) => !v); break
        case 'show': setFrozen(false); setLive(true); break
        case 'hide': setLive(false); break
        case 'freeze': setFrozen((v) => !v); break
        case 'addProgram': addToProgram(); break
        case 'programNext': stepProgram(1); break
        case 'programPrevious': stepProgram(-1); break
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  // Recording a shortcut in Settings: the next key combination replaces the chosen slot.
  useEffect(() => {
    if (!recording) return
    const k = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation()
      if (e.key === 'Escape' && !e.ctrlKey) { setRecording(null); return }
      const combo = comboOf(e)
      if (!combo) return
      const all = bindingsRef.current
      const owner = actionFor(all, combo)
      if (owner && !(owner === recording[0] && all[owner].indexOf(combo) === recording[1])) { setConflict({ combo, target: recording, owner }); setRecording(null); return }
      assignShortcut(recording, combo)
      setRecording(null)
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [recording])

  function assignShortcut([action, i]: [ActionId, number], combo: string) {
    const next: Bindings = { ...bindingsRef.current }
    for (const a of Object.keys(next) as ActionId[]) next[a] = next[a].filter((c) => c !== combo || a === action)
    const list = [...next[action]]
    list[i] = combo
    next[action] = list.filter(Boolean)
    setBindings(next)
  }

  const chapterVerses = useMemo(() => {
    if (!passage) return []
    const out = []
    for (let v = 1; ; v++) {
      const x = lib.verse(version, passage.book, passage.chapter, v)
      if (!x) break
      out.push(x)
    }
    return out
  }, [passage?.book, passage?.chapter, version, versions])

  const curRef = useRef<HTMLDivElement>(null)
  // Breathing Room keeps three verses of context visible around the live verse; Glide animates the move.
  const versesRef = useRef<HTMLDivElement>(null)
  const glideAnim = useRef(0)
  useLayoutEffect(() => {
    const box = versesRef.current
    if (!box || !curRef.current || !passage) return
    const margin = breathing ? 3 : 0
    const at = (v: number) => box.querySelector<HTMLElement>(`[data-v="${v}"]`)
    const below = at(passage.current + margin) ?? (box.lastElementChild as HTMLElement | null)
    const above = at(passage.current - margin) ?? (box.firstElementChild as HTMLElement | null)
    const top = box.getBoundingClientRect().top
    let delta = 0
    if (above && above.getBoundingClientRect().top < top) delta = above.getBoundingClientRect().top - top
    else if (below && below.getBoundingClientRect().bottom > top + box.clientHeight) delta = below.getBoundingClientRect().bottom - (top + box.clientHeight)
    if (!delta) return
    cancelAnimationFrame(glideAnim.current)
    const from = box.scrollTop, to = from + delta
    if (!glide) { box.scrollTop = to; return }
    const t0 = performance.now(), dur = 180
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      box.scrollTop = from + (to - from) * (1 - Math.pow(1 - k, 3))
      if (k < 1) glideAnim.current = requestAnimationFrame(step)
    }
    glideAnim.current = requestAnimationFrame(step)
  }, [passage?.current, passage?.chapter, passage?.book, breathing, glide])

  // History: every verse that actually reached the screen, newest first.
  useEffect(() => {
    if (!live || !passage || !pendingHistory.current) return
    pendingHistory.current = false
    const h = { book: passage.book, chapter: passage.chapter, verse: passage.current }
    setHistory((old) => [h, ...old.filter((o) => o.book !== h.book || o.chapter !== h.chapter || o.verse !== h.verse)].slice(0, 40))
  }, [live, passage?.book, passage?.chapter, passage?.current])

  // Selection highlights glide to the chosen option after every render (and on resize).
  useLayoutEffect(() => { glideIndicators() })
  useEffect(() => { const f = () => glideIndicators(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])

  // Diagnostics: what is on screen, and the top suggestion, as they change.
  useEffect(() => { if (passage) trace(`screen ${BOOKS[passage.book].name} ${passage.chapter}:${passage.current} (${version})${live ? '' : ' [hidden]'}`) }, [passage?.book, passage?.chapter, passage?.current, version, live])
  useEffect(() => { if (hits[0]) trace(`suggest ${hits.slice(0, 3).map((h) => refLabel(h)).join(' | ')}`) }, [hits])

  // Heard: sentences flow into paragraphs; a pause of 6 seconds or more starts a new one.
  const paragraphs = useMemo(() => {
    const out: string[] = []
    let lastAt = 0
    for (const l of lines) {
      if (!out.length || l.at - lastAt > 6000) out.push(l.text)
      else out[out.length - 1] += ' ' + l.text
      lastAt = l.at
    }
    return out
  }, [lines])
  const transcriptRef = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = transcriptRef.current; if (el) el.scrollTop = el.scrollHeight }, [paragraphs, interim])
  const footnotesFor = (v: { book: number; chapter: number; verse: number }) =>
    (lib.modules.get(version)?.footnotes ?? []).filter((f) => f.book === v.book && f.chapter === v.chapter && f.verse === v.verse).map((f) => f.text)

  // The projector has its own look; it stays black even when the operator uses Cream.
  const outTheme: OutputStyle['theme'] = style.theme
  // Rows may get very short on a small screen (1080p at 150% leaves 620 points for 48 rows and their gaps); the grid must still fit exactly.
  const rowH = Math.max(1, (gridH - 2 * MARGIN - (ROWS - 1) * MARGIN) / ROWS)
  const colW = (stageW - 2 * MARGIN - (COLS[bp] - 1) * MARGIN) / COLS[bp]
  // What is saved is the operator's own arrangement; it changes only when they drag or resize a widget.
  // What is shown is that arrangement fitted to the window as it is now (Screen keeps 16:9, nothing leaves
  // the window), worked out afresh on every size change and never saved, so moving the window to a smaller
  // screen and back brings the arrangement back exactly.
  const shown = useMemo(() => {
    const mine = layouts?.[bp] as Item[] | undefined
    if (!mine || bp === 'sm' || stageW < 200) return layouts
    return { ...layouts, [bp]: settle(mine.map((x) => ({ ...x })), COLS[bp], colW, rowH) }
  }, [layouts, bp, colW, rowH, stageW])
  // Widgets directly under Screen move up by the space left below its picture, so every gap is the same.
  const screenItem = (shown?.[bp] as Item[] | undefined)?.find((x) => x.i === 'screen')
  const pull = screenItem && bp !== 'sm' ? screenLeftover(screenItem.w, screenItem.h, colW, rowH) : 0
  const pullStyle = (key: string): React.CSSProperties | undefined => {
    const it = (shown?.[bp] as Item[] | undefined)?.find((x) => x.i === key)
    if (!it || !screenItem || !pull || key === 'screen') return
    const under = it.y === screenItem.y + screenItem.h && it.x >= screenItem.x && it.x + it.w <= screenItem.x + screenItem.w
    return under ? ({ '--pull': `${pull}px` } as React.CSSProperties) : undefined
  }
  /** The operator moved or resized a widget: settle it (widgets fall into free space, holes fill) and keep it. */
  const saveArrangement = (current: readonly Item[]) => {
    const tidy = bp === 'sm' ? [...current] : settle(current.map((x) => ({ ...x })), COLS[bp], colW, rowH)
    if (!sameLayout(tidy, (layouts?.[bp] ?? []) as Item[])) setLayouts({ ...layouts, [bp]: tidy })
  }
  const slide = slideFor(passage, version)
  const verseOf = (h: Hit) => (lib.verse(version, h.book, h.chapter, h.verse) ?? lib.verse('KJV', h.book, h.chapter, h.verse))?.text
  const title = passage ? `${BOOKS[passage.book].name} ${passage.chapter}:${passage.current}` : ''
  const bookList = BOOKS.map((b, i) => ({ name: b.name, i })).filter((b) => !bookFilter || b.name.toLowerCase().replace(/\s/g, '').startsWith(bookFilter.toLowerCase().replace(/\s/g, '')))
  const chapterCount = passage ? chaptersIn(passage.book) : 0

  return (
    <div className="app">
      <header className="top" data-tauri-drag-region>
        <div className="brand"><img className="logo" src="/logo.png" alt="" />Lampstand</div>
        <nav className="tabs">
          {(['live', 'bibles', 'settings'] as const).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'live' ? 'Live' : t === 'bibles' ? 'Bibles' : 'Settings'}</button>
          ))}
        </nav>
        <form className="omni" onSubmit={(e) => { e.preventDefault(); submitCommand(refText); refBox.current?.blur() }}>
          <span className="omni-icon">⌕</span>
          <input ref={refBox} value={refText} onChange={(e) => setRefText(e.target.value)} placeholder="Go to reference   (/)" spellCheck={false} />
        </form>
        <div className="grow" />
        {msg && <span key={msg} className={'toast' + (msgLeaving ? ' leaving' : '')}>{msg}</span>}
        <SpringPill className={auto ? (held ? 'held' : listening ? 'active' : 'ready') : 'assist'}
          onClick={() => { if (held) resumeAutopilot(); else setMode(auto ? 'assist' : 'autopilot') }}
          title={auto ? (held ? 'You are driving. Click, or name a new passage, to hand back to Autopilot.' : 'Autopilot: follows the preacher by itself. Click for Assist.') : 'Assist: suggestions only. Click for Autopilot.'}
          icon={<span className="orb" />} label={auto ? (held ? 'You’re driving' : 'Autopilot') : 'Assist'} />
        <button className={'btn ' + (listening ? 'on' : '')} onClick={toggleListen} disabled={!ready}>
          <span className="meter"><i style={{ height: Math.round(level * 100) + '%' }} /></span>
          {listening ? 'Listening' : 'Listen'}
        </button>
        <button className={'btn live ' + (live ? 'on' : '')} onClick={() => setLive(!live)}>{live ? 'Live' : 'Blank'}</button>
        <WindowControls />
      </header>

      {/* Live stays mounted while other pages are open, so returning to it never re-lays out the widgets. */}
      {(
        <div ref={stageRef} className={'stage' + (tab === 'live' ? '' : ' parked') + (bp === 'sm' ? ' scroll' : '')} aria-hidden={tab !== 'live'}>
          <Grid
            className="grid" layouts={shown} breakpoints={{ lg: 1000, md: 700, sm: 0 }} cols={COLS}
            rowHeight={rowH} margin={[MARGIN, MARGIN]} containerPadding={[MARGIN, MARGIN]} draggableHandle=".drag"
            resizeHandles={['e', 's', 'se', 'w']}
            maxRows={bp === 'sm' ? Infinity : ROWS} onBreakpointChange={(b: any) => setBp(b)}
            onDragStop={(current: readonly Item[]) => saveArrangement(current)}
            onResizeStop={(current: readonly Item[]) => saveArrangement(current)}
          >
            <div key="reference" style={pullStyle('reference')}>
              <Widget title="Reference" className="fixed">
                {refTab === 'books' ? (
                  <>
                    <input className="field slim" value={bookFilter} onChange={(e) => setBookFilter(e.target.value)} placeholder="Search books" spellCheck={false}
                      onKeyDown={(e) => { if (e.key === 'Enter' && bookList[0]) { takeOver(); trackerRef.current?.open(bookList[0].i, 1, 1, 1); setBookFilter('') } }} />
                    <div className="books">
                      {bookList.map((b) => (
                        <button key={b.i} className={'tline' + (passage?.book === b.i ? ' on' : '')} onClick={() => { takeOver(); trackerRef.current?.open(b.i, 1, 1, 1); setBookFilter('') }}><b>{b.name}</b></button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <input className="field slim" value={versionFilter} onChange={(e) => setVersionFilter(e.target.value)} placeholder="Search translations" spellCheck={false} />
                    <div className="books">
                      {versions.filter((v) => !versionFilter || (v + ' ' + (lib.modules.get(v)?.name ?? '')).toLowerCase().includes(versionFilter.toLowerCase())).map((v) => (
                        <div key={v} className={'tline-row' + (v === version ? ' on' : '')}>
                          <button className="tline" onClick={() => changeVersion(v)}><b>{v}</b><span>{lib.modules.get(v)?.name}</span></button>
                          <button className={'star' + (v === preferred ? ' on' : '')} title={v === preferred ? 'Preferred translation' : 'Make this the preferred translation'} onClick={() => setPreferred(v)}>{v === preferred ? '★' : '☆'}</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className={'slider ' + refTab}>
                  <button className={refTab === 'books' ? 'on' : ''} onClick={() => setRefTab('books')}>Books</button>
                  <button className={refTab === 'translations' ? 'on' : ''} onClick={() => setRefTab('translations')}>Translations</button>
                </div>
                <div className="ref-label">Chapter</div>
                <div className="chapters">
                  {Array.from({ length: chapterCount }, (_, i) => i + 1).map((c) => (
                    <button key={c} className={passage?.chapter === c ? 'on' : ''} onClick={() => { takeOver(); passage && trackerRef.current?.open(passage.book, c, 1, 1) }}>{c}</button>
                  ))}
                </div>
              </Widget>
            </div>

            <div key="scripture" style={pullStyle('scripture')}>
              <Widget title={passage ? `${BOOKS[passage.book].name} ${passage.chapter}` : 'Scripture'} className="fixed"
                right={<span className="vtag" title={lib.modules.get(version)?.name}>{version}</span>}>
                <div className={'verses' + (style.redLetters ? '' : ' plain')} ref={versesRef}>
                  {chapterVerses.map((v) => {
                    const active = !!passage && v.verse === passage.current
                    return (
                      <div key={v.verse} data-v={v.verse} ref={active ? curRef : undefined} className={'verse' + (active ? ' active' : '')}
                        onClick={() => { takeOver(); trackerRef.current?.goto(v.verse); setLive(true) }}>
                        <b>{v.verse}</b><span dangerouslySetInnerHTML={{ __html: operatorHtml(v.html, footnotesFor(v)) }} />
                      </div>
                    )
                  })}
                </div>
              </Widget>
            </div>

            <div key="screen">
              <Widget title={frozen ? 'Screen · Frozen' : 'Screen'} className="fixed screen-body" right={<><span className={'dot' + (live ? ' live' : '')} />
                <button className={'mini-btn' + (frozen ? ' on' : '')} title="Freeze (F7)" onClick={() => setFrozen(!frozen)}>Freeze</button>
                <button className="mini-btn" onClick={openOutput}>Open</button><button className="mini-btn" onClick={closeOutput}>Close</button></>}>
                <div className="mini">
                  <SlideView slide={frozenSlide ?? (live && passage ? slide : { ...slide, blank: true })} style={{ ...screenStyle, theme: outTheme }} unit="cqmin" />
                </div>
              </Widget>
            </div>

            <div key="find" style={pullStyle('find')}>
              <Widget title="Find" className="fixed">
                <input ref={findBox} className="field" value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="Words or meaning" spellCheck={false} />
                <div className="list">
                  {found.map((h, i) => <button key={i} className="hit" onClick={() => openHit(h)}><b>{refLabel(h)}</b><span>{verseOf(h)}</span></button>)}
                </div>
              </Widget>
            </div>

            <div key="suggest" style={pullStyle('suggest')}>
              <Widget title="Suggestions" className="fixed" right={<span className={'ai-tag' + (aiOk ? ' on' : '')}>{aiOk ? 'AI on' : 'AI starting'}</span>}>
                {searchStatus && <div className={searchStatus.startsWith('Meaning search unavailable') ? 'error' : 'note'}>{searchStatus}</div>}
                {hits.length === 0 && <div className="empty small">Describe a passage aloud and matches appear here. Press 1–5 to switch.</div>}
                <div className="list">
                  {hits.map((h, i) => <button key={i} className={'hit' + (i === 0 ? ' best' : '')} onClick={() => openHit(h)}><b><kbd>{i + 1}</kbd>{refLabel(h)}</b><span>{verseOf(h)}</span></button>)}
                </div>
              </Widget>
            </div>

            <div key="heard" style={pullStyle('heard')}>
              <Widget title="Heard" right={<span className="muted">{/failed|problem/i.test(status) ? 'Error' : status}</span>}>
                {/failed|problem/i.test(status) && <div className="error">{status}</div>}
                {modelPct !== null && <div className="bar"><i style={{ width: modelPct + '%' }} /></div>}
                <div className="transcript" ref={transcriptRef}>
                  {paragraphs.map((para, i) => <p key={i} className={i === paragraphs.length - 1 ? 'now' : ''}>{para}{i === paragraphs.length - 1 && interim ? <span className="interim"> {interim}</span> : null}</p>)}
                  {!paragraphs.length && (interim ? <p className="now"><span className="interim">{interim}</span></p> : <p className="muted">Nothing yet.</p>)}
                </div>
              </Widget>
            </div>

            <div key="related" style={pullStyle('related')}>
              <Widget title="Related" className="fixed" right={<span className="muted">{title}</span>}>
                <div className="list">
                  {xrefOk && passage && related(passage.book, passage.chapter, passage.current).map((l, i) => (
                    <button key={i} className="hit" onClick={() => { pendingHistory.current = true; trackerRef.current?.open(l.book, l.chapter, l.verse, l.end); setLive(true) }}>
                      <b>{refLabel(l)}{l.end !== l.verse ? ` – ${l.end}` : ''}</b><span>{verseOf({ ...l, score: 0 })}</span>
                    </button>
                  ))}
                  {xrefOk && passage && related(passage.book, passage.chapter, passage.current).length === 0 && <div className="empty small">No cross references for this verse.</div>}
                </div>
              </Widget>
            </div>

            <div key="history" style={pullStyle('history')}>
              <Widget title={<span className="wtabs">
                  <button className={sideTab === 'program' ? 'on' : ''} onClick={() => setSideTab('program')}>Program</button>
                  <button className={sideTab === 'history' ? 'on' : ''} onClick={() => setSideTab('history')}>History</button>
                </span>} className="fixed"
                right={sideTab === 'program'
                  ? <><button className="mini-btn" title="Add current verse (F2)" onClick={addToProgram}>Add</button>{program.length > 0 && <button className="mini-btn" onClick={() => { setProgram([]); setProgramAt(-1) }}>Clear</button>}</>
                  : null}>
                <div className="list">
                  {sideTab === 'program' && program.length === 0 && <div className="empty small">Press F2 to queue the current verse. + and − step through the queue.</div>}
                  {sideTab === 'program' && program.map((h, i) => (
                    <div key={i} className={'prow' + (i === programAt ? ' on' : '')}>
                      <button className="hist" onClick={() => playProgram(i)}>{refLabel(h)}{h.end !== h.verse ? `–${h.end}` : ''}</button>
                      <button className="x" onClick={() => setProgram(program.filter((_, j) => j !== i))}>×</button>
                    </div>
                  ))}
                  {sideTab === 'history' && history.length === 0 && <div className="empty small">Verses shown on screen appear here.</div>}
                  {sideTab === 'history' && history.map((h) => (
                    <button key={`${h.book}:${h.chapter}:${h.verse}`} className="hist" onClick={() => { trackerRef.current?.open(h.book, h.chapter, h.verse, h.verse); setLive(true) }}>{refLabel(h)}</button>
                  ))}
                </div>
              </Widget>
            </div>
          </Grid>
        </div>
      )}

      {tab === 'bibles' && (
        <div className="page wide bibles">
          <div>
            <h2>Translations</h2>
            <div className="vtable">
              {versions.map((v) => {
                const m = lib.modules.get(v)
                return (
                  <div key={v} className="vline">
                    <span className="vcode">{v}</span>
                    <div className="vinfo">
                      <b>{m?.name}</b>
                      <span>{(m?.verses.length ?? 0).toLocaleString()} verses{m?.footnotes.length ? ` · ${m.footnotes.length.toLocaleString()} footnotes` : ''}{m?.titles.length ? ' · section titles' : ''}</span>
                      {m?.description && <p>{m.description.replace(/<[^>]+>/g, '').slice(0, 220)}{m.description.length > 220 ? '…' : ''}</p>}
                    </div>
                    <div className="vactions">
                      <button className={'star big' + (v === preferred ? ' on' : '')} title={v === preferred ? 'Preferred translation' : 'Make this the preferred translation'} onClick={() => setPreferred(v)}>{v === preferred ? '★ Preferred' : '☆ Prefer'}</button>
                      {v !== 'KJV' && <button className="mini-btn ghost" onClick={async () => { await lib.remove(v); setVersions([...lib.modules.keys()]); if (version === v) changeVersion('KJV') }}>Remove</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div>
            <h2>Add translations</h2>
            {!adding && <button className="add-tr" onClick={() => setAdding('menu')}><span>+</span> Add translation</button>}
            {adding === 'menu' && (
              <div className="add-choices">
                <button className="add-choice" onClick={() => void openCatalog()}>
                  <b>Get online</b>
                  <span>Free translations from the Lampstand website, added in one click.</span>
                </button>
                <label className="add-choice">
                  <b>Upload a file</b>
                  <span>A translation you already have: a Lampstand Bible (.lamp.json), or a Bible Show version (.exe or .bib).</span>
                  <input type="file" accept=".json,.exe,.bib" multiple hidden onChange={(e) => { void importFiles(e.target.files); e.target.value = ''; setAdding(null) }} />
                </label>
                <button className="mini-btn ghost add-cancel" onClick={() => setAdding(null)}>Cancel</button>
              </div>
            )}
            {adding === 'online' && (
              <div className="catalog">
                {catalog === 'loading' && <p className="muted">Loading the list…</p>}
                {catalog === 'offline' && <p className="muted">Couldn't reach the website. Check the internet connection, or download a translation on another computer and use Upload a file.</p>}
                {Array.isArray(catalog) && (() => {
                  const q = catalogQuery.trim().toLowerCase()
                  const languages = [...new Set(catalog.map((e) => e.language))].sort((x, y) => (x === 'English' ? -1 : y === 'English' ? 1 : x.localeCompare(y)))
                  const shown = catalog.filter((e) => (catalogLang === 'All' || e.language === catalogLang) &&
                    (!q || `${e.short} ${e.name} ${e.language} ${e.year ?? ''}`.toLowerCase().includes(q)))
                  return (
                    <>
                      <div className="catalog-filter">
                        <input value={catalogQuery} onChange={(ev) => setCatalogQuery(ev.target.value)} placeholder={`Search ${catalog.length} translations`} spellCheck={false} />
                        <select value={catalogLang} onChange={(ev) => setCatalogLang(ev.target.value)}>
                          <option value="All">All languages</option>
                          {languages.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div className="catalog-list">
                        {shown.map((e) => {
                          const have = versions.includes(e.short)
                          const size = typeof e.size === 'number' ? Math.round(e.size / 1e5) / 10 + ' MB' : e.size
                          return (
                            <div key={e.id} className="vline">
                              <span className="vcode">{e.short}</span>
                              <div className="vinfo"><b>{e.name}</b><span>{[e.language, e.year, e.source === 'lampstand' ? 'Free' : e.copyright, size].filter(Boolean).join(' · ')}</span></div>
                              <div className="vactions">
                                {e.source === 'lampstand' && <button className="mini-btn" disabled={have || fetching === e.short} onClick={() => void addFromCatalog(e)}>{have ? 'Added' : fetching === e.short ? 'Adding…' : 'Add'}</button>}
                                {e.source === 'bibleshow' && (have ? <button className="mini-btn" disabled>Added</button> : <button className="mini-btn ghost" title="Download it from Bible Show, then come back and choose Upload a file" onClick={() => openBibleShow(e)}>From Bible Show</button>)}
                                {e.source === 'builtin' && <button className="mini-btn" disabled>Built in</button>}
                                {e.source === 'held' && <button className="mini-btn" disabled title="Numbers the Psalms the Greek or Latin way. Coming once Lampstand converts the numbering.">Coming soon</button>}
                              </div>
                            </div>
                          )
                        })}
                        {!shown.length && <p className="muted">No translation matches.</p>}
                      </div>
                    </>
                  )
                })()}
                <p className="muted small-note">Free translations are added straight away. The others belong to their publishers, so Bible Show offers them instead. Choose From Bible Show, download the file there, then come back and use Upload a file. There's no need to unpack it.</p>
                <button className="mini-btn ghost" onClick={() => setAdding(null)}>Done</button>
              </div>
            )}
            <p className="muted small-note">The starred translation is used for every new scripture. When the preacher asks for another ("…in the Amplified"), that reading switches to it, and the next new scripture returns to the starred one.</p>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="settings-page">
          <nav className="settings-nav">
            {([['appearance', 'Appearance', 'Light or dark mode'], ['projector', 'Projector', 'What the congregation sees'], ['operator', 'Workspace', 'How the panels move'], ['ai', 'AI & Listening', 'Autopilot, speech and suggestions'], ['keyboard', 'Keyboard', 'Shortcuts']] as const).map(([k, label, hint]) => (
              <button key={k} className={settingsTab === k ? 'on' : ''} onClick={() => setSettingsTab(k)}><b>{label}</b><span>{hint}</span></button>
            ))}
          </nav>

          <div className="settings-body">
            {settingsTab === 'projector' && (
              <div className="settings-split">
                <div className="mini big">
                  <SlideView slide={slideFor({ ...(passage ?? { book: 0, chapter: 1, first: 1, last: 1, current: 1, wholeChapter: false }), current: (passage?.current ?? 1) + previewStep }, version)} style={{ ...screenStyle, theme: outTheme }} unit="cqmin" />
                </div>
                <div>
                  <div className="group-label first">Theme</div>
                  <div className="setrow col"><span>Look<small>{themes.length ? 'Your Bible Show themes, exactly as Bible Show draws them' : 'Moving from Bible Show? Bring its themes across'}</small></span>
                    <div className="themecards">
                      <button className={'themecard' + (!look ? ' on' : '')} onClick={() => setStyle({ ...style, lookId: undefined })}>
                        <span className="tc-pic tc-own" style={{ background: style.theme === 'light' ? '#f4eedf' : style.theme === 'green' ? '#00b140' : '#000', color: style.theme === 'light' ? '#14161d' : '#fff' }}><i>Aa</i></span>
                        <b>Lampstand</b>
                      </button>
                      {themes.map((t) => (
                        <button key={t.id} className={'themecard' + (look?.id === t.id ? ' on' : '')} onClick={() => setStyle({ ...style, lookId: t.id })} title={t.name}>
                          {t.thumb
                            ? <span className="tc-pic" style={{ backgroundImage: `url(${t.thumb})` }} />
                            : <span className="tc-pic mini"><SlideView slide={{ reference: 'John 3:16', version: '', html: 'For God so loved the world' }} style={{ ...style, transition: 'none', look: t }} unit="cqmin" /></span>}
                          <b>{t.name}</b>
                        </button>
                      ))}
                    </div>
                    <div className="theme-actions">
                      <label className="mini-btn">Import from Bible Show…<input type="file" hidden {...{ webkitdirectory: '', directory: '' }} onChange={(e) => { void importBibleShow(e.target.files); e.target.value = '' }} /></label>
                      {themes.length > 0 && <button className="mini-btn ghost" onClick={() => void removeThemes()}>Remove imported themes</button>}
                      <small className="muted">Choose the BibleShow folder (usually C:\Program Files (x86)\BibleShow5)</small>
                    </div></div>
                  <div className="setrow"><span>Text size<small>{Math.round((look ? themeScale(look, style.themeSizes) : style.scale) * 100)}%{look ? ' · remembered for this theme' : ''}</small></span>
                    <Slider min={50} max={130} step={2} value={Math.round((look ? themeScale(look, style.themeSizes) : style.scale) * 100)}
                      onChange={(v) => setStyle(look ? { ...style, themeSizes: { ...style.themeSizes, [look.id]: v / 100 } } : { ...style, scale: v / 100 })} /></div>
                  <div className={'group-label' + (look ? ' disabled' : '')}>Text</div>
                  <div className={'setrow' + (look ? ' disabled' : '')}><span>Style{look && <small>Set by the theme</small>}</span>
                    <div className="seg"><button className={style.font === 'bold' ? 'on' : ''} onClick={() => setStyle({ ...style, font: 'bold' })}>Bold</button><button className={style.font === 'sans' ? 'on' : ''} onClick={() => setStyle({ ...style, font: 'sans' })}>Regular</button><button className={style.font === 'serif' ? 'on' : ''} onClick={() => setStyle({ ...style, font: 'serif' })}>Serif</button></div></div>
                  <div className="setrow"><span>Words of Jesus in red</span>
                    <div className="seg"><button className={style.redLetters ? 'on' : ''} onClick={() => setStyle({ ...style, redLetters: true })}>On</button><button className={!style.redLetters ? 'on' : ''} onClick={() => setStyle({ ...style, redLetters: false })}>Off</button></div></div>
                  <div className="group-label">Layout</div>
                  <div className={'setrow' + (look ? ' disabled' : '')}><span>Position<small>{look ? 'Set by the theme' : 'Lower third leaves the picture clear, for livestreams and stage screens'}</small></span>
                    <div className="seg"><button className={style.layout !== 'lower' ? 'on' : ''} onClick={() => setStyle({ ...style, layout: 'full' })}>Full screen</button><button className={style.layout === 'lower' ? 'on' : ''} onClick={() => setStyle({ ...style, layout: 'lower' })}>Lower third</button></div></div>
                  <div className="group-label">Background</div>
                  <div className={'setrow' + (look ? ' disabled' : '')}><span>Colour<small>{look ? 'Set by the theme' : 'Green screen keys out cleanly for livestreams'}</small></span>
                    <div className="seg"><button className={style.theme === 'night' ? 'on' : ''} onClick={() => setStyle({ ...style, theme: 'night' })}>Black</button><button className={style.theme === 'light' ? 'on' : ''} onClick={() => setStyle({ ...style, theme: 'light' })}>Cream</button><button className={style.theme === 'green' ? 'on' : ''} onClick={() => setStyle({ ...style, theme: 'green' })}>Green</button></div></div>
                  <div className="group-label">Transition</div>
                  <div className="setrow col"><span>Animation style<small>How each verse gives way to the next</small></span>
                    <div className="tcards">
                      {(['none', 'fade', 'rise', 'dissolve', 'zoom'] as const).map((t) => (
                        <button key={t} className={'tcard' + (style.transition === t ? ' on' : '')} onClick={() => { setStyle({ ...style, transition: t }); setPreviewStep((n) => 1 - n) }}>
                          <span className={'tdemo d-' + t}><i><em /><u /><u className="short" /></i><i><em /><u /><u className="short" /></i></span>
                          <b>{t === 'none' ? 'Cut' : t[0].toUpperCase() + t.slice(1)}</b>
                        </button>
                      ))}
                    </div></div>
                  <div className={'setrow' + (style.transition === 'none' ? ' disabled' : '')}><span>Transition length<small>{style.transition === 'none' ? 'Not used with Cut' : (style.duration / 1000).toFixed(2) + ' seconds'}</small></span>
                    <Slider disabled={style.transition === 'none'} min={120} max={1200} step={20} value={style.duration} onChange={(v) => setStyle({ ...style, duration: v })} /></div>
                </div>
              </div>
            )}

            {settingsTab === 'appearance' && (
              <div className="settings-col">
                <div className="group-label first">App theme</div>
                <div className="theme-cards">
                  {([['dark', 'Dark mode', 'Pure black, made for dark sanctuaries and booths'], ['cream', 'Light mode', 'Warm cream, for bright rooms']] as const).map(([k, label, hint]) => (
                    <button key={k} className={'theme-card t-' + k + (theme === k ? ' on' : '')} onClick={() => setTheme(k)}>
                      <span className="theme-swatch"><i /><i /><i /></span>
                      <b>{label}</b><small>{hint}</small>
                    </button>
                  ))}
                </div>
                <p className="muted small-note">This changes Lampstand itself. The projector has its own background colour under Projector.</p>
              </div>
            )}

            {settingsTab === 'operator' && (
              <div className="settings-col">
                <div className="group-label first">Scripture panel</div>
                <div className="setrow"><span>Breathing Room<small>Three verses of context stay in view around the live verse</small></span>
                  <div className="seg"><button className={breathing ? 'on' : ''} onClick={() => setBreathing(true)}>On</button><button className={!breathing ? 'on' : ''} onClick={() => setBreathing(false)}>Off</button></div></div>
                <div className="setrow"><span>Glide<small>Verses slide into place instead of snapping</small></span>
                  <div className="seg"><button className={glide ? 'on' : ''} onClick={() => setGlide(true)}>On</button><button className={!glide ? 'on' : ''} onClick={() => setGlide(false)}>Off</button></div></div>
                <div className="group-label">Widgets</div>
                <div className="setrow"><span>Layout<small>Put every widget back where it started</small></span><button className="mini-btn" onClick={() => setLayouts(DEFAULT_LAYOUTS)}>Reset</button></div>
              </div>
            )}

            {settingsTab === 'ai' && (
              <div className="settings-col">
                <div className="group-label first">Mode</div>
                <div className="setrow"><span>AI mode<small>Autopilot opens, follows and switches by itself. Assist only suggests.</small></span>
                  <div className="seg"><button className={auto ? 'on' : ''} onClick={() => setMode('autopilot')}>Autopilot</button><button className={!auto ? 'on' : ''} onClick={() => setMode('assist')}>Assist</button></div></div>
                <div className="group-label">Status</div>
                <div className="setrow"><span>Speech recognition<small>Underdog Bark 3.0 Plus, on this computer</small></span><span className="status-text">{isDesktop ? (/failed|problem/i.test(status) ? 'Problem' : 'Ready') : 'Desktop app only'}</span></div>
                <div className="setrow"><span>Assistant<small>Qwen2.5 1.5B, on this computer</small></span><span className="status-text">{aiOk ? 'Ready' : 'Starting'}</span></div>
                <div className="setrow"><span>Cross references<small>OpenBible.info, about 279,000 links</small></span><span className="status-text">{xrefOk ? 'Ready' : 'Loading'}</span></div>
                <p className="muted small-note">Everything runs offline. Nothing you say leaves this computer.</p>
              </div>
            )}

            {settingsTab === 'keyboard' && (
              <div className="settings-col">
                <div className="group-label first">Shortcuts<span className="hint">Click a key, then press the new one. Esc cancels.</span></div>
                <div className="keys editable">
                  {ACTIONS.map((a) => {
                    const list = bindingsRef.current[a.id]
                    return (
                      <div key={a.id}>
                        <span>{a.label}</span>
                        <div className="kchips">
                          <button className={'kchip' + (recording?.[0] === a.id ? ' rec' : '')} onClick={() => setRecording([a.id, 0])}>
                            {recording?.[0] === a.id ? 'Press keys…' : list[0] ? pretty(list[0]) : 'Not set'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  <div><span>Use an AI suggestion</span><div className="kchips"><span className="kchip fixed">1 – 5</span></div></div>
                </div>
                <div className="setrow"><span>Restore defaults<small>Bible Show's original keys</small></span><button className="mini-btn" onClick={() => setBindings(DEFAULT_BINDINGS)}>Restore</button></div>
              </div>
            )}
          </div>
        </div>
      )}
      {conflict && (
        <div className="modal-back" onClick={() => setConflict(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Shortcut already in use</h3>
            <p><kbd>{pretty(conflict.combo)}</kbd> is set to <b>{ACTIONS.find((a) => a.id === conflict.owner)?.label}</b>. Use it for <b>{ACTIONS.find((a) => a.id === conflict.target[0])?.label}</b> instead?</p>
            <div className="modal-actions">
              <button className="mini-btn ghost" onClick={() => setConflict(null)}>Cancel</button>
              <button className="mini-btn on" onClick={() => { assignShortcut(conflict.target, conflict.combo); setConflict(null) }}>Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
