/** Operator window -> output window messaging. Both windows share an origin, so BroadcastChannel is enough. */
import type { SlideTheme } from '@shared/bsTheme'

export interface Slide {
  reference: string
  version: string
  html: string
  /** Extra verses shown above/below when a range is projected. */
  blank?: boolean
}

export interface OutputStyle {
  theme: 'night' | 'light' | 'green'
  font: 'bold' | 'serif' | 'sans'
  scale: number
  /** Show the words of Jesus in red. */
  redLetters: boolean
  /** How one verse gives way to the next on the projector. */
  transition: 'none' | 'fade' | 'rise' | 'dissolve' | 'zoom'
  /** Transition length in milliseconds. */
  duration: number
  /** Full screen, or a band across the bottom for livestreams and stage screens. */
  layout?: 'full' | 'lower'
  /** An imported theme (Bible Show) that replaces the built-in look. Saved by id; the theme itself travels with each message. */
  lookId?: string
  look?: SlideTheme
  /** Text size per imported theme (1 = as the theme sets it), keyed by theme id. */
  themeSizes?: Record<string, number>
}

export type BusMessage =
  | { type: 'slide'; slide: Slide }
  | { type: 'style'; style: OutputStyle }
  | { type: 'hello' }
  /** The projector's size in CSS pixels, so the operator's preview lays out at exactly that size. */
  | { type: 'screen'; w: number; h: number }

export const bus = new BroadcastChannel('lampstand')
