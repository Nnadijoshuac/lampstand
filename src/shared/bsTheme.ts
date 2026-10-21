/**
 * Bible Show themes (.thm, and the [Theme] section of BibleShow.ini): UTF-16 "Key=Value" text describing the
 * background and how the reference and verse are drawn. Positions are percentages of the screen; font sizes
 * and outline/shadow widths are WPF pixels on a 1080-line output, so they scale with the screen.
 */

/** A rectangle in percent of the screen. */
export interface Box { left: number; top: number; width: number; height: number }

export interface TextLook {
  family: string
  weight: number
  italic: boolean
  decoration: 'none' | 'underline' | 'overline'
  /** CSS font-stretch: 'normal', 'condensed'… */
  stretch: string
  /** Largest size in pixels at 1080 lines; text shrinks below it to fit its box. */
  maxSize: number
  color: string
  alignH: 'left' | 'center' | 'right'
  alignV: 'top' | 'middle' | 'bottom'
  outline: number
  outlineColor: string
  shadow: number
  shadowAngle: number
  shadowColor: string
  glow: number
  glowColor: string
}

export interface SlideTheme {
  id: string
  name: string
  background: {
    kind: 'color' | 'picture' | 'video' | 'animation'
    color: string
    /** Colours an animated background flows through. */
    colors: string[]
    speed: number
    /** File name of the picture or video, as Bible Show stores it. */
    file?: string
    /** Frame round the whole screen, in WPF pixels at 1080 lines. */
    border: { width: number; radius: number; color: string }
    /** Picture adjustments, as a CSS filter ('' when none). */
    filter: string
  }
  ref: TextLook
  verse: TextLook
  refBox: Box
  verseBox: Box
  /** How the words of Jesus differ from the rest of the verse. */
  jesus: { weight: number; italic: boolean; underline: boolean }
  /** Filled in on import: the picture or video itself (data URL), and Bible Show's preview card. */
  media?: string
  thumb?: string
}

/** "Key=Value" lines; with `section`, only that [section]. */
export function readIni(text: string, section?: string): Record<string, string> {
  const out: Record<string, string> = {}
  let inside = !section
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim()
    const head = line.match(/^\[(.+)\]$/)
    if (head) { inside = !section || head[1].toLowerCase() === section.toLowerCase(); continue }
    if (!inside || !line || line.startsWith(';')) continue
    const eq = line.indexOf('=')
    if (eq > 0) out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return out
}

