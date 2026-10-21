import { useEffect, useRef, useState } from 'react'

/** What the preacher says, and what Lampstand puts on the screen. */
const SCENES = [
  { said: 'All right. Ephesians chapter six, verse ten.', label: 'A reference', ref: 'Ephesians 6:10', verse: 'Finally, my brethren, be strong in the Lord, and in the power of his might.' },
  { said: 'Go on now.', label: 'A command', ref: 'Ephesians 6:11', verse: 'Put on the whole armour of God, that ye may be able to stand against the wiles of the devil.' },
  { said: 'And the women sang, Saul has slain his thousands, and David his ten thousands...', label: 'Only a description', ref: '1 Samuel 18:7', verse: 'And the women answered one another as they played, and said, Saul hath slain his thousands, and David his ten thousands.' },
  { said: "Let's go back to the scripture we read.", label: 'Going back', ref: 'Ephesians 6:11', verse: 'Put on the whole armour of God, that ye may be able to stand against the wiles of the devil.' }
]

/**
 * Words appear as they are spoken; a beat after the sentence ends, the verse lands on the projector.
 * Starts when it scrolls into view and loops through the scenes.
 */
export default function Demo() {
  const root = useRef<HTMLDivElement>(null)
  const [scene, setScene] = useState(0)
  const [typed, setTyped] = useState(0)
  const [shown, setShown] = useState(-1)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    if (root.current) io.observe(root.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    const words = SCENES[scene].said.split(' ')
    if (typed < words.length) {
      const t = setTimeout(() => setTyped(typed + 1), 150 + Math.random() * 120)
      return () => clearTimeout(t)
    }
    if (shown !== scene) {
      const t = setTimeout(() => setShown(scene), 380)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => { setScene((scene + 1) % SCENES.length); setTyped(0) }, 3200)
    return () => clearTimeout(t)
  }, [visible, scene, typed, shown])

  const s = SCENES[scene]
  const words = s.said.split(' ')
  const on = shown >= 0 ? SCENES[shown] : undefined
  return (
    <div ref={root} className="grid items-stretch gap-6 lg:grid-cols-[1fr_1.35fr]">
      <div className="flex flex-col justify-between rounded-2xl border border-[var(--line)] p-7">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e5484d] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#e5484d]" /></span>
          Listening
        </div>
        <p className="mt-10 min-h-[6.5rem] text-2xl leading-snug tracking-tight sm:text-[1.7rem]">
          {words.map((w, i) => (
            <span key={scene + '-' + i} className={'transition-opacity duration-300 ' + (i < typed ? 'opacity-100' : 'opacity-0')}>{w} </span>
          ))}
        </p>
        <div className="mt-8 text-sm text-[var(--dim)]">{s.label}</div>
      </div>
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black text-[#f4eedf] ring-1 ring-[var(--line)]">
        {SCENES.map((x, i) => (
          <div key={i} className={'absolute inset-0 flex flex-col items-center justify-center px-[9%] text-center transition-all duration-700 ease-[cubic-bezier(.2,.7,.2,1)] ' + (on === x ? 'translate-y-0 opacity-100 blur-0' : 'translate-y-3 opacity-0 blur-sm')}>
            <div className="text-xs font-semibold tracking-wide text-[#e9dcb8] sm:text-sm">{x.ref}</div>
            <div className="mt-4 text-lg font-bold leading-snug sm:text-2xl">{x.verse}</div>
          </div>
        ))}
        <div className="absolute bottom-3 left-4 text-[10px] uppercase tracking-[0.2em] text-white/35">Projector</div>
      </div>
    </div>
  )
}
