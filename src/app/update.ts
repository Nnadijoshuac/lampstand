/**
 * Updates and the small download, from the website's update.json (written by scripts/sign-update.mjs). The desktop
 * app checks it when it starts and every few hours. Installing is always a click, never during Listen, and the Rust
 * side (src-tauri/src/update.rs) installs only files signed with the release key.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { isDesktop, trace } from './stt'

export const SITE = 'https://nnadijoshuac.github.io/lampstand/'

interface Signed { url: string; size: number; signature: string }
interface Manifest { version: string; notes: string; full: boolean; exe: Signed; models?: Signed }

const newer = (a: string, b: string) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return false
}

async function core() {
  return (await import('@tauri-apps/api/core')).invoke
}

export interface Models { busy: boolean; got: number; size: number; error?: string }

export function useUpdates() {
  const [update, setUpdate] = useState<Manifest>()
  const [updating, setUpdating] = useState<string>() // "…" while installing, or the error
  const [models, setModels] = useState<Models>()
  const manifest = useRef<Manifest>()

  const check = useCallback(async () => {
    try {
      const m: Manifest = await fetch(SITE + 'update.json', { cache: 'no-store' }).then((r) => r.json())
      manifest.current = m
      const { getVersion } = await import('@tauri-apps/api/app')
      const mine = await getVersion()
      if (newer(m.version, mine)) { trace(`update: ${mine} -> ${m.version}`); setUpdate(m) }
      return m
    } catch { return undefined }
  }, [])

  useEffect(() => {
    if (!isDesktop) return
    void (async () => {
      await check()
      const invoke = await core()
      if (await invoke<string>('stt_status') === 'missing') {
        setModels({ busy: false, got: await invoke<number>('models_progress'), size: manifest.current?.models?.size ?? 0 })
      }
    })()
    const t = setInterval(() => void check(), 6 * 3600_000)
    return () => clearInterval(t)
  }, [check])

  /** Installs the new exe and restarts into it. A release that changes more than the exe opens the website instead. */
  const install = useCallback(async () => {
    if (!update) return
    const invoke = await core()
    if (update.full) { await invoke('open_site', { url: SITE + '#/download' }); return }
    setUpdating('…')
    try { await invoke('install_update', { url: update.exe.url, signature: update.exe.signature }) }
    catch (e) { setUpdating(String(e)) }
  }, [update])

  /** Fetches the speech and AI models for a copy that came as the exe alone. Resumes where a stopped download left off. */
  const getModels = useCallback(async () => {
    const m = manifest.current?.models ?? (await check())?.models
    if (!m) { setModels((s) => s && { ...s, error: 'Connect to the internet, then press Download' }); return }
    const invoke = await core()
    setModels((s) => ({ busy: true, got: s?.got ?? 0, size: m.size }))
    const poll = setInterval(() => void invoke<number>('models_progress').then((got) => setModels((s) => s && { ...s, got })), 1000)
    try {
      await invoke('download_models', { url: m.url, signature: m.signature, size: m.size })
      setModels(undefined)
    } catch (e) {
      setModels((s) => s && { ...s, busy: false, error: String(e) })
    } finally { clearInterval(poll) }
  }, [check])

  return { update, updating, install, models, getModels }
}
