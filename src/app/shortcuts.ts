/** Operator hotkeys. Defaults follow Bible Show so operators can switch without relearning; all can be rebound in Settings. */
export type ActionId =
  | 'reference' | 'find' | 'next' | 'previous' | 'nextChapter' | 'previousChapter'
  | 'toggle' | 'show' | 'hide' | 'freeze' | 'addProgram' | 'programNext' | 'programPrevious'

export const ACTIONS: { id: ActionId; label: string; global?: boolean }[] = [
  { id: 'reference', label: 'Type a reference', global: true },
  { id: 'find', label: 'Search by words or meaning', global: true },
  { id: 'next', label: 'Next verse (flows into the next chapter)' },
  { id: 'previous', label: 'Previous verse' },
  { id: 'nextChapter', label: 'Next chapter' },
  { id: 'previousChapter', label: 'Previous chapter' },
  { id: 'toggle', label: 'Show or hide' },
  { id: 'show', label: 'Show', global: true },
  { id: 'hide', label: 'Hide', global: true },
  { id: 'freeze', label: 'Freeze the screen while you browse' },
  { id: 'addProgram', label: 'Add verse to Program' },
  { id: 'programNext', label: 'Next in Program' },
  { id: 'programPrevious', label: 'Previous in Program' }
]

export type Bindings = Record<ActionId, string[]>

/** One key per action. */
export const DEFAULT_BINDINGS: Bindings = {
  reference: ['F5'],
  find: ['F6'],
  next: ['ArrowDown'],
  previous: ['ArrowUp'],
  nextChapter: ['ArrowRight'],
  previousChapter: ['ArrowLeft'],
  toggle: ['Enter'],
  show: ['F10'],
  hide: ['Escape'],
  freeze: ['F7'],
  addProgram: ['F2'],
  programNext: ['+'],
  programPrevious: ['-']
}

const PRETTY: Record<string, string> = { ArrowDown: '↓', ArrowUp: '↑', ArrowLeft: '←', ArrowRight: '→', PageDown: 'Page Down', PageUp: 'Page Up', Escape: 'Esc', ' ': 'Space' }
export const pretty = (combo: string) => combo.split('+').filter(Boolean).map((p) => PRETTY[p] ?? p).join(' + ') || combo

/** "Ctrl+Shift+F8", "PageDown", "B" — or undefined for a lone modifier press. */
export function comboOf(e: KeyboardEvent): string | undefined {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key
  const printable = e.key.length === 1
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && !printable && 'Shift'].filter(Boolean)
  return [...mods, key === '+' && mods.length ? 'Plus' : key].join('+')
}

/** Which action (if any) a combo triggers. */
export function actionFor(bindings: Bindings, combo: string): ActionId | undefined {
  return (Object.keys(bindings) as ActionId[]).find((a) => bindings[a].includes(combo))
}
