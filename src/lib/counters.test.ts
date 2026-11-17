import { describe, expect, it } from 'vitest'
import type { RowNote } from '../types'
import {
  activeNotes,
  changeCounter,
  elapsedMs,
  newCounter,
  newProject,
  nextNote,
  pauseTimer,
  startTimer,
  stepCounter,
  triggeredReminders,
} from './counters'

describe('counters', () => {
  it('wraps repeat counters and can step back across the wrap', () => {
    let c = newCounter('Pattern', '#000', { max: 4, wrap: true, value: 3 })
    c = stepCounter(c, 1)
    expect([c.value, c.cycles]).toEqual([4, 0])
    c = stepCounter(c, 1)
    expect([c.value, c.cycles]).toEqual([1, 1])
    c = stepCounter(c, -1)
    expect([c.value, c.cycles]).toEqual([4, 0])
  })

  it('never goes below zero', () => {
    expect(stepCounter(newCounter('x'), -1).value).toBe(0)
  })

  it('moves linked counters together with the main counter only', () => {
    const p = newProject('Test')
    const linked = newCounter('Repeat', '#000', { linked: true, max: 4, wrap: true })
    const free = newCounter('Free')
    p.counters.push(linked, free)
    let q = changeCounter(p, p.mainCounterId, 1)
    expect(q.counters.map((c) => c.value)).toEqual([1, 1, 0])
    q = changeCounter(q, free.id, 1)
    expect(q.counters.map((c) => c.value)).toEqual([1, 1, 1])
    q = changeCounter(q, linked.id, 1)
    expect(q.counters.map((c) => c.value)).toEqual([1, 2, 1])
  })
})

describe('row notes', () => {
  const p = newProject('Notes')
  const note = (extra: Partial<RowNote>): RowNote => ({
    id: Math.random().toString(),
    counterId: p.mainCounterId,
    kind: 'reminder',
    text: 'x',
    row: 4,
    ...extra,
  })

  it('matches single rows and repeating rows', () => {
    const repeat = note({ row: 4, every: 6, until: 22 })
    const at = (v: number) => activeNotes({ ...p, notes: [repeat], counters: [{ ...p.counters[0], value: v }] })
    expect(at(4).length).toBe(1)
    expect(at(10).length).toBe(1)
    expect(at(22).length).toBe(1)
    expect(at(28).length).toBe(0)
    expect(at(5).length).toBe(0)
  })

  it('finds the next upcoming note', () => {
    const q = { ...p, notes: [note({ row: 4, every: 6 }), note({ row: 12, text: 'y' })] }
    q.counters = [{ ...q.counters[0], value: 5 }]
    expect(nextNote(q)?.at).toBe(10)
  })

  it('triggers reminders only when moving forward onto the row', () => {
    const q = { ...p, notes: [note({ row: 1 })] }
    const fwd = changeCounter(q, q.mainCounterId, 1)
    expect(triggeredReminders(q, fwd).length).toBe(1)
    const back = changeCounter(changeCounter(fwd, q.mainCounterId, 1), q.mainCounterId, -1)
    expect(triggeredReminders(changeCounter(fwd, q.mainCounterId, 1), back).length).toBe(0)
  })
})

describe('timer', () => {
  it('accumulates running time across pauses', () => {
    let t = startTimer({ totalMs: 1000, runningSince: null }, 0)
    expect(elapsedMs(t, 500)).toBe(1500)
    t = pauseTimer(t, 2000)
    expect(t).toEqual({ totalMs: 3000, runningSince: null })
    expect(elapsedMs(t, 99999)).toBe(3000)
  })
})
