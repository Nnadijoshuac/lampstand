import { useEffect, useState } from 'react'
import FadeContent from './components/FadeContent'

interface Entry { short: string; name: string; year?: number; license?: string; file: string; size: number }

/** The free translations Lampstand can add, and where to get the ones that belong to publishers. */
export default function Translations() {
  const [list, setList] = useState<Entry[]>([])
  useEffect(() => {
    fetch('./bibles/index.json').then((r) => r.json()).then(setList).catch(() => setList([]))
  }, [])

  return (
    <section id="translations" className="border-t border-[var(--line)]">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-5 py-32 sm:px-10 lg:grid-cols-12">
        <FadeContent effect="fade" className="lg:col-span-4">
          <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Translations</p>
          <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl">Add a translation in one click.</h2>
          <p className="mt-6 max-w-sm text-[var(--dim)]">
            The King James Version comes with Lampstand. These are free to use and share. In the app, open Bibles, choose
            Add translation, then Get online. Or download one here and choose Upload a file.
          </p>
        </FadeContent>
        <div className="lg:col-span-8">
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {list.map((e) => (
              <li key={e.short} className="flex items-baseline gap-5 py-4">
                <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-[var(--gold)]">{e.short}</span>
                <span className="flex-1">
                  <span className="block font-medium">{e.name}</span>
                  <span className="text-sm text-[var(--muted)]">{[e.year, e.license].filter(Boolean).join(' · ')}</span>
                </span>
                <a href={'./bibles/' + e.file} download className="text-sm font-medium text-[var(--dim)] hover:text-[var(--fg)]">
                  Download <span className="text-[var(--muted)]">{(e.size / 1e6).toFixed(1)} MB</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-10 rounded-2xl border border-[var(--line)] p-7">
            <h3 className="text-lg font-semibold tracking-tight">Looking for the NIV, NKJV, ESV or Amplified?</h3>
            <p className="mt-3 max-w-2xl text-[var(--dim)]">
              Those belong to their publishers, so we can't share them here. Bible Show offers many of them as free downloads.
              Get the version you need from Bible Show's download page, then add the file you downloaded in Lampstand with
              Upload a file. There's no need to unpack it.
            </p>
            <a href="https://www.bibleshow.net/download.php" target="_blank" rel="noreferrer" className="mt-5 inline-block text-sm font-medium underline underline-offset-4">
              Open Bible Show's downloads
            </a>
          </div>
          <p className="mt-6 text-sm text-[var(--muted)]">
            Have a translation we don't? Lampstand Bible files are plain JSON, documented in the source.
          </p>
        </div>
      </div>
    </section>
  )
}
