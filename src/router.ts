import { useEffect, useState } from 'react'

export interface Route {
  name: 'projects' | 'project' | 'library' | 'pattern' | 'tools'
  id?: string
  query: URLSearchParams
}

function parse(hash: string): Route {
  const [path, qs] = hash.replace(/^#/, '').split('?')
  const query = new URLSearchParams(qs ?? '')
  const parts = path.split('/').filter(Boolean)
  switch (parts[0]) {
    case 'project':
      return parts[1] ? { name: 'project', id: decodeURIComponent(parts[1]), query } : { name: 'projects', query }
    case 'library':
      return { name: 'library', query }
    case 'pattern':
      return parts[1] ? { name: 'pattern', id: decodeURIComponent(parts[1]), query } : { name: 'library', query }
    case 'tools':
      return { name: 'tools', query }
    default:
      return { name: 'projects', query }
  }
}

export function navigate(path: string, replace = false) {
  const hash = path.startsWith('#') ? path : `#${path}`
  if (replace) history.replaceState(null, '', hash)
  else location.hash = hash
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash))
  useEffect(() => {
    const on = () => setRoute(parse(location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}
