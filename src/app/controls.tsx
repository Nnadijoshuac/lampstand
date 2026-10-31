import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { isDesktop } from './stt'

/**
 * Selection highlights glide between options instead of jumping. Any `.seg`, `.tabs`, `.slider` or `.wtabs`
 * group gets one indicator that follows its `.on` button. Call after every render; it only touches the DOM.
 */
export function glideIndicators(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.seg, .tabs, .slider, .wtabs').forEach(placeGlide)
}

/** Positions one group's indicator. The first placement is instant; later ones glide. */
function placeGlide(group: HTMLElement): void {
  let ind = group.querySelector<HTMLElement>(':scope > .glide')
  if (!ind) {
    ind = document.createElement('span')
    ind.className = 'glide'
    group.prepend(ind)
    // Button sizes change when the font finishes loading or the panel resizes: follow them.
    new ResizeObserver(() => placeGlide(group)).observe(group)
    group.querySelectorAll(':scope > button').forEach((b) => new ResizeObserver(() => placeGlide(group)).observe(b))
  }
  const on = group.querySelector<HTMLElement>(':scope > button.on')
  if (!on || !on.offsetWidth) { ind.style.opacity = '0'; return }
  const first = !ind.dataset.ready
  if (first) ind.style.transition = 'none'
  ind.style.opacity = '1'
  ind.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`
  ind.style.width = on.offsetWidth + 'px'
  ind.style.height = on.offsetHeight + 'px'
  if (first) { void ind.offsetWidth; ind.style.transition = ''; ind.dataset.ready = '1' }
}

if (typeof document !== 'undefined') void document.fonts?.ready.then(() => glideIndicators())

/** A slider drawn by us: thin track, filled portion, soft thumb that grows while dragged. */
export function Slider({ value, min, max, step, onChange, disabled }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; disabled?: boolean }) {
  const track = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState(false)
  const pressX = useRef<number | null>(null)
  const pct = ((value - min) / (max - min)) * 100
  const at = (clientX: number) => {
    const r = track.current!.getBoundingClientRect()
    const raw = min + ((clientX - r.left) / r.width) * (max - min)
    onChange(Math.max(min, Math.min(max, Math.round(raw / step) * step)))
  }
  return (
    <div ref={track} className={'slider-x' + (drag ? ' drag' : '') + (disabled ? ' off' : '')} role="slider" aria-disabled={disabled} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); onChange(Math.min(max, value + step)) }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); onChange(Math.max(min, value - step)) }
      }}
      // A click rolls the knob to the spot; it only tracks the pointer directly once the pointer actually moves.
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); pressX.current = e.clientX; at(e.clientX) }}
      onPointerMove={(e) => {
        if (pressX.current === null) return
        if (!drag && Math.abs(e.clientX - pressX.current) > 3) setDrag(true)
        if (drag) at(e.clientX)
      }}
      onPointerUp={() => { pressX.current = null; setDrag(false) }}>
      <div className="slider-fill" style={{ width: pct + '%' }} />
      <div className="slider-thumb" style={{ left: pct + '%' }} />
    </div>
  )
}

/**
 * A pill whose width springs to fit its label: it overshoots slightly, then settles.
 * The hidden copy measures the next label before it is shown.
 */
export function SpringPill({ className, title, onClick, icon, label }: { className: string; title: string; onClick: () => void; icon: ReactNode; label: string }) {
  const measure = useRef<HTMLSpanElement>(null)
  const [w, setW] = useState<number>()
  useLayoutEffect(() => {
    const fit = () => { if (measure.current) setW(Math.ceil(measure.current.getBoundingClientRect().width) + 2) }
    fit()
    void document.fonts?.ready.then(fit) // re-measure once Inter has loaded
  }, [label])
  return (
    <button className={'mode ' + className} title={title} onClick={onClick}>
      {icon}
      <span className="mode-track" style={{ width: w }}>
        <span key={label} className="mode-label">{label}</span>
      </span>
      <span ref={measure} className="mode-label measure" aria-hidden>{label}</span>
    </button>
  )
}

/** Minimise, maximise and close, drawn to match the app instead of the Windows frame. */
export function WindowControls() {
  if (!isDesktop) return null
  const win = () => import('@tauri-apps/api/window').then((m) => m.getCurrentWindow())
  return (
    <div className="winctl">
      <button title="Minimise" onClick={() => void win().then((w) => w.minimize())}><svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" strokeWidth="1.2" /></svg></button>
      <button title="Maximise" onClick={() => void win().then((w) => w.toggleMaximize())}><svg width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg></button>
      <button className="close" title="Close" onClick={() => void win().then((w) => w.close())}><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.2" /></svg></button>
    </div>
  )
}

/**
 * Audio level, the way a good console shows it: a green, yellow and red scale revealed by the level, rising at once,
 * falling back smoothly (it never snaps), with a peak line that holds for a moment and then drifts down.
 * Animates outside React, so a level arriving 30 times a second costs no re-renders.
 */
export function LevelMeter({ level, vertical, className }: { level: number; vertical?: boolean; className?: string }) {
  const target = useRef(level)
  target.current = level
  const fill = useRef<HTMLSpanElement>(null)
  const peak = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let shown = 0, held = 0, heldAt = 0, last = performance.now(), raf = 0
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const t = Math.max(0, Math.min(1, target.current))
      // rise straight away, fall at about 1.2 of the scale per second
      shown = t > shown ? t : Math.max(t, shown - 1.2 * dt)
      if (shown >= held) { held = shown; heldAt = now } else if (now - heldAt > 900) held = Math.max(shown, held - 0.6 * dt)
      const prop = vertical ? 'height' : 'width'
      if (fill.current) fill.current.style[prop] = (shown * 100).toFixed(1) + '%'
      if (peak.current) {
        peak.current.style[vertical ? 'bottom' : 'left'] = `calc(${(held * 100).toFixed(1)}% - 1px)`
        peak.current.style.opacity = held > 0.02 ? '1' : '0'
        peak.current.classList.toggle('hot', held > 0.92)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [vertical])
  return (
    <span className={'lvl' + (vertical ? ' v' : '') + (className ? ' ' + className : '')}>
      <span ref={fill} className="lvl-fill"><span className="lvl-scale" /></span>
      <span ref={peak} className="lvl-peak" />
    </span>
  )
}

/** A dropdown that matches the app: a quiet button, and a floating list with the chosen item ticked. */
export function Select<T extends string>({ value, options, onChange, onOpen, placeholder }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; onOpen?: () => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', away); window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc) }
  }, [open])
  const current = options.find((o) => o.value === value)
  return (
    <div className={'sel' + (open ? ' open' : '')} ref={box}>
      <button type="button" className="sel-btn" onClick={() => { if (!open) onOpen?.(); setOpen(!open) }}>
        <span>{current?.label ?? placeholder ?? ''}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="sel-list" role="listbox">
          {options.map((o) => (
            <button key={o.value} type="button" role="option" aria-selected={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => { onChange(o.value); setOpen(false) }}>
              <span>{o.label}</span>
              {o.value === value && <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden><path d="M1 5l3.5 3.5L11 1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
