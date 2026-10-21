/**
 * Projector themes brought over from Bible Show. The operator picks the Bible Show folder; every .thm theme
 * comes across with its background picture or video and its preview card, plus the look Bible Show was
 * using when it last closed (the [Theme] section of BibleShow.ini). Stored in IndexedDB: pictures are too
 * big for localStorage.
 */
import * as idb from './idb'
import { decodeText, parseTheme, readIni, type SlideTheme } from '@shared/bsTheme'

const KEY = 'themes'

export async function loadThemes(): Promise<SlideTheme[]> {
  return (await idb.get<SlideTheme[]>(KEY)) ?? []
}

export async function saveThemes(themes: SlideTheme[]): Promise<void> {
  await idb.set(KEY, themes)
}

const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm' }

/** The file as a data URL, so it can be stored and sent to the projector window as plain text. */
async function dataUrl(f: File): Promise<string> {
  const bytes = new Uint8Array(await f.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  const type = f.type || TYPES[f.name.split('.').pop()!.toLowerCase()] || 'application/octet-stream'
  return `data:${type};base64,${btoa(bin)}`
}

/** Average colour of a picture: stands in for a background that could not be brought over. */
async function averageColor(url: string): Promise<string | undefined> {
  try {
    const img = new Image()
    img.src = url
    await Promise.race([img.decode(), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3000))])
    const c = document.createElement('canvas')
    c.width = c.height = 8
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0, 8, 8)
    const px = g.getImageData(0, 0, 8, 8).data
    let r = 0, gr = 0, b = 0
    for (let i = 0; i < px.length; i += 4) { r += px[i]; gr += px[i + 1]; b += px[i + 2] }
    const n = px.length / 4
    return `rgb(${Math.round(r / n)}, ${Math.round(gr / n)}, ${Math.round(b / n)})`
  } catch { return undefined }
}

export interface BibleShowImport {
  themes: SlideTheme[]
  /** Theme to select: the look Bible Show had on screen. */
  current?: string
  /** Bible Show's "words of Christ in red" setting. */
  redLetters?: boolean
  /** Backgrounds that could not come across (missing, or a video format the projector cannot play). */
  missing: string[]
  bibles: number
}

/** Browsers play these; Bible Show's .wmv videos must be converted (an .mp4 of the same name is picked up). */
const PLAYABLE = ['mp4', 'webm', 'm4v']

export async function importBibleShowFolder(list: FileList | File[]): Promise<BibleShowImport> {
  const files = Array.from(list)
  const byName = new Map(files.map((f) => [f.name.toLowerCase(), f]))
  const find = (name: string) => byName.get(name.toLowerCase())
  const missing: string[] = []

  const attach = async (t: SlideTheme) => {
    const bg = t.background
    if (bg.kind !== 'picture' && bg.kind !== 'video') return
    const stem = (bg.file ?? '').replace(/\.[^.]+$/, '')
    const file = bg.kind === 'picture' ? find(bg.file ?? '') : PLAYABLE.map((x) => find(`${stem}.${x}`)).find(Boolean)
    if (file) { t.media = await dataUrl(file); return }
    if (bg.file && !missing.includes(bg.file)) missing.push(bg.file)
    // Without its background the theme still keeps its text styling, over the picture's overall colour.
    const avg = t.thumb ? await averageColor(t.thumb) : undefined
    t.background = { ...bg, kind: 'color', color: avg ?? '#000000' }
  }

  const themes: SlideTheme[] = []
  for (const f of files.filter((f) => /\.thm$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name))) {
    const stem = f.name.replace(/\.thm$/i, '')
    const t = parseTheme(decodeText(new Uint8Array(await f.arrayBuffer())), stem)
    const card = find(stem + '.jpg')
    if (card) t.thumb = await dataUrl(card)
    await attach(t)
    themes.push(t)
  }

  let current: string | undefined
  let redLetters: boolean | undefined
  const ini = find('bibleshow.ini')
  if (ini) {
    const text = decodeText(new Uint8Array(await ini.arrayBuffer()))
    const prefs = readIni(text, 'Preferences')
    if (prefs.WordsOfChrist) redLetters = prefs.WordsOfChrist !== '0'
    if (/^\s*\[Theme\]/im.test(text)) {
      // Bible Show's working copy of a theme, which may hold changes never saved to a theme file.
      const t = parseTheme(text, 'Current')
      t.id = 'bs:current'
      t.name = 'As last used in Bible Show'
      await attach(t)
      themes.unshift(t)
      current = t.id
    }
    // The theme the church picked by name wins: the working copy can be left over from editing another one.
    if (prefs.ThemeName && themes.some((t) => t.id === 'bs:' + prefs.ThemeName)) current = 'bs:' + prefs.ThemeName
  }

  return { themes, current, redLetters, missing, bibles: files.filter((f) => /\.bib$/i.test(f.name)).length }
}
