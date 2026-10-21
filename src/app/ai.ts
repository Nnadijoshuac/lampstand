/**
 * The local AI (Qwen2.5 1.5B via llama.cpp, started by the desktop app). Two jobs:
 *  - rerank: pick which candidate verse the preacher is actually quoting or describing
 *  - route: turn a free-form instruction into an action when the fast rules found nothing
 * Everything runs on this computer. Calls are best effort: if the AI is busy or missing, the fast path stands.
 */
import { isDesktop, trace } from './stt'

/** Set once the AI answers its health check. Until then every call returns at once and the fast path stands. */
let ready: string | undefined
let waiting: Promise<string | undefined> | undefined

/**
 * Waits for the AI to finish loading, however long that takes: a slow laptop, or the app running from a
 * flash drive, can need minutes to read the model. It never gives up, so the AI joins in whenever it is ready.
 */
async function waitForServer(): Promise<string | undefined> {
  let url: string | undefined
  if (isDesktop) {
    const { invoke } = await import('@tauri-apps/api/core')
    const port = await invoke<number | null>('ai_port')
    if (port) url = `http://127.0.0.1:${port}`
  } else url = 'http://127.0.0.1:8790' // development: run llama-server yourself
  if (!url) { trace('ai: not started (llama-server missing or failed to launch)'); return }
  const t0 = Date.now()
  for (let i = 0; ; i++) {
    try { if ((await fetch(url + '/health')).ok) break } catch { /* still starting */ }
    if (i % 60 === 59) trace(`ai: still loading after ${Math.round((Date.now() - t0) / 1000)}s`)
    await new Promise((r) => setTimeout(r, 500))
  }
  trace(`ai: ready after ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  return (ready = url)
}

/** Resolves when the AI is ready (it may take minutes). */
export async function aiReady(): Promise<boolean> {
  return !!(await (waiting ??= waitForServer()))
}

/** Slots on the AI server, one per job, so each keeps its instructions cached between calls. */
const SLOT = { recall: 0, rerank: 1, route: 2 } as const

async function chat(messages: { role: string; content: string }[], maxTokens: number, schema?: object, slot?: number, signal?: AbortSignal): Promise<string | undefined> {
  void aiReady()
  const url = ready
  if (!url) return
  const body: Record<string, unknown> = { messages, max_tokens: maxTokens, temperature: 0, cache_prompt: true }
  if (slot !== undefined) body.id_slot = slot
  if (schema) body.response_format = { type: 'json_schema', json_schema: { schema } }
  const r = await fetch(url + '/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  if (!r.ok) return
  return (await r.json()).choices?.[0]?.message?.content
}

const RERANK_SYSTEM = 'You match what a preacher said to the Bible verse they are quoting, paraphrasing or describing. ' +
  'Reply with only the number of the best candidate, or 0 if none of them fits.'

/** Index into `candidates` of the verse being quoted, or -1 if none fits. */
export async function rerank(said: string, candidates: { label: string; text: string }[]): Promise<number> {
  const list = candidates.map((c, i) => `${i + 1}. ${c.label} ${c.text.split(' ').slice(0, 28).join(' ')}`).join('\n')
  const out = await chat([
    { role: 'system', content: RERANK_SYSTEM },
    { role: 'user', content: `Preacher said: "${said}"\nCandidates:\n${list}` }
  ], 4, undefined, SLOT.rerank)
  const n = parseInt(out ?? '', 10)
  return Number.isFinite(n) && n >= 1 && n <= candidates.length ? n - 1 : -1
}

const RECALL_SYSTEM = 'You are a Bible scholar. The preacher is quoting, paraphrasing or describing a Bible passage. ' +
  'Reply with the three most likely references, best first, as JSON: {"refs":["Book C:V", ...]}. Use full book names.'
const RECALL_SCHEMA = { type: 'object', properties: { refs: { type: 'array', items: { type: 'string' }, maxItems: 3 } }, required: ['refs'] }

/** References the AI thinks the preacher means ("Matthew 19:24"). Unchecked: the caller verifies them against the verse text. */
export async function recall(said: string): Promise<string[]> {
  const out = await chat([{ role: 'system', content: RECALL_SYSTEM }, { role: 'user', content: said }], 60, RECALL_SCHEMA, SLOT.recall)
  try { return (JSON.parse(out ?? '').refs ?? []).filter((r: unknown) => typeof r === 'string') } catch { return [] }
}

export type Action =
  | { action: 'open'; book: string; chapter: number; verse?: number; end?: number }
  | { action: 'verse'; verse: number; end?: number }
  | { action: 'next' }
  | { action: 'previous' }
  | { action: 'version'; version: string }
  | { action: 'none' }

const ROUTE_SCHEMA = {
  type: 'object',
  properties: {
    action: { enum: ['open', 'verse', 'next', 'previous', 'version', 'none'] },
    book: { type: 'string' },
    chapter: { type: 'integer' },
    verse: { type: 'integer' },
    end: { type: 'integer' },
    version: { type: 'string' }
  },
  required: ['action']
}

const ROUTE_SYSTEM = `You operate the scripture screen in a church service. From the preacher's latest words, choose one action as JSON:
- {"action":"open","book":"John","chapter":1,"verse":24,"end":26} when they name a passage to read (verse and end are optional)
- {"action":"verse","verse":5} to jump within the passage already open
- {"action":"next"} or {"action":"previous"} to move one verse
- {"action":"version","version":"<one of the installed versions>"} when they ask for a different translation
- {"action":"none"} when they are simply preaching, praying or reading.
Only act on clear instructions. Spoken numbers may be split oddly by speech recognition ("John one twenty four" is John 1:24).`

export async function route(said: string, ctx: { open?: string; versions: string[] }): Promise<Action> {
  const out = await chat([
    { role: 'system', content: ROUTE_SYSTEM },
    { role: 'user', content: 'Installed versions: KJV, AMP\nOpen: Genesis 1\nPreacher: "turn with me to the gospel of John chapter one and verse twenty four"' },
    { role: 'assistant', content: '{"action":"open","book":"John","chapter":1,"verse":24}' },
    { role: 'user', content: 'Installed versions: KJV, AMP\nOpen: John 1\nPreacher: "let us look at that again in the amplified"' },
    { role: 'assistant', content: '{"action":"version","version":"AMP"}' },
    { role: 'user', content: 'Installed versions: KJV, AMP\nOpen: John 1\nPreacher: "God is good all the time and all the time God is good"' },
    { role: 'assistant', content: '{"action":"none"}' },
    { role: 'user', content: `Installed versions: ${ctx.versions.join(', ')}\nOpen: ${ctx.open ?? 'nothing'}\nPreacher: "${said}"` }
  ], 48, ROUTE_SCHEMA, SLOT.route)
  try { return JSON.parse(out ?? '') as Action } catch { return { action: 'none' } }
}

/** Words that suggest an instruction about scripture, worth asking the AI about. */
export const CUE = /\b(verse|verses|chapter|book|turn|open|read|go back|next|previous|translation|version|bible|scripture|passage|psalm|gospel|epistle)\b/i
