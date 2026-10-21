import { normalize } from './reference'

export interface VersionInfo { short: string; name: string }

/** How people say common translations out loud. Keys are short names as Bible Show modules use them. */
const SPOKEN: Record<string, string[]> = {
  KJV: ['king james', 'kjv', 'authorized version'],
  NKJV: ['new king james', 'nkjv'],
  KJ2000: ['king james 2000'],
  AMP: ['amplified', 'amp'],
  AMPC: ['amplified classic', 'classic amplified', 'ampc'],
  ERV: ['easy to read', 'easy read', 'erv'],
  NIV: ['new international', 'niv'],
  NLT: ['new living', 'nlt'],
  ESV: ['english standard', 'esv'],
  NASB: ['new american standard', 'nasb'],
  MSG: ['message', 'msg'],
  GNT: ['good news', 'gnt'],
  CEV: ['contemporary english', 'cev'],
  NRSV: ['new revised standard', 'nrsv'],
  RSV: ['revised standard', 'rsv'],
  ASV: ['american standard', 'asv'],
  CSB: ['christian standard', 'csb'],
  TPT: ['passion translation', 'passion', 'tpt'],
  NET: ['net bible', 'new english translation'],
  WEB: ['world english', 'web']
}

const FILLER = new Set(['the', 'bible', 'version', 'translation', 'edition', 'of', 'holy', 'scriptures', 'and'])

/** Spoken forms for a module: the table above plus words from its own full name ("Amplified Bible, Classic Edition" -> "amplified classic"). */
function forms(v: VersionInfo): string[] {
  const own = normalize(v.name).split(' ').filter((w) => w && !FILLER.has(w) && !/^\d+$/.test(w)).join(' ')
  const short = v.short.toUpperCase()
  return [...(SPOKEN[short] ?? SPOKEN[short.replace(/\d+$/, '')] ?? []), own, short.toLowerCase()].filter(Boolean)
}

/**
 * Finds a request to change translation: "read it in the Amplified Classic", "switch to King James",
 * "from the New Living Translation". Requires a cue word so a passing mention doesn't switch versions.
 * Picks the most specific match ("amplified classic" beats "amplified").
 */
export function findVersion(text: string, available: VersionInfo[]): string | undefined {
  const t = ' ' + normalize(text) + ' '
  if (!/\b(in|from|use|using|switch|change|read|reading|the|version|translation|says)\b/.test(t)) return
  let best: { short: string; len: number } | undefined
  for (const v of available) {
    for (const f of forms(v)) {
      if (!f || f.length < 3) continue
      if (!t.includes(' ' + f + ' ')) continue
      // Short codes like "amp" or "msg" must be clearly addressed: "in the amp", "amp version".
      if (f.length <= 4 && !new RegExp(`\\b(in|the|from|to) ${f}\\b|\\b${f} (version|translation)\\b`).test(t)) continue
      if (!best || f.length > best.len) best = { short: v.short, len: f.length }
    }
  }
  return best?.short
}
