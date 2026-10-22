import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { bus, type BusMessage, type OutputStyle, type Slide } from './bus'
import type { Box, SlideTheme, TextLook } from '@shared/bsTheme'

const THEMES = {
  night: { bg: '#000000', fg: '#ffffff', accent: '#ffffff' },
  light: { bg: '#f4eedf', fg: '#14161d', accent: '#111111' },
  green: { bg: '#00b140', fg: '#ffffff', accent: '#ffffff' }
}

export const DEFAULT_STYLE: OutputStyle = { theme: 'night', font: 'bold', scale: 1, redLetters: true, transition: 'fade', duration: 350, layout: 'full' }

type Unit = 'vmin' | 'cqmin'

/** Shrinks the text from `start` (in `unit`) until it fits its box. */
function useFit(box: RefObject<HTMLDivElement>, text: RefObject<HTMLDivElement>, start: number, unit: Unit, deps: unknown[]) {
  useLayoutEffect(() => {
    const fit = () => {
      const b = box.current, t = text.current
      if (!b || !t) return
      let size = start
      t.style.fontSize = size + unit
      while (size > 1 && (t.scrollHeight > b.clientHeight || t.scrollWidth > b.clientWidth)) {
        size -= Math.max(0.1, size * 0.03)
        t.style.fontSize = size + unit
      }
    }
    fit()
    // Fit again once the fonts are in: measured with a fallback font, the size would differ from the projector's.
    void document.fonts?.ready.then(fit)
    const ro = new ResizeObserver(fit)
    if (box.current) ro.observe(box.current)
    return () => ro.disconnect()
  }, [start, unit, ...deps])
}

/** Bible Show sizes are WPF pixels on a 1080-line screen: 10.8 of them make one vmin. */
const wpf = (n: number, unit: Unit) => `${+(n / 10.8).toFixed(3)}${unit}`

function textStyle(l: TextLook, unit: Unit): CSSProperties {
  const shadows: string[] = []
  // The outline is a ring of hard shadows behind the letters: it never eats into them or hides an underline.
  if (l.outline > 0) {
    const steps = l.outline > 2 ? 16 : 8
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * 2 * Math.PI
      shadows.push(`${wpf(Math.cos(a) * l.outline, unit)} ${wpf(Math.sin(a) * l.outline, unit)} 0 ${l.outlineColor}`)
    }
  }
  if (l.shadow > 0) {
    const a = (l.shadowAngle * Math.PI) / 180 // WPF: 0 is right, counting anticlockwise; 315 falls to the lower right
    shadows.push(`${wpf(Math.cos(a) * l.shadow, unit)} ${wpf(-Math.sin(a) * l.shadow, unit)} ${wpf(l.shadow * 0.8, unit)} ${l.shadowColor}`)
  }
  if (l.glow > 0) shadows.push(`0 0 ${wpf(l.glow, unit)} ${l.glowColor}`, `0 0 ${wpf(l.glow / 2, unit)} ${l.glowColor}`)
  return {
    fontFamily: `'${l.family}', 'Segoe UI', sans-serif`,
    fontWeight: l.weight,
    fontStyle: l.italic ? 'italic' : 'normal',
    textDecoration: l.decoration,
    fontStretch: l.stretch,
    color: l.color,
    textAlign: l.alignH,
    textShadow: shadows.join(', ') || 'none'
  }
}

const place = (b: Box, l: TextLook): CSSProperties => ({
  left: b.left + '%', top: b.top + '%', width: b.width + '%', height: b.height + '%',
  justifyContent: l.alignV === 'top' ? 'flex-start' : l.alignV === 'bottom' ? 'flex-end' : 'center'
})

/** A theme whose verse sits in a band along the bottom of the screen. */
export const isLowerThird = (t: SlideTheme) => t.verseBox.top >= 50 && t.verseBox.top + t.verseBox.height >= 95

/** Text size a theme starts at, before the operator adjusts it: lower thirds read better a size down. */
export const themeScale = (t: SlideTheme, sizes?: Record<string, number>) => sizes?.[t.id] ?? (isLowerThird(t) ? 0.72 : 1)

