/**
 * Visitor counts through GoatCounter (serenity.goatcounter.com): no cookies, no personal data, just pages, countries
 * and clicks. Pages live after the #, so each one is counted here. The script loads async, so early counts wait for it.
 */
type GC = { count?: (v: { path: string; title?: string; event?: boolean }) => void }

export function count(path: string, event = false, tries = 0) {
  const gc = (window as unknown as { goatcounter?: GC }).goatcounter
  if (gc?.count) gc.count({ path, title: event ? path : document.title, event })
  else if (tries < 20) setTimeout(() => count(path, event, tries + 1), 500)
}
