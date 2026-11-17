import { useCallback, useEffect, useRef, useState } from 'react'
import { getMarkup, saveMarkup } from '../db'
import { undoChange, type MarkupChange } from '../lib/markupUndo'
import type { Markup } from '../types'

const MAX_UNDO = 60

/** Pattern markup with debounced persistence and undo history. */
export function useMarkup(patternId: string) {
  const [markup, setMarkup] = useState<Markup | null>(null)
  const latest = useRef<Markup | null>(null)
  const history = useRef<MarkupChange[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (latest.current) void saveMarkup(latest.current)
  }, [])

  useEffect(() => {
    let alive = true
    history.current = []
    setCanUndo(false)
    void getMarkup(patternId).then((m) => {
      if (!alive) return
      latest.current = m
      setMarkup(m)
    })
    return () => {
      alive = false
      flush()
    }
  }, [patternId, flush])

  useEffect(() => {
    const onHide = () => flush()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flush])

  const update = useCallback(
    (fn: (m: Markup) => Markup, undoable = true) => {
      const cur = latest.current
      if (!cur) return
      const next = fn(cur)
      if (next === cur) return
      if (undoable) {
        history.current.push({ before: cur, after: next })
        if (history.current.length > MAX_UNDO) history.current.shift()
        setCanUndo(true)
      }
      latest.current = next
      setMarkup(next)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 400)
    },
    [flush],
  )

  const undo = useCallback(() => {
    const change = history.current.pop()
    setCanUndo(history.current.length > 0)
    if (!change || !latest.current) return
    // Reverts only that action, keeping later progress and settings edits.
    const restored = undoChange(change, latest.current)
    latest.current = restored
    setMarkup(restored)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 400)
  }, [flush])

  return { markup, update, undo, canUndo }
}