/** A slide drawn the way an imported Bible Show theme draws it: reference and verse each in their own box. */
function ThemedContent({ slide, look, scale, unit }: { slide: Slide; look: SlideTheme; scale: number; unit: Unit }) {
  const refBox = useRef<HTMLDivElement>(null), refText = useRef<HTMLDivElement>(null)
  const verseBox = useRef<HTMLDivElement>(null), verseText = useRef<HTMLDivElement>(null)
  useFit(refBox, refText, (look.ref.maxSize / 10.8) * scale, unit, [slide, look])
  useFit(verseBox, verseText, (look.verse.maxSize / 10.8) * scale, unit, [slide, look])
  if (slide.blank) return null
  const verseStyle = { ...textStyle(look.verse, unit), ['--woc-weight' as string]: look.jesus.weight, ['--woc-style' as string]: look.jesus.italic ? 'italic' : 'normal', ['--woc-line' as string]: look.jesus.underline ? 'underline' : 'none' }
  if (isLowerThird(look)) {
    // Lower third: the verse runs edge to edge inside equal margins (left, right and bottom), sitting on the
    // bottom margin, with the reference riding just above its first line wherever that falls.
    const side = look.verseBox.left
    const bottom = side * (16 / 9) // the same gap in screen pixels as the side margins
    const width = 100 - 2 * side
    return (
      <div className="th-box th-lower" ref={verseBox} style={{ left: side + '%', width: width + '%', top: look.verseBox.top + '%', bottom: bottom + '%', justifyContent: 'flex-end' }}>
        <div className="th-stack">
          <div className="th-box th-lower-ref" ref={refBox} style={{ left: ((look.refBox.left - side) / width) * 100 + '%', width: (look.refBox.width / width) * 100 + '%', height: look.refBox.height + unit, justifyContent: 'flex-end' }}>
            <div ref={refText} className="th-ref" style={textStyle(look.ref, unit)}>{slide.reference}</div>
          </div>
          <div ref={verseText} className="th-verse justify" style={{ ...verseStyle, textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: slide.html }} />
        </div>
      </div>
    )
  }
  return (
    <>
      <div className="th-box" ref={refBox} style={place(look.refBox, look.ref)}>
        <div ref={refText} className="th-ref" style={textStyle(look.ref, unit)}>{slide.reference}</div>
      </div>
      <div className="th-box" ref={verseBox} style={place(look.verseBox, look.verse)}>
        <div ref={verseText} className="th-verse" style={verseStyle} dangerouslySetInnerHTML={{ __html: slide.html }} />
      </div>
    </>
  )
}

/** The theme's background: stays put while verses change over it. */
function ThemeBackground({ look, unit }: { look: SlideTheme; unit: Unit }) {
  const bg = look.background
  const b = bg.border
  const frame = b.width > 0 && <div className="th-frame" style={{ border: `${wpf(b.width, unit)} solid ${b.color}`, borderRadius: wpf(b.radius * 4, unit) }} />
  const fx = { filter: bg.filter || undefined }
  let fill
  if (bg.kind === 'picture' && look.media) fill = <img className="th-bg" src={look.media} alt="" style={fx} />
  else if (bg.kind === 'video' && look.media) fill = <video className="th-bg" src={look.media} autoPlay loop muted playsInline style={fx} />
  else if (bg.kind === 'animation' && bg.colors.length) {
    const c = [...bg.colors, bg.colors[0]].join(', ')
    fill = <div className="th-bg th-anim" style={{ backgroundImage: `linear-gradient(120deg, ${c})`, animationDuration: Math.max(4, 200 / Math.max(bg.speed, 1)) + 's' }} />
  } else fill = <div className="th-bg" style={{ background: bg.color }} />
  return <>{fill}{frame}</>
}

/** One slide's text, shrunk until it fits. */
function SlideContent({ slide, style, unit }: { slide: Slide; style: OutputStyle; unit: Unit }) {
  const box = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLDivElement>(null)
  useFit(box, text, (style.layout === 'lower' ? 5.2 : 8) * style.scale, unit, [slide, style.layout, style.font, style.look])

  if (style.look) return <ThemedContent slide={slide} look={style.look} scale={themeScale(style.look, style.themeSizes)} unit={unit} />
  if (slide.blank) return null
  const inner = (
    <>
      <div className="out-ref" style={{ color: style.layout === 'lower' ? undefined : THEMES[style.theme].accent }}>{slide.reference}</div>
      <div className="out-body" ref={box}>
        <div ref={text} className="out-text" dangerouslySetInnerHTML={{ __html: slide.html }} />
      </div>
    </>
  )
  // Lower third: the verse sits in a band across the bottom; the rest of the frame stays clear for video or keying.
  return style.layout === 'lower' ? <div className="band">{inner}</div> : inner
}

const sameSlide = (a: Slide, b: Slide) => a.blank === b.blank && a.reference === b.reference && a.html === b.html

/**
 * A rendered slide. `unit` is vmin for the projector and cqmin inside the operator preview, so the preview
 * is an exact scaled copy of what the congregation sees. Changes play the chosen transition: the old
 * slide leaves while the new one arrives.
 */
