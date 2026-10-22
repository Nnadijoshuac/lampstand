/**
 * Signs a release so installed copies of Lampstand update themselves, and writes website/public/update.json.
 *
 * usage: node scripts/sign-update.mjs <version> --exe <Lampstand.exe> [--zip <Lampstand-x.y.z-windows.zip>] [--full] [notes]
 *
 * The app downloads Lampstand.exe from the GitHub release v<version> and installs it only if its signature matches
 * the public key built into src-tauri/src/update.rs. --zip names the full download, which also carries the speech
 * and AI models: copies that came as the exe alone fetch their models from it. Leave --zip out when the models
 * haven't changed and the last zip stays the one to fetch. --full marks a release that changes more than the exe
 * (models, the AI server): the app then sends people to the website instead of updating itself.
 *
 * Signatures are ed25519 over the file's SHA-256. The private key lives outside the repo (LAMPSTAND_KEY, default
 * ~/.lampstand/update-key.pem). Keep a backup of it: without it, no copy of Lampstand can be updated again.
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'crypto'
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { basename, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const args = process.argv.slice(2)
const take = (flag) => { const i = args.indexOf(flag); return i < 0 ? undefined : args.splice(i, 2)[1] }
const version = args.shift()
const exe = take('--exe'), zip = take('--zip')
const full = args.includes('--full')
const notes = args.filter((a) => a !== '--full').join(' ')
if (!exe || !/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('usage: node scripts/sign-update.mjs <version> --exe <Lampstand.exe> [--zip <zip>] [--full] [notes]')
  process.exit(1)
}

const keyPath = process.env.LAMPSTAND_KEY ?? join(homedir(), '.lampstand', 'update-key.pem')
if (!existsSync(keyPath)) {
  mkdirSync(dirname(keyPath), { recursive: true })
  const { privateKey } = generateKeyPairSync('ed25519')
  writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
  console.log('Created a new signing key at', keyPath, '(back it up)')
}
const key = createPrivateKey(readFileSync(keyPath))
console.log('public key (KEY in update.rs):', Buffer.from(createPublicKey(key).export({ format: 'jwk' }).x, 'base64url').toString('hex'))

const digest = (file) => new Promise((ok, fail) => {
  const h = createHash('sha256')
  createReadStream(file).on('data', (d) => h.update(d)).on('end', () => ok(h.digest())).on('error', fail)
})
const release = `https://github.com/Nnadijoshuac/lampstand/releases/download/v${version}/`
const signed = async (file, url) => ({ url, size: statSync(file).size, signature: sign(null, await digest(file), key).toString('hex') })

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'website', 'public', 'update.json')
const before = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {}
const manifest = {
  version,
  notes,
  full,
  exe: await signed(exe, release + 'Lampstand.exe'),
  models: zip ? await signed(zip, release + basename(zip)) : before.models,
}
if (!manifest.models) console.warn('No models zip yet: pass --zip')
writeFileSync(out, JSON.stringify(manifest, null, 1) + '\n')
console.log('wrote', out)
