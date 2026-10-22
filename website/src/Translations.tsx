import { useEffect, useMemo, useState } from 'react'
import { count } from './count'

interface Entry {
  id: string
  short: string
  name: string
  year?: number
  language: string
  copyright: string
  source: 'lampstand' | 'bibleshow' | 'builtin' | 'held'
  file?: string
  size?: number | string
}

const BIBLE_SHOW = 'https://www.bibleshow.net/download.php'

/** Every translation Bible Show offers, and where to get each one. */
export default function Translations() {
  const [list, setList] = useState<Entry[]>([])
  const [q, setQ] = useState('')
  const [lang, setLang] = useState('All')
  const [free, setFree] = useState(false)
  useEffect(() => {
    fetch('./bibles/index.json').then((r) => r.json()).then(setList).catch(() => setList([]))
  }, [])

  const languages = useMemo(() => [...new Set(list.map((e) => e.language))].sort((a, b) => (a === 'English' ? -1 : b === 'English' ? 1 : a.localeCompare(b))), [list])
  const shown = list.filter((e) =>
    (lang === 'All' || e.language === lang) &&
    (!free || e.source === 'lampstand' || e.source === 'builtin') &&
    (!q.trim() || `${e.short} ${e.name} ${e.language} ${e.year ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())))
  const hosted = list.filter((e) => e.source === 'lampstand').length

  return (
    <section className="mx-auto max-w-[1400px] px-5 pb-32 pt-36 sm:px-10">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Translations</p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl">Every translation your church reads from.</h1>
          <p className="mt-6 max-w-sm text-[var(--dim)]">
            {list.length ? `${list.length} translations in ${languages.length} languages.` : ''} The King James Version comes with Lampstand.
            {hosted ? ` ${hosted} more are free, and Lampstand adds them in one click.` : ''}
          </p>
          <div className="mt-10 space-y-6 text-sm text-[var(--dim)]">
            <div>
              <div className="font-semibold text-[var(--fg)]">Free translations</div>
              <p className="mt-1">In Lampstand, open Bibles, choose Add translation, then Get online. Or download the file here and choose Upload a file.</p>
            </div>
            <div>
              <div className="font-semibold text-[var(--fg)]">From Bible Show</div>
              <p className="mt-1">Translations like the NIV, NKJV and Amplified belong to their publishers. Bible Show offers them for free. Download the one you want there, then add the file in Lampstand with Upload a file. There's no need to unpack it.</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="sticky top-16 z-10 -mx-1 flex flex-wrap gap-3 bg-[var(--bg)] px-1 py-4">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${list.length || ''} translations`} spellCheck={false}
              className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-transparent px-5 py-2.5 text-sm outline-none focus:border-[var(--fg)]" />
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="rounded-full border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm">
              <option value="All">All languages</option>
              {languages.map((l) => <option key={l}>{l}</option>)}
            </select>
            <button onClick={() => setFree(!free)} className={'rounded-full border px-4 py-2.5 text-sm transition ' + (free ? 'border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]' : 'border-[var(--line)] text-[var(--dim)]')}>Free only</button>
          </div>
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {shown.map((e) => (
              <li key={e.id} className="flex items-baseline gap-5 py-4">
                <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-[var(--gold)]">{e.short}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{e.name}</span>
                  <span className="text-sm text-[var(--muted)]">{[e.language, e.year, e.source === 'lampstand' || e.source === 'builtin' ? 'Free' : e.copyright].filter(Boolean).join(' · ')}</span>
                </span>
                {e.source === 'lampstand' && (
                  <a href={'./bibles/' + e.file} download onClick={() => count('translation-' + e.short, true)} className="shrink-0 text-sm font-medium text-[var(--fg)] hover:underline">
                    Download <span className="text-[var(--muted)]">{typeof e.size === 'number' ? (e.size / 1e6).toFixed(1) + ' MB' : ''}</span>
                  </a>
                )}
                {e.source === 'bibleshow' && (
                  <a href={BIBLE_SHOW} onClick={() => count('bibleshow-' + e.short, true)} target="_blank" rel="noreferrer" className="shrink-0 text-sm text-[var(--dim)] hover:text-[var(--fg)]">On Bible Show</a>
                )}
                {e.source === 'builtin' && <span className="shrink-0 text-sm text-[var(--muted)]">In the app</span>}
                {e.source === 'held' && <span className="shrink-0 text-sm text-[var(--muted)]" title="Numbers the Psalms the Greek or Latin way. Coming once Lampstand converts the numbering.">Coming soon</span>}
              </li>
            ))}
            {list.length > 0 && !shown.length && <li className="py-6 text-[var(--muted)]">No translation matches.</li>}
          </ul>
          <p className="mt-6 text-sm text-[var(--muted)]">
            Lampstand isn't affiliated with Bible Show. Translations that belong to publishers are listed so you can find them, and are downloaded from Bible Show.
            Lampstand Bible files are plain JSON, documented in the source.
          </p>
        </div>
      </div>
    </section>
  )
}
