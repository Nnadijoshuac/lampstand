/**
 * An error written for people, safe to show on screen: "Not a Lampstand Bible file". Anything else (a TypeError,
 * "Failed to fetch", a runtime trace) is logged, and the screen shows a plain sentence instead. Raw errors never
 * reach the UI.
 */
export class PlainError extends Error {}

/** The message to show for an error: its own words if it is a PlainError, otherwise `fallback`. */
export function shown(e: unknown, fallback: string): string {
  return e instanceof PlainError ? e.message : fallback
}
