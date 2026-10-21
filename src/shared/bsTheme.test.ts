import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { decodeText, displayName, parseTheme, readIni, wpfColor } from './bsTheme'

const BLACK = `[Theme]
Background=Color
BgColor=#FF000000
LayMargin=2
LayProp=7
RefFntFamily=Trebuchet MS
RefFntWeight=Normal
RefFntMaxSize=60
RefFntColor=#FFECECC5
VerFntFamily=Trebuchet MS
VerFntWeight=Bold
VerFntMaxSize=72
VerFntColor=#FFFFFFFF
VerOutlineThick=0
VerShadowDepth=0
VerGlowRadius=5
VerGlowColor=#FF000000
WocFntWeight=Bold
WocFntStyle=Italic`

describe('Bible Show themes', () => {
  it('reads WPF colours', () => {
    expect(wpfColor('#FFECECC5')).toBe('rgb(236, 236, 197)')
    expect(wpfColor('#00000000')).toBe('rgba(0, 0, 0, 0)')
    expect(wpfColor('#C6000000')).toBe('rgba(0, 0, 0, 0.776)')
  })
  it('names themes like people would', () => {
    expect(displayName('VideoNightStars01_02')).toBe('Video Night Stars 2')
    expect(displayName('ColorBlack01_01lower')).toBe('Color Black (lower third)')
    expect(displayName('BibleCandle04_01')).toBe('Bible Candle 4')
  })
  it('reads one section of an ini', () => {
    expect(readIni('[A]\nx=1\n[Theme]\nx=2\n', 'Theme').x).toBe('2')
  })
  it('parses a colour theme and lays out the default boxes', () => {
    const t = parseTheme(BLACK, 'ColorBlack01_01')
    expect(t.name).toBe('Color Black')
    expect(t.background).toMatchObject({ kind: 'color', color: 'rgb(0, 0, 0)' })
    expect(t.verse).toMatchObject({ family: 'Trebuchet MS', weight: 700, maxSize: 72, glow: 5 })
    expect(t.ref).toMatchObject({ weight: 400, color: 'rgb(236, 236, 197)' })
    expect(t.refBox.top).toBe(2)
    expect(t.verseBox.top + t.verseBox.height).toBeCloseTo(98)
    expect(t.jesus).toEqual({ weight: 700, italic: true, underline: false })
  })
  it('uses explicit boxes when the theme has them', () => {
    const t = parseTheme(BLACK + '\nReferenceTop=82\nReferenceLeft=29\nReferenceWidth=68\nReferenceHeight=4.6', 'LowerThird01_01')
    expect(t.refBox).toEqual({ left: 29, top: 82, width: 68, height: 4.6 })
  })
  it('decodes UTF-16 files', () => {
    const bytes = new Uint8Array([0xff, 0xfe, ...[...'[Theme]'].flatMap((c) => [c.charCodeAt(0), 0])])
    expect(decodeText(bytes)).toBe('[Theme]')
  })

  const dir = 'D:/BibleShow5/Themes'
  it.skipIf(!existsSync(dir))('parses every theme in a real Bible Show install', () => {
    for (const n of ['ColorBlack01_01', 'LowerThird01_01', 'AnimationBlue01_01', 'VideoNightStars01_02', 'BibleCandle04_01']) {
      const t = parseTheme(decodeText(readFileSync(`${dir}/${n}.thm`)), n)
      expect(t.verse.maxSize).toBeGreaterThan(20)
      expect(t.verseBox.width).toBeGreaterThan(20)
    }
    expect(parseTheme(decodeText(readFileSync(`${dir}/BibleCandle04_01.thm`)), 'x').background).toMatchObject({ kind: 'picture', file: 'BibleCandle04.jpg' })
    expect(parseTheme(decodeText(readFileSync(`${dir}/AnimationBlue01_01.thm`)), 'x').background.colors.length).toBe(4)
  })
})
