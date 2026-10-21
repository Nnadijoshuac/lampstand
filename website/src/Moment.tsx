import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/** A full-bleed photograph from a service, drifting slowly as it scrolls, with a line of text in one corner. */
export default function Moment({ image, alt, title, body, align = 'left' }: { image: string; alt: string; title: string; body: string; align?: 'left' | 'right' }) {
  const root = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const text = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(img.current, { scale: 1.12, yPercent: -4 }, { scale: 1, yPercent: 4, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: true } })
      gsap.fromTo(text.current, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 1, scrollTrigger: { trigger: root.current, start: 'top 55%' } })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={root} className="relative h-[92vh] min-h-[560px] overflow-hidden">
      <img ref={img} src={image} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      <div className={'absolute inset-0 ' + (align === 'left' ? 'bg-gradient-to-tr' : 'bg-gradient-to-tl') + ' from-black/85 via-black/30 to-transparent'} />
      <div ref={text} className={'absolute bottom-0 max-w-xl px-5 pb-16 text-[#f4eedf] sm:px-10 sm:pb-20 ' + (align === 'left' ? 'left-0' : 'right-0 text-right')}>
        <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl">{title}</h2>
        <p className={'mt-5 text-lg leading-relaxed text-[#f4eedf]/75 ' + (align === 'right' ? 'ml-auto' : '')}>{body}</p>
      </div>
    </section>
  )
}
