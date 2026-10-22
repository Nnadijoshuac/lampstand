import { useEffect, useState } from 'react'
import LightRays from './components/LightRays'
import BlurText from './components/BlurText'
import FadeContent from './components/FadeContent'
import StarBorder from './components/StarBorder'
import SpotlightCard from './components/SpotlightCard'
import Wordmark from './Wordmark'
import Demo from './Demo'
import Moment from './Moment'
import Translations from './Translations'
import { DOWNLOAD_SIZE, EXE_SIZE, EXE_URL, REPO_URL, ZIP_URL } from './links'
import { useRoute } from './route'
import { count } from './count'

type Theme = 'dark' | 'light'

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'))
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('lampstand-theme', theme) } catch { /* storage unavailable */ }
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

const FEATURES = [
  { title: 'References, however they are said', body: 'Ephesians 6:10, the sixth chapter of Ephesians, Ephesians six ten. In a noisy room with a strong accent it once heard "official chapter six" and still put up Ephesians 6.' },
  { title: 'It reads along', body: 'When the pastor reads, the screen moves to the next verse as each one ends. If they read past the verse they announced, it keeps going with them.' },
  { title: 'Plain instructions', body: '"Next verse." "Go on." "Go back to verse two." "Show me the next chapter, verse four." Say it the way you would say it to the media team.' },
  { title: 'Stories and half quotes', body: 'Say "Saul has slain his thousands" and 1 Samuel 18:7 comes up. Every match is checked against the words of the verse before it reaches the screen.' },
  { title: 'The media team stays in charge', body: 'Click anything and Lampstand stops moving the screen until you hand it back. Or switch to Assist and it only makes suggestions.' }
]

const SPECS = [
  ['System', 'Windows 10 or 11, 64-bit', 'Windows 11, 64-bit'],
  ['Processor', '4 cores with AVX2 (Intel Core i5 8th gen, AMD Ryzen 5 2000 or newer)', '6 cores or more (Intel Core i5 10th gen, Ryzen 5 3000 or newer)'],
  ['Memory', '8 GB', '16 GB'],
  ['Storage', '3 GB free', 'SSD, 3 GB free'],
  ['Sound', 'Any microphone', 'A clean feed from the sound desk (USB sound card)']
]

const Arrow = () => <span aria-hidden className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>

