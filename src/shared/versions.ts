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

/** Names that are everyday words in a sermon ("the message of the cross", "the good news"), so they need a clear request. */
const EVERYDAY = new Set(['message', 'passion', 'amplified', 'amp', 'net', 'web', 'voice', 'easy', 'living', 'recovery', 'jubilee',
  'good news', 'easy to read', 'easy read', 'tree of life', 'holy name', 'plain english', 'common english', 'basic english'])

/**
 * Finds a request to change translation: "give us TPT", "in the Message", "switch to King James", "NIV please".
 * People mostly say the letters, so a code like "kjv" or "tpt" counts on its own, even spelled out ("K J V").
 * Everyday words need a clear request ("give us message", "message version") and never count before "of".
 * Other names need a cue word so a passing mention doesn't switch versions.
 * Picks the most specific match ("amplified classic" beats "amplified").
 */
export function findVersion(text: string, available: VersionInfo[]): string | undefined {
  // "t p t" -> "tpt": recognisers often write a spelled-out code letter by letter
  const t = ' ' + normalize(text).replace(/\b[a-z](?: [a-z]\b)+/g, (m) => m.replace(/ /g, '')) + ' '
  const cued = /\b(in|from|use|using|switch|change|read|reading|the|version|translation|says|give|please|let|show)\b/.test(t)
  let best: { short: string; len: number } | undefined
  for (const v of available) {
    const codes = new Set([v.short.toLowerCase(), ...Object.keys(SPOKEN).map((k) => k.toLowerCase())])
    for (const f of forms(v)) {
      if (!f || f.length < 3) continue
      if (!t.includes(' ' + f + ' ')) continue
      if (EVERYDAY.has(f)) {
        const asked = new RegExp(`\\b(in|from|use|using|give us|give me|read|read it in|show us|switch to|change to|go to|let s have|let s see|let s use|let s go with) (the )?${f}\\b(?! of)` +
          `|\\b${f} (version|translation|bible|please)\\b|^ (the )?${f} (please )?$`)
        if (!asked.test(t)) continue
      } else if (!codes.has(f) && !cued) continue
      if (!best || f.length > best.len) best = { short: v.short, len: f.length }
    }
  }
  return best?.short ?? spelledLoosely(text, available)
}

/** Letters that recognisers swap when a code is spelled out: "K J V" comes back as "kg v", "N L T" as "n l d". */
const SOUNDS_ALIKE = ['gj', 'bv', 'bd', 'dt', 'mn', 'pt', 'sf', 'bp', 'ei', 'au']

/**
 * A translation code spelled out letter by letter, with one letter misheard: "kg v" is KJV. Only letter groups count
 * (single letters, or two-letter pieces next to one), the first letter must agree, and the slip must be a pair of
 * letters that sound alike, so ordinary words never turn into codes.
 */
function spelledLoosely(text: string, available: VersionInfo[]): string | undefined {
  const toks = normalize(text).split(' ')
  for (let i = 0; i < toks.length; i++) {
    let code = '', k = i, single = false
    while (k < toks.length && /^[a-z]{1,2}$/.test(toks[k]) && code.length < 5) { single ||= toks[k].length === 1; code += toks[k++] }
    if (!single || code.length < 3 || k - i < 2) continue
    for (const v of available) {
      const want = v.short.toLowerCase()
      if (want.length !== code.length || want[0] !== code[0]) continue
      const slips = [...want].map((c, n) => [c, code[n]]).filter(([a, b]) => a !== b)
      if (slips.length === 1 && SOUNDS_ALIKE.some((p) => p.includes(slips[0][0]) && p.includes(slips[0][1]))) return v.short
    }
  }
}
