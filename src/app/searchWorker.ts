import { pipeline, env } from '@huggingface/transformers'
// The ONNX runtime ships inside the app. Left to itself, transformers.js fetches it from cdn.jsdelivr.net,
// which fails offline, and Lampstand must work with no internet at all.
import ortMjs from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url'
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url'
env.allowLocalModels = true
env.allowRemoteModels = false
env.localModelPath = '/models/'
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = { mjs: ortMjs, wasm: ortWasm }

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
