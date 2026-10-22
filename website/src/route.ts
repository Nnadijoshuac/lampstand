import { useEffect, useState } from 'react'
import { count } from './count'

export type Route = 'home' | 'translations' | 'download'

const read = (): Route => {
  const h = window.location.hash
  return h.startsWith('#/translations') ? 'translations' : h.startsWith('#/download') ? 'download' : 'home'
}

/** The page in the address (#/translations, #/download). GitHub Pages serves one file, so pages live after the #. */
export function useRoute(): Route {
  const [route, setRoute] = useState(read)
  useEffect(() => count('/' + (route === 'home' ? '' : route)), [route])
  useEffect(() => {
    const on = () => {
      const next = read()
      setRoute((now) => {
        if (now !== next) window.scrollTo({ top: 0 })
        return next
      })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
