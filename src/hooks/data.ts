import { useCallback, useEffect, useRef, useState } from 'react'
import { dbEvents, getProject, listPatterns, listProjects, saveProject, type StoreName } from '../db'
import type { PatternMeta, Project } from '../types'

function useStoreChange(store: StoreName, cb: () => void) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent).detail.store === store) ref.current()
    }
    dbEvents.addEventListener('change', on)
    return () => dbEvents.removeEventListener('change', on)
  }, [store])
}

export function useProjects() {
  const [items, setItems] = useState<Project[] | null>(null)
  const load = useCallback(() => void listProjects().then(setItems), [])
  useEffect(load, [load])
  useStoreChange('projects', load)
  return items
}

export function usePatterns() {
  const [items, setItems] = useState<PatternMeta[] | null>(null)
  const load = useCallback(() => void listPatterns().then(setItems), [])
  useEffect(load, [load])
  useStoreChange('patterns', load)
  return items
}

/** Loads a project and returns an updater that persists every change. */
export function useProject(id: string) {
  const [project, setProject] = useState<Project | null | undefined>(undefined)
  const latest = useRef<Project | null>(null)

  useEffect(() => {
    let alive = true
    void getProject(id).then((p) => {
      if (!alive) return
      latest.current = p ?? null
      setProject(p ?? null)
    })
    return () => {
      alive = false
    }
  }, [id])

  const update = useCallback((fn: (p: Project) => Project) => {
    const cur = latest.current
    if (!cur) return
    const next = fn(cur)
    if (next === cur) return
    latest.current = next
    setProject(next)
    void saveProject(next)
  }, [])

  return [project, update] as const
}

/** Re-renders on an interval while `enabled`. */
export function useNow(intervalMs: number, enabled: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs, enabled])
  return now
}

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    mq.addEventListener('change', on)
    on()
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

/** Hides the bottom navigation (e.g. while following a pattern full screen on a phone). */
export function useHideNav(hide: boolean) {
  useEffect(() => {
    document.body.classList.toggle('hide-nav', hide)
    return () => document.body.classList.remove('hide-nav')
  }, [hide])
}

/** Keeps the screen on while knitting (Screen Wake Lock API). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock?.release()
      } catch {
        // Not allowed (e.g. battery saver); ignore.
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release()
    }
  }, [enabled])
}
