// Precomputes sentence embeddings for the bundled KJV so meaning search is instant on first launch.
import { pipeline, env } from '@huggingface/transformers'
import { readFileSync, writeFileSync } from 'fs'

env.allowLocalModels = true
env.allowRemoteModels = false
env.localModelPath = new URL('../public/models/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const raw = JSON.parse(readFileSync(new URL('../public/kjv.json', import.meta.url), 'utf8').replace(/^﻿/, ''))
const texts = []
for (const b of raw) for (const ch of b.chapters) for (const t of ch) texts.push(t.replace(/^\s*[#¶]\s*/, '').replace(/[{}]/g, '').trim())

const embed = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' })
const DIM = 384
const out = new Int8Array(texts.length * DIM)
const B = 128
for (let i = 0; i < texts.length; i += B) {
  const r = await embed(texts.slice(i, i + B), { pooling: 'mean', normalize: true })
  const d = r.data
  for (let k = 0; k < d.length; k++) out[i * DIM + k] = Math.max(-127, Math.min(127, Math.round(d[k] * 127)))
  if ((i / B) % 20 === 0) console.log(i, '/', texts.length)
}
writeFileSync(new URL('../public/embeddings-kjv.i8', import.meta.url), out)
console.log('done', texts.length)
