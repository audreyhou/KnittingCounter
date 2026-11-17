import type { Chart, Rect } from '../types'

export function wrapRow(row: number, rows: number): number {
  return ((((row - 1) % rows) + rows) % rows) + 1
}

/** Row on the chart that corresponds to a counter value (1-based). */
export function linkedRow(c: Chart, counterValue: number): number {
  return wrapRow(Math.max(1, counterValue) + c.rowOffset, c.rows)
}

/**
 * How many counter steps in direction `d` move a linked chart onto `targetRow`.
 * A fresh counter (0) and row 1 both show chart row 1, so moving forward from
 * 0 takes two steps; otherwise one.
 */
export function linkedSteps(c: Chart, value: number, targetRow: number, d: 1 | -1): number {
  let v = value
  for (let steps = 1; steps <= 2; steps++) {
    v += d
    if (v < 0) break
    if (linkedRow(c, v) === targetRow) return steps
  }
  return 1
}

export function rowIsRS(c: Chart, row: number): boolean {
  if (!c.flat) return true
  return c.firstRowRS ? row % 2 === 1 : row % 2 === 0
}

/** Right-side rows are read right→left, wrong-side rows (flat only) left→right. */
export function rowReadsRtl(c: Chart, row: number): boolean {
  return rowIsRS(c, row)
}

export function rowBand(c: Chart, row: number): Rect {
  const ch = c.rect.h / c.rows
  const fromTop = c.bottomUp ? c.rows - row : row - 1
  return { x: c.rect.x, y: c.rect.y + fromTop * ch, w: c.rect.w, h: ch }
}

export function stitchCell(c: Chart, row: number, stitch: number): Rect {
  const band = rowBand(c, row)
  const cw = c.rect.w / c.cols
  const fromLeft = rowReadsRtl(c, row) ? c.cols - stitch : stitch - 1
  return { x: c.rect.x + fromLeft * cw, y: band.y, w: cw, h: band.h }
}

/** Moves through the chart one stitch at a time, continuing onto the next/previous row. */
export function advanceStitch(c: Chart, delta: 1 | -1): { row: number; stitch: number } {
  let { row, stitch } = c
  stitch += delta
  if (stitch > c.cols) {
    stitch = 1
    row = wrapRow(row + 1, c.rows)
  } else if (stitch < 1) {
    stitch = c.cols
    row = wrapRow(row - 1, c.rows)
  }
  return { row, stitch }
}

/**
 * Estimates how many equal cells span [start, start + length] from the centers
 * of symbols drawn in those cells. For each candidate count the symbol centers
 * are mapped onto a phase within their cell; the smallest count where the
 * phases agree (high mean resultant length) wins. Also returns how far the
 * grid should shift so the symbols sit in the middle of their cells.
 */
export function estimateCells(centers: number[], start: number, length: number, maxN = 150): { n: number; shift: number } | null {
  if (centers.length < 4 || length <= 0) return null
  for (let n = 2; n <= maxN; n++) {
    const w = length / n
    let sx = 0
    let sy = 0
    for (const c of centers) {
      const a = ((c - start) / w) * 2 * Math.PI
      sx += Math.cos(a)
      sy += Math.sin(a)
    }
    const r = Math.hypot(sx, sy) / centers.length
    if (r >= 0.8) {
      let phase = Math.atan2(sy, sx) / (2 * Math.PI)
      if (phase < 0) phase += 1
      return { n, shift: (phase - 0.5) * w }
    }
  }
  return null
}

/** Converts a point in page units into the chart cell under it, or null if outside. */
export function cellAt(c: Chart, x: number, y: number): { row: number; stitch: number } | null {
  const { rect } = c
  if (x < rect.x || y < rect.y || x > rect.x + rect.w || y > rect.y + rect.h) return null
  const col = Math.min(c.cols - 1, Math.floor(((x - rect.x) / rect.w) * c.cols))
  const fromTop = Math.min(c.rows - 1, Math.floor(((y - rect.y) / rect.h) * c.rows))
  const row = c.bottomUp ? c.rows - fromTop : fromTop + 1
  const stitch = rowReadsRtl(c, row) ? c.cols - col : col + 1
  return { row, stitch }
}
