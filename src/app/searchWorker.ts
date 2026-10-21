import { pipeline, env } from '@huggingface/transformers'
env.allowLocalModels = true
env.allowRemoteModels = false
env.localModelPath = '/models/'

let embed: any
const device = 'wasm' // the WebGPU runtime needs extra files; WASM is fast enough for these small models

self.onmessage = async (e: MessageEvent) => {
  const m = e.data
  try {
    if (m.type === 'load') {
      embed = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { device, dtype: 'q8' })
      self.postMessage({ type: 'ready' })
    } else if (m.type === 'embed') {
      const out = await embed(m.texts, { pooling: 'mean', normalize: true })
      const data = new Float32Array(out.data as Float32Array)
      ;(self as any).postMessage({ type: 'vectors', id: m.id, data }, [data.buffer])
    }
  } catch (err) { self.postMessage({ type: 'error', message: String(err) }) }
}
