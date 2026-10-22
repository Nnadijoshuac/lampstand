/**
 * The projector window. It lives on the extended display, full screen and above everything else there.
 * Windows tells us when displays change (WM_DISPLAYCHANGE, relayed by src-tauri/src/displays.rs), so there
 * is no polling: if the extended display is unplugged the projector tucks itself away (it never covers the
 * operator's screen), and when a display is plugged back in it returns there.
 */
import { isDesktop } from './stt'

type Win = Awaited<ReturnType<typeof import('@tauri-apps/api/window').Window.getByLabel>>

let wanted = false
let unlisten: (() => void) | undefined
let lastKey = ''
let busy = false

async function api() {
  const win = await import('@tauri-apps/api/window')
  const dpi = await import('@tauri-apps/api/dpi')
  return { win, dpi }
}

/** The display to project on: any display other than the one the operator window is on. */
async function targetMonitor() {
  const { win } = await api()
  const all = await win.availableMonitors()
  const main = await win.currentMonitor()
  const primary = await win.primaryMonitor()
  const away = all.filter((m) => m.name !== main?.name)
  return away.find((m) => m.name !== primary?.name) ?? away[0]
}

/** The display a window is on, from where its centre is. */
async function monitorOf(w: NonNullable<Win>, all: Awaited<ReturnType<typeof import('@tauri-apps/api/window').availableMonitors>>) {
  const p = await w.outerPosition()
  const sz = await w.outerSize()
  const x = p.x + sz.width / 2, y = p.y + sz.height / 2
  return all.find((m) => x >= m.position.x && x < m.position.x + m.size.width && y >= m.position.y && y < m.position.y + m.size.height)
}

async function place(w: NonNullable<Win>) {
  const { dpi } = await api()
  const mon = await targetMonitor()
  if (!mon) {
    // No extended display: never cover the operator's screen.
    await w.setAlwaysOnTop(false)
    await w.setFullscreen(false)
    await w.hide()
    return
  }
  await w.setFullscreen(false)
  await w.setPosition(new dpi.PhysicalPosition(mon.position.x + 20, mon.position.y + 20))
  await w.show()
  await w.setFullscreen(true)
  await w.setAlwaysOnTop(true)
}

async function check() {
  if (!wanted || busy) return
  busy = true
  try {
    const { win } = await api()
    const all = await win.availableMonitors()
    const key = all.map((m) => `${m.name}@${m.position.x},${m.position.y}`).sort().join('|')
    const w = await win.Window.getByLabel('output')
    if (!w) return
    const on = await monitorOf(w, all)
    const target = await targetMonitor()
    // Displays changed, or the projector is not on the extended display: put it back.
    if (key !== lastKey || (target && on?.name !== target.name) || (target && !(await w.isVisible()))) {
      lastKey = key
      await place(w)
    }
  } catch (e) {
    console.warn('projector watcher', e)
  } finally {
    busy = false
  }
}

/** True while the projector is meant to be up, so the size it reports is the real screen's. */
export const projecting = () => wanted

/** The extended display's size in CSS pixels (what the projector lays out in once it's full screen there). */
export async function displaySize(): Promise<{ w: number; h: number } | undefined> {
  if (!isDesktop) return undefined
  const mon = await targetMonitor().catch(() => undefined)
  return mon ? { w: Math.round(mon.size.width / mon.scaleFactor), h: Math.round(mon.size.height / mon.scaleFactor) } : undefined
}

export async function openProjector() {
  if (!isDesktop) return
  wanted = true
  lastKey = ''
  await check()
  if (!unlisten) {
    const { listen } = await import('@tauri-apps/api/event')
    // Displays settle a moment after the change message; check again shortly after it.
    unlisten = await listen('displays-changed', () => { void check(); setTimeout(() => void check(), 1200) })
  }
}

export async function closeProjector() {
  if (!isDesktop) return
  wanted = false
  unlisten?.(); unlisten = undefined
  const { win } = await api()
  const w = await win.Window.getByLabel('output')
  if (!w) return
  await w.setAlwaysOnTop(false)
  await w.setFullscreen(false)
  await w.hide()
}
