import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