/** "#AARRGGBB" (WPF) to CSS. */
export function wpfColor(v: string | undefined, fallback = '#ffffff'): string {
  const m = v?.match(/^#([0-9a-f]{2})?([0-9a-f]{6})$/i)
  if (!m) return fallback
  const a = m[1] === undefined ? 1 : parseInt(m[1], 16) / 255
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[2].slice(i, i + 2), 16))
  return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${+a.toFixed(3)})`
}

const WEIGHTS: Record<string, number> = { thin: 100, extralight: 200, ultralight: 200, light: 300, normal: 400, regular: 400, medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900 }
const num = (v: string | undefined, fallback: number) => (v !== undefined && v !== '' && Number.isFinite(+v) ? +v : fallback)
const align = <T extends string>(v: string | undefined, ok: readonly T[], fallback: T): T => {
  const x = (v ?? '').toLowerCase() === 'centre' ? 'center' : (v ?? '').toLowerCase()
  return (ok as readonly string[]).includes(x) ? (x as T) : fallback
}

const decoration = (v: string | undefined): TextLook['decoration'] => (/overline/i.test(v ?? '') ? 'overline' : /underline/i.test(v ?? '') ? 'underline' : 'none')

/** Bible Show's picture adjustments (each roughly -10..10) as a CSS filter. */
function bgFilter(d: Record<string, string>): string {
  const f: string[] = []
  const b = num(d.BgEnhBrightness, 0), c = num(d.BgEnhContrast, 0), s = num(d.BgEnhSaturation, 0), blur = num(d.BgEffBlur, 0), g = num(d.BgEnhGamma, 0)
  if (b || g) f.push(`brightness(${+(1 + b / 20 + g / 40).toFixed(3)})`)
  if (c) f.push(`contrast(${+(1 + c / 20).toFixed(3)})`)
  if (s) f.push(`saturate(${+(1 + s / 10).toFixed(3)})`)
  if (blur) f.push(`blur(${+(blur / 10).toFixed(2)}vmin)`)
  if (num(d.BgEffSketch, 0)) f.push('grayscale(1)')
  return f.join(' ')
}

function look(d: Record<string, string>, p: 'Ref' | 'Ver', size: number): TextLook {
  return {
    family: d[`${p}FntFamily`] || 'Segoe UI',
    weight: WEIGHTS[(d[`${p}FntWeight`] ?? '').toLowerCase()] ?? 400,
    italic: /italic|oblique/i.test(d[`${p}FntStyle`] ?? ''),
    decoration: decoration(d[`${p}Decoration`]),
    stretch: (d[`${p}FntStretch`] ?? 'Normal').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
    maxSize: num(d[`${p}FntMaxSize`], size),
    color: wpfColor(d[`${p}FntColor`]),
    alignH: align(d[`${p}AlignHoriz`], ['left', 'center', 'right'] as const, 'center'),
    alignV: align(d[`${p}AlignVert`], ['top', 'middle', 'bottom'] as const, 'middle'),
    outline: num(d[`${p}OutlineThick`], 0),
    outlineColor: wpfColor(d[`${p}OutlineColor`], '#000000'),
    shadow: num(d[`${p}ShadowDepth`], 0),
    shadowAngle: num(d[`${p}ShadowAngle`], 315),
    shadowColor: wpfColor(d[`${p}ShadowColor`], '#000000'),
    // Bible Show keeps one glow setting, used for the verse; the reference has none of its own.
    glow: p === 'Ver' ? num(d.VerGlowRadius, 0) : 0,
    glowColor: wpfColor(d.VerGlowColor, '#000000')
  }
}

/** "VideoNightStars01_02" -> "Video Night Stars 2", "ColorBlack01_01lower" -> "Color Black (lower third)". */
export function displayName(file: string): string {
  const m = file.match(/^(.*?)(\d+)_(\d+)(lower)?$/i)
  const words = (m ? m[1] : file).replace(/([a-z])([A-Z])/g, '$1 $2')
  if (!m) return words
  const n = Math.max(+m[2], 1) * 100 + +m[3] // keep variants apart without showing "01"
  return words + (n > 101 ? ' ' + (+m[3] > 1 ? +m[3] : +m[2]) : '') + (m[4] ? ' (lower third)' : '')
}

/** Reads one theme. `name` is the file name without ".thm". */
export function parseTheme(text: string, name: string): SlideTheme {
  const d = readIni(text, /^\s*\uFEFF?\[Theme\]/im.test(text) ? 'Theme' : undefined)
  const kind = (d.Background ?? 'Color').toLowerCase()
  const margin = num(d.LayMargin, 2)
  // A "symmetrical" layout ignores any stored boxes: the reference gets a band at the top (or the bottom, with
  // LowerReference) and the verse the rest, inside an even margin. LayProp is how many times taller the verse
  // area is than the reference band. Otherwise the stored boxes are used as they are.
  const symmetrical = d.SymmetricalLayout !== undefined ? d.SymmetricalLayout !== '0' : !d.ReferenceTop
  const lowerRef = d.LowerReference === '-1'
  const prop = num(d.LayProp, 7) || 7
  const avail = 100 - 3 * margin
  const refH = avail / (1 + prop)
  const verseH = avail - refH
  const box = (k: 'Reference' | 'Verse', fallback: Box): Box =>
    !symmetrical && d[`${k}Top`] ? { left: num(d[`${k}Left`], fallback.left), top: num(d[`${k}Top`], fallback.top), width: num(d[`${k}Width`], fallback.width), height: num(d[`${k}Height`], fallback.height) } : fallback
  return {
    id: 'bs:' + name,
    name: displayName(name),
    background: {
      kind: kind === 'picture' ? 'picture' : kind === 'video' ? 'video' : kind === 'animation' ? 'animation' : 'color',
      color: wpfColor(d.BgColor, '#000000'),
      colors: [1, 2, 3, 4].map((i) => d[`BgAniColor${i}`]).filter(Boolean).map((c) => wpfColor(c)),
      speed: num(d.BgAniSpeed, 10),
      file: (kind === 'picture' ? d.BgPicPath : kind === 'video' ? d.BgVidPath : undefined) || undefined,
      border: { width: num(d.BgBorderThick, 0), radius: num(d.BgBorderRadius, 0), color: wpfColor(d.BgBorderColor, 'transparent') },
      filter: bgFilter(d)
    },
    ref: look(d, 'Ref', 60),
    verse: look(d, 'Ver', 72),
    refBox: box('Reference', { left: margin, top: lowerRef ? 2 * margin + verseH : margin, width: 100 - 2 * margin, height: refH }),
    verseBox: box('Verse', { left: margin, top: lowerRef ? margin : 2 * margin + refH, width: 100 - 2 * margin, height: verseH }),
    jesus: { weight: WEIGHTS[(d.WocFntWeight ?? '').toLowerCase()] ?? 700, italic: /italic/i.test(d.WocFntStyle ?? ''), underline: /underline/i.test(d.WocDecoration ?? '') }
  }
}

/** Bible Show files are UTF-16 with a byte-order mark; older ones may be plain text. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  return new TextDecoder('utf-8').decode(bytes)
}
