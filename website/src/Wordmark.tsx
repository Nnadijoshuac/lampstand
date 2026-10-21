import { useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * The name fills the screen as a stencil with warm light behind it. Scrolling dives into the middle letter,
 * the "s", until its stroke covers the screen; the light then gives way to the product.
 */
export default function Wordmark({ image, light, theme }: { image: string; light?: string; theme: 'dark' | 'light' }) {
  const section = useRef<HTMLDivElement>(null)
  const stencil = useRef<SVGGElement>(null)
  const word = useRef<SVGTextElement>(null)
  const glow = useRef<HTMLDivElement>(null)
  const shot = useRef<HTMLDivElement>(null)
  const caption = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1440, h: 900 })

  useLayoutEffect(() => {
    const fit = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  useLayoutEffect(() => {
    const text = word.current, g = stencil.current
    if (!text || !g || !section.current) return
    // The middle of the "s" (fifth letter) lies on its stroke, so zooming there opens the stencil completely.
    const box = text.getExtentOfChar(4)
    const ox = box.x + box.width * 0.5
    const oy = box.y + box.height * 0.6
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: section.current, start: 'top top', end: 'bottom bottom', scrub: 0.6 } })
      tl.fromTo(glow.current, { scale: 1.15 }, { scale: 1, ease: 'none', duration: 0.6 }, 0)
      tl.to(g, { scale: 90, svgOrigin: `${ox} ${oy}`, ease: 'power3.in', duration: 0.55 }, 0.12)
      tl.fromTo(shot.current, { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, ease: 'power2.out', duration: 0.25 }, 0.6)
      tl.fromTo(caption.current, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.12 }, 0.84)
    }, section)
    return () => ctx.revert()
  }, [size])

  const fill = theme === 'light' ? '#f4eedf' : '#050505'
  const fontSize = Math.min(size.w * 0.17, size.h * 0.42)
  return (
    <section ref={section} className="relative h-[340vh]" aria-label="Lampstand">
      <div className="sticky top-0 h-screen overflow-hidden">
        <div ref={glow} className="absolute inset-0">
          {light
            ? <img src={light} alt="" className="h-full w-full object-cover" />
            : <div className="h-full w-full bg-[radial-gradient(60%_70%_at_50%_55%,#fff4d6_0%,#f0c97a_28%,#b9782d_55%,#3a2410_80%,#0b0703_100%)]" />}
        </div>
        <div ref={shot} className="absolute inset-0 grid place-items-center bg-[var(--bg)] px-[5vw] pt-16">
          <img src={image} alt="Lampstand following a sermon, with the verse being read on the projector" className="w-full max-w-6xl rounded-xl ring-1 ring-[var(--line)] shadow-[0_40px_140px_-30px_rgba(0,0,0,0.7)]" />
        </div>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden>
          <defs>
            <mask id="lampstand-stencil" maskUnits="userSpaceOnUse" x={-size.w} y={-size.h} width={size.w * 3} height={size.h * 3}>
              <rect x={-size.w} y={-size.h} width={size.w * 3} height={size.h * 3} fill="white" />
              <text ref={word} x={size.w / 2} y={size.h / 2 + fontSize * 0.36} textAnchor="middle" fontSize={fontSize} fontWeight={700} letterSpacing={-fontSize * 0.04} fontFamily="Inter, system-ui, sans-serif" fill="black">
                Lampstand
              </text>
            </mask>
          </defs>
          <g ref={stencil}>
            <rect x={-size.w} y={-size.h} width={size.w * 3} height={size.h * 3} fill={fill} mask="url(#lampstand-stencil)" />
          </g>
        </svg>
        <div ref={caption} className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/85 to-transparent px-5 pb-12 pt-32 sm:px-10">
          <p className="mx-auto max-w-[1400px] text-xl leading-snug sm:text-2xl">
            The pastor turns to Ephesians 6. <span className="text-[var(--dim)]">The verse is already on the screen.</span>
          </p>
        </div>
      </div>
    </section>
  )
}