export function SlideView({ slide, style, unit }: { slide: Slide; style: OutputStyle; unit: 'vmin' | 'cqmin' }) {
  const seq = useRef(0)
  const [layers, setLayers] = useState([{ id: 0, slide, leaving: false }])

  useEffect(() => {
    setLayers((ls) => {
      const top = ls[ls.length - 1]
      if (sameSlide(top.slide, slide)) return ls.map((l) => (l === top ? { ...l, slide } : l))
      if (style.transition === 'none') return [{ id: ++seq.current, slide, leaving: false }]
      return [...ls.filter((l) => !l.leaving).map((l) => ({ ...l, leaving: true })), { id: ++seq.current, slide, leaving: false }]
    })
  }, [slide, style.transition])

  useEffect(() => {
    if (!layers.some((l) => l.leaving)) return
    const t = setTimeout(() => setLayers((ls) => ls.filter((l) => !l.leaving)), style.duration + 30)
    return () => clearTimeout(t)
  }, [layers, style.duration])

  const th = THEMES[style.theme]
  if (style.look) {
    return (
      <div className={'slide themed ' + unit + (style.redLetters === false ? ' plain' : '')} style={{ ['--dur' as string]: style.duration + 'ms' }}>
        <ThemeBackground look={style.look} unit={unit} />
        {layers.map((l) => (
          <div key={l.id} className={'layer tr-' + style.transition + (l.leaving ? ' out' : ' in')}>
            <SlideContent slide={l.slide} style={style} unit={unit} />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className={'slide ' + unit + ' f-' + style.font + ' t-' + style.theme + (style.layout === 'lower' ? ' lower' : '') + (style.redLetters === false ? ' plain' : '')}
      style={{ background: th.bg, color: th.fg, fontFamily: style.font === 'serif' ? "Georgia, 'Times New Roman', serif" : "'Inter Variable', 'Segoe UI', sans-serif", fontWeight: style.font === 'bold' ? 800 : 400, ['--dur' as string]: style.duration + 'ms' }}>
      {layers.map((l) => (
        <div key={l.id} className={'layer tr-' + style.transition + (l.leaving ? ' out' : ' in')}>
          <SlideContent slide={l.slide} style={style} unit={unit} />
        </div>
      ))}
    </div>
  )
}

/** The program's resolution. Every slide is laid out once on this canvas, whatever display shows it. */
export const PROGRAM = { w: 1920, h: 1080 }

/**
 * The program canvas, scaled to its box: down for the operator's previews, up for the projector. Line breaks, text
 * sizes and positions are worked out on the 1920 × 1080 canvas, so every view is the same picture, pixel for pixel,
 * and no display can change the layout. "fill" stretches the picture over a box of another shape (a 16:10 or 4:3
 * projector). "fit" keeps its shape, with bars.
 */
export function ScreenFrame({ children, fit = 'fit' }: { children: ReactNode; fit?: 'fill' | 'fit' }) {
  const { w, h } = PROGRAM
  const outer = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ sx: 0, sy: 0, x: 0, y: 0 })
  useLayoutEffect(() => {
    const el = outer.current
    if (!el) return
    const measure = () => {
      const cw = el.clientWidth, ch = el.clientHeight
      if (fit === 'fill') return setBox({ sx: cw / w, sy: ch / h, x: 0, y: 0 })
      const s = Math.min(cw / w, ch / h)
      setBox({ sx: s, sy: s, x: (cw - w * s) / 2, y: (ch - h * s) / 2 })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [w, h, fit])
  return (
    <div ref={outer} className="screen-frame">
      <div className="screen-canvas" style={{ width: w, height: h, transform: `translate(${box.x}px, ${box.y}px) scale(${box.sx}, ${box.sy})`, visibility: box.sx ? 'inherit' : 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

/** Fullscreen projector window. */
export function Output() {
  const [slide, setSlide] = useState<Slide>({ reference: '', version: '', html: '', blank: true })
  const [style, setStyle] = useState<OutputStyle>(DEFAULT_STYLE)

  useEffect(() => {
    bus.onmessage = (e: MessageEvent<BusMessage>) => {
      if (e.data.type === 'slide') setSlide(e.data.slide)
      if (e.data.type === 'style') setStyle(e.data.style)
    }
    bus.postMessage({ type: 'hello' } satisfies BusMessage)
  }, [])

  return <div className="output"><ScreenFrame fit={style.fit ?? 'fill'}><SlideView slide={slide} style={style} unit="cqmin" /></ScreenFrame></div>
}
