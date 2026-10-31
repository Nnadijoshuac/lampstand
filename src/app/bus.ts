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
  /** How the 16:9 program meets a projector of another shape: stretched to cover it, or whole with bars. */
  fit?: 'fill' | 'fit'
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

export const bus = new BroadcastChannel('lampstand')

/** The livestream feed (vMix, OBS): when on, every slide and style also goes to the feed server in the app. */
const feed = { on: false, slide: undefined as Slide | undefined, style: undefined as OutputStyle | undefined }
export function setFeedOn(on: boolean) { feed.on = on; forward() }
function forward() {
  if (!feed.on || !feed.slide || !feed.style) return
  const json = JSON.stringify({ slide: feed.slide, style: feed.style })
  void import('@tauri-apps/api/core').then(({ invoke }) => invoke('feed_push', { json })).catch(() => {})
}

/** Sends to the projector window, and to the livestream feed when it is on. */
export function send(msg: BusMessage) {
  bus.postMessage(msg)
  if (msg.type === 'slide') feed.slide = msg.slide
  if (msg.type === 'style') feed.style = msg.style
  if (msg.type !== 'hello') forward()
}
