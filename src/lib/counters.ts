import type { Counter, Craft, Project, RowNote, TimerState } from '../types'
import { uid } from './id'

export const COUNTER_COLORS = ['#29a3f5', '#f5b729', '#ef5d8a', '#4cc38a', '#9b6cf0', '#ff8a3d', '#2fc4c4', '#8a8f98']

export function newCounter(name: string, color = COUNTER_COLORS[1], extra: Partial<Counter> = {}): Counter {
  return { id: uid(), name, value: 0, cycles: 0, color, ...extra }
}

export function newProject(name: string, craft: Craft = 'knit'): Project {
  const main = newCounter('Row', COUNTER_COLORS[0])
  const now = Date.now()
  return {
    id: uid(),
    name,
    craft,
    createdAt: now,
    updatedAt: now,
    counters: [main],
    mainCounterId: main.id,
    notes: [],
    timer: { totalMs: 0, runningSince: null },
    keepAwake: true,
  }
}

/** Moves a counter one step forward or back, honouring repeat wrapping. */
export function stepCounter(c: Counter, delta: 1 | -1): Counter {
  const repeat = !!c.wrap && !!c.max && c.max > 0
  if (delta > 0) {
    if (repeat && c.value >= c.max!) return { ...c, value: 1, cycles: c.cycles + 1 }
    return { ...c, value: c.value + 1 }
  }
  if (repeat && c.value <= 1 && c.cycles > 0) return { ...c, value: c.max!, cycles: c.cycles - 1 }
  return { ...c, value: Math.max(0, c.value - 1) }
}

/** Steps a counter. Stepping the main counter also steps every linked counter. */
export function changeCounter(p: Project, counterId: string, delta: 1 | -1): Project {
  const isMain = counterId === p.mainCounterId
  const counters = p.counters.map((c) => {
    if (c.id === counterId) return stepCounter(c, delta)
    if (isMain && c.linked) return stepCounter(c, delta)
    return c
  })
  return { ...p, counters, updatedAt: Date.now() }
}

export function resetCounter(c: Counter): Counter {
  return { ...c, value: 0, cycles: 0 }
}

export function counterProgress(c: Counter): number {
  if (!c.max || c.max <= 0) return 0
  return Math.min(1, Math.max(0, c.value / c.max))
}

export function mainCounter(p: Project): Counter {
  return p.counters.find((c) => c.id === p.mainCounterId) ?? p.counters[0]
}

export function noteMatches(n: RowNote, value: number): boolean {
  if (value === n.row) return true
  if (!n.every || n.every <= 0 || value < n.row) return false
  if (n.until && value > n.until) return false
  return (value - n.row) % n.every === 0
}

/** Notes that apply to the current value of their counter. */
export function activeNotes(p: Project): RowNote[] {
  const values = new Map(p.counters.map((c) => [c.id, c.value]))
  return p.notes.filter((n) => values.has(n.counterId) && noteMatches(n, values.get(n.counterId)!))
}

/** The next upcoming note for a counter, and the row it applies to. */
export function nextNote(p: Project, counterId = p.mainCounterId): { note: RowNote; at: number } | null {
  const c = p.counters.find((x) => x.id === counterId)
  if (!c) return null
  let best: { note: RowNote; at: number } | null = null
  for (const n of p.notes) {
    if (n.counterId !== counterId) continue
    const at = nextOccurrence(n, c.value + 1)
    if (at !== null && (!best || at < best.at)) best = { note: n, at }
  }
  return best
}

export function nextOccurrence(n: RowNote, from: number): number | null {
  if (from <= n.row) return n.row
  if (!n.every || n.every <= 0) return null
  const k = Math.ceil((from - n.row) / n.every)
  const at = n.row + k * n.every
  if (n.until && at > n.until) return null
  return at
}

/** Reminders that just became active because a counter moved forward. */
export function triggeredReminders(prev: Project, next: Project): RowNote[] {
  const before = new Map(prev.counters.map((c) => [c.id, c.value]))
  return next.notes.filter((n) => {
    if (n.kind !== 'reminder') return false
    const c = next.counters.find((x) => x.id === n.counterId)
    if (!c) return false
    const old = before.get(c.id) ?? 0
    return c.value > old && noteMatches(n, c.value)
  })
}

export function describeNoteRows(n: RowNote): string {
  let s = `Row ${n.row}`
  if (n.every) s += `, then every ${n.every} rows`
  if (n.every && n.until) s += ` until row ${n.until}`
  return s
}

// Timer
export function elapsedMs(t: TimerState, now = Date.now()): number {
  return t.totalMs + (t.runningSince !== null ? Math.max(0, now - t.runningSince) : 0)
}
export function startTimer(t: TimerState, now = Date.now()): TimerState {
  return t.runningSince !== null ? t : { ...t, runningSince: now }
}
export function pauseTimer(t: TimerState, now = Date.now()): TimerState {
  return t.runningSince !== null ? { totalMs: elapsedMs(t, now), runningSince: null } : t
}
