/**
 * Bible Show versions ship as small Windows installers (NSIS) that wrap one Bible database.
 * This reads the installer as plain data (nothing is executed) and returns the database bytes.
 */
const MAGIC = [0xef, 0xbe, 0xad, 0xde, 0x4e, 0x75, 0x6c, 0x6c, 0x73, 0x6f, 0x66, 0x74, 0x49, 0x6e, 0x73, 0x74]
const JET = [0x00, 0x01, 0x00, 0x00, 0x53, 0x74, 0x61, 0x6e, 0x64, 0x61, 0x72, 0x64]

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x)

export const isJetDb = (b: Uint8Array) => startsWith(b, JET)

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function extractBibFromInstaller(exe: Uint8Array): Promise<Uint8Array> {
  let at = -1
  for (let i = 0; i + MAGIC.length < exe.length; i++) {
    if (exe[i] === MAGIC[0] && startsWith(exe, MAGIC, i)) { at = i - 4; break }
  }
  if (at < 0) throw new Error('This is not a Bible Show version file')
  const view = new DataView(exe.buffer, exe.byteOffset, exe.byteLength)
  let p = at + 28
  while (p + 4 <= exe.length) {
    const v = view.getUint32(p, true)
    const len = v & 0x7fffffff
    p += 4
    if (!len || p + len > exe.length) break
    const block = exe.subarray(p, p + len)
    p += len
    try {
      const raw = v & 0x80000000 ? await inflateRaw(block) : block
      if (isJetDb(raw)) return raw
    } catch { /* not every block is deflate (e.g. LZMA installers) */ }
  }
  throw new Error('No Bible found inside this file')
}
