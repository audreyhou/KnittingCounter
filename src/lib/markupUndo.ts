import type { Markup } from '../types'

/** One undoable edit: the markup right before and right after it. */
export interface MarkupChange {
  before: Markup
  after: Markup
}

/** Puts back the fields an action changed on an item, keeping other (later) edits. */
function revertFields<T extends object>(was: T, did: T, live: T): T {
  const out = { ...live }
  const keys = new Set([...Object.keys(was), ...Object.keys(did)]) as Set<keyof T>
  for (const k of keys) if (was[k] !== did[k]) out[k] = was[k]
  return out
}

/**
 * Reverts what one action did to a list of items (`before` → `after`) on top of
 * `current`: removes items it added, restores fields it changed and re-inserts
 * items it deleted. Edits made since then that were not part of the action stay.
 */
export function revertItems<T extends { id: string }>(before: T[], after: T[], current: T[]): T[] {
  if (before === after) return current
  const was = new Map(before.map((x) => [x.id, x]))
  const did = new Map(after.map((x) => [x.id, x]))
  const out: T[] = []
  for (const x of current) {
    const b = was.get(x.id)
    const a = did.get(x.id)
    if (!b) {
      if (!a) out.push(x)
    } else if (a && a !== b) out.push(revertFields(b, a, x))
    else out.push(x)
  }
  before.forEach((x, i) => {
    if (!did.has(x.id) && !out.some((o) => o.id === x.id)) out.splice(Math.min(i, out.length), 0, x)
  })
  return out
}

export function undoChange({ before, after }: MarkupChange, current: Markup): Markup {
  const charts = revertItems(before.charts, after.charts, current.charts)
  const has = (id?: string) => !!id && charts.some((c) => c.id === id)
  return {
    ...current,
    highlights: revertItems(before.highlights, after.highlights, current.highlights),
    strokes: revertItems(before.strokes, after.strokes, current.strokes),
    notes: revertItems(before.notes, after.notes, current.notes),
    bookmarks: revertItems(before.bookmarks, after.bookmarks, current.bookmarks),
    rules: revertItems(before.rules, after.rules, current.rules),
    charts,
    activeChartId: has(current.activeChartId) ? current.activeChartId : has(before.activeChartId) ? before.activeChartId : undefined,
  }
}