export default function App() {
  const [theme, toggle] = useTheme()
  const light = theme === 'light'
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  const route = useRoute()
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] transition-colors duration-500">
      <header className={'fixed inset-x-0 top-0 z-40 transition-[background-color,backdrop-filter,border-color] duration-500 ' + (scrolled ? 'border-b border-[var(--line)] bg-[var(--bg)]/75 backdrop-blur-xl' : 'border-b border-transparent')}>
        <nav className="mx-auto flex h-16 max-w-[1400px] items-center gap-8 px-5 sm:px-10">
          <a href="#/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
            <img src="./logo.png" alt="" className="h-6 w-6" /> Lampstand
          </a>
          <div className="hidden items-center gap-7 text-[13px] text-[var(--dim)] md:flex">
            <a className={route === 'translations' ? 'text-[var(--fg)]' : 'hover:text-[var(--fg)]'} href="#/translations">Translations</a>
            <a className={route === 'download' ? 'text-[var(--fg)]' : 'hover:text-[var(--fg)]'} href="#/download">Download</a>
            <a className="hover:text-[var(--fg)]" href={REPO_URL}>Source</a>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={toggle} aria-label="Switch between light and dark" className="grid h-8 w-8 place-items-center rounded-full text-[var(--dim)] hover:text-[var(--fg)]">
              {light ? '☾' : '☀'}
            </button>
            <a href="#/download" className="rounded-full bg-[var(--fg)] px-4 py-1.5 text-[13px] font-medium text-[var(--bg)] transition hover:opacity-85">Download</a>
          </div>
        </nav>
      </header>

      {route === 'home' && (
        <main id="top">
        <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden pb-14 pt-28">
          <div className="pointer-events-none absolute inset-0">
            <LightRays raysOrigin="top-right" raysColor={light ? '#b8892e' : '#f3e2b8'} raysSpeed={0.5} lightSpread={1.1} rayLength={2.2} intensity={light ? 0.45 : 0.8} lightMode={light} followMouse mouseInfluence={0.05} />
          </div>
          <div className="relative mx-auto grid w-full max-w-[1400px] gap-10 px-5 sm:px-10 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-12">
              <p className="mb-8 text-[13px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Free church software for Windows</p>
              <h1 className="text-[clamp(2.9rem,8.2vw,8.4rem)] font-semibold leading-[0.96] tracking-[-0.05em]">
                <BlurText text="Scripture on screen," animateBy="words" direction="bottom" delay={80} trigger="load" className="whitespace-nowrap" />
                <BlurText text="as it's preached." animateBy="words" direction="bottom" delay={80} trigger="load" className="whitespace-nowrap text-[var(--dim)]" />
              </h1>
            </div>
            <div className="lg:col-span-4 lg:col-start-9">
              <p className="text-lg leading-relaxed text-[var(--dim)]">
                Lampstand listens to the sermon and puts each verse up for the congregation as soon as it is spoken. It runs on the
                church computer and it is free.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <StarBorder as="a" href="#/download" theme={light ? 'light' : 'dark'} color={light ? '#b8892e' : '#f3e2b8'} className="text-sm font-semibold">
                  Download for Windows
                </StarBorder>
                <a href={REPO_URL} className="group text-sm font-medium text-[var(--dim)] hover:text-[var(--fg)]">Read the source <Arrow /></a>
              </div>
            </div>
          </div>
        </section>

        <Wordmark image="./screenshot.png" light="./light.jpg" theme={theme} />

        <Moment image="./worship.jpg" alt="A congregation standing in a dark auditorium, a verse on the big screen above the band"
          title="The whole church reads along." body="The verse is up while the words are still being spoken, so nobody waits for the screen to catch up." />

        <section id="listen" className="mx-auto max-w-[1400px] px-5 py-32 sm:px-10">
          <div className="grid gap-12 lg:grid-cols-12">
            <FadeContent effect="fade" className="lg:col-span-4">
              <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">How it works</p>
              <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl">It knows what the pastor means.</h2>
              <p className="mt-6 max-w-sm text-[var(--dim)]">Pastors rarely announce scripture the same way twice. Some give the reference, some read straight from the text, and some tell the story and let the church catch up. Lampstand follows all of them.</p>
            </FadeContent>
            <div className="lg:col-span-8">
              <Demo />
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--line)]">
          <div className="mx-auto max-w-[1400px] px-5 sm:px-10">
            {FEATURES.map((f, i) => (
              <FadeContent key={f.title} effect="fade" delay={0.05} className="grid gap-4 border-b border-[var(--line)] py-10 md:grid-cols-12 md:items-baseline">
                <div className="text-sm tabular-nums text-[var(--muted)] md:col-span-1">0{i + 1}</div>
                <h3 className="text-2xl font-semibold tracking-tight md:col-span-5">{f.title}</h3>
                <p className="max-w-xl text-[var(--dim)] md:col-span-6">{f.body}</p>
              </FadeContent>
            ))}
          </div>
        </section>

        <Moment image="./booth.jpg" align="right" alt="A media volunteer sitting back at the sound desk during the sermon"
          title="The media team gets the sermon back." body="Lampstand looks after the scriptures, so the volunteer at the desk can listen to the message too." />

        <section id="bible-show" className="mx-auto max-w-[1400px] px-5 py-32 sm:px-10">
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1">
              <FadeContent effect="fade">
                <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Coming from Bible Show?</p>
                <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl">Bring everything with you.</h2>
                <p className="mt-6 text-[var(--dim)]">Point Lampstand at your Bible Show folder and your Bibles and projector themes come across. On the first Sunday the screen looks the way your congregation is used to.</p>
              </FadeContent>
            </div>
            <div className="lg:col-span-6 lg:row-start-1">
              <FadeContent effect="fade" delay={0.1}>
                <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)] text-lg">
                  {['Bibles, from .bib files or straight from the Bible Show installers', 'Projector themes, with their backgrounds, fonts and lower thirds', 'Words of Jesus in red, if you had it switched on', 'A favourite translation that every new passage opens in'].map((x) => (
                    <li key={x} className="flex items-baseline gap-4 py-5"><span className="text-[var(--gold)]">✓</span><span>{x}</span></li>
                  ))}
                </ul>
              </FadeContent>
            </div>
          </div>
        </section>

          <section className="border-t border-[var(--line)]">
            <div className="mx-auto grid max-w-[1400px] gap-6 px-5 py-24 sm:px-10 md:grid-cols-2">
              <a href="#/download" className="group rounded-2xl border border-[var(--line)] p-8 transition hover:border-[var(--fg)]">
                <div className="text-sm text-[var(--muted)]">Windows 10 and 11</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">Download Lampstand <Arrow /></div>
                <p className="mt-4 text-[var(--dim)]">Free, with everything it needs inside. See what your computer needs first.</p>
              </a>
              <a href="#/translations" className="group rounded-2xl border border-[var(--line)] p-8 transition hover:border-[var(--fg)]">
                <div className="text-sm text-[var(--muted)]">400 translations, 80 languages</div>
                <div className="mt-2 text-3xl font-semibold tracking-tight">Find your translation <Arrow /></div>
                <p className="mt-4 text-[var(--dim)]">Every translation Bible Show offers, and where to get each one.</p>
              </a>
            </div>
          </section>
        </main>
      )}

      {route === 'translations' && <main id="top"><Translations /></main>}

      {route === 'download' && (
        <main id="top" className="pt-16">
        <section id="download" className="relative overflow-hidden border-t border-[var(--line)]">
          <div className="mx-auto grid max-w-[1400px] gap-12 px-5 py-32 sm:px-10 lg:grid-cols-12 lg:items-end">
            <FadeContent effect="fade" className="lg:col-span-6">
              <h2 className="text-[clamp(2.6rem,5.4vw,5.2rem)] font-semibold leading-[0.98] tracking-[-0.045em]">Free for every church.</h2>
              <p className="mt-6 max-w-md text-[var(--dim)]">Download it, open it and press Listen. There is nothing to sign up for, and it keeps itself up to date.</p>
            </FadeContent>
            <div className="grid gap-4 lg:col-span-6">
              <a href={EXE_URL} onClick={() => count('download-exe', true)} className="group block">
                <SpotlightCard theme={light ? 'light' : 'dark'} spotlightColor={light ? 'rgba(184,137,46,0.2)' : 'rgba(243,226,184,0.16)'} className="rounded-2xl p-7">
                  <div className="flex items-baseline justify-between gap-6">
                    <div>
                      <div className="text-sm text-[var(--dim)]">Windows 10 and 11 · 64-bit</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight">Download for Windows</div>
                    </div>
                    <div className="text-2xl"><Arrow /></div>
                  </div>
                  <div className="mt-6 text-sm text-[var(--muted)]">{EXE_SIZE}. On first start it downloads the speech and AI models (1.5 GB), and picks up where it left off if the internet drops.</div>
                </SpotlightCard>
              </a>
              <a href={ZIP_URL} onClick={() => count('download-zip', true)} className="group flex items-baseline justify-between gap-6 rounded-2xl border border-[var(--line)] px-7 py-5 transition hover:border-[var(--dim)]">
                <span>
                  <span className="block font-medium">Everything in one zip</span>
                  <span className="mt-1 block text-sm text-[var(--muted)]">{DOWNLOAD_SIZE} with the models inside. For a church computer with slow internet. Unzip and press Listen.</span>
                </span>
                <Arrow />
              </a>
              <a href={REPO_URL + '#build-from-source'} className="group flex items-baseline justify-between rounded-2xl border border-[var(--line)] px-7 py-5 text-[var(--dim)] transition hover:text-[var(--fg)]">
                <span>On a Mac or Linux? You can build it from the source today.</span><Arrow />
              </a>
            </div>
          </div>
        </section>

        <section id="requirements" className="border-t border-[var(--line)]">
          <div className="mx-auto max-w-[1400px] px-5 py-32 sm:px-10">
            <FadeContent effect="fade" className="max-w-2xl">
              <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-[var(--muted)]">Requirements</p>
              <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl">Will it run on our computer?</h2>
              <p className="mt-6 text-[var(--dim)]">Lampstand does its listening on the computer itself, so it needs a reasonably recent one. A machine that meets the minimum keeps up with a full service.</p>
            </FadeContent>
            <FadeContent effect="fade" delay={0.1} className="mt-14 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="text-[13px] uppercase tracking-[0.16em] text-[var(--muted)]">
                    <th className="w-1/5 py-4 font-medium" />
                    <th className="py-4 font-medium">Minimum</th>
                    <th className="py-4 font-medium">Recommended</th>
                  </tr>
                </thead>
                <tbody>
                  {SPECS.map(([k, min, rec]) => (
                    <tr key={k} className="border-t border-[var(--line)] align-baseline">
                      <td className="py-5 pr-6 text-[var(--dim)]">{k}</td>
                      <td className="py-5 pr-6">{min}</td>
                      <td className="py-5">{rec}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FadeContent>
          </div>
        </section>

        <section className="border-t border-[var(--line)]">
          <div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-20 text-sm sm:px-10 lg:grid-cols-12">
            <div className="text-[var(--muted)] lg:col-span-3">Built on</div>
            <ul className="grid gap-x-10 gap-y-3 text-[var(--dim)] sm:grid-cols-2 lg:col-span-9">
              <li><span className="text-[var(--fg)]">Underdog Bark 3.0 Plus</span> by Conway Research, speech recognition (CC BY 4.0)</li>
              <li><span className="text-[var(--fg)]">Qwen2.5 1.5B Instruct</span>, the on-device AI (Apache 2.0)</li>
              <li><span className="text-[var(--fg)]">llama.cpp</span> and <span className="text-[var(--fg)]">ONNX Runtime</span>, fast local inference</li>
              <li><span className="text-[var(--fg)]">all-MiniLM-L6-v2</span>, search by meaning</li>
              <li><span className="text-[var(--fg)]">OpenBible.info</span> cross references (CC BY)</li>
              <li><span className="text-[var(--fg)]">Tauri</span>, for the desktop app</li>
            </ul>
          </div>
        </section>
        </main>
      )}

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-5 py-10 text-sm text-[var(--muted)] sm:flex-row sm:items-baseline sm:px-10">
          <div className="flex items-center gap-2 text-[var(--dim)]"><img src="./logo.png" alt="" className="h-5 w-5" /> Lampstand</div>
          <div>Made by Joshua Nnadi · MIT licence</div>
          <div className="sm:ml-auto">"Thy word is a lamp unto my feet, and a light unto my path." Psalm 119:105</div>
        </div>
        <p className="mx-auto max-w-[1400px] px-5 pb-10 text-xs text-[var(--muted)] sm:px-10">Lampstand is not affiliated with Bible Show. Bible Show is a trademark of its owner.</p>
      </footer>
    </div>
  )
}
