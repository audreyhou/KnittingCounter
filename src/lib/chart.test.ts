import { describe, expect, it } from 'vitest'
import type { Chart } from '../types'
import { advanceStitch, cellAt, estimateCells, linkedRow, linkedSteps, rowBand, stitchCell } from './chart'

const chart: Chart = {
  id: 'c',
  name: 'Chart 1',
  page: 3,
  rect: { x: 100, y: 200, w: 260, h: 240 },
  rows: 24,
  cols: 26,
  row: 1,
  stitch: 1,
  mode: 'stitch',
  bottomUp: true,
  flat: true,
  firstRowRS: true,
  color: '#29a3f5',
  showGrid: true,
  dimOthers: false,
  shadeDone: true,
  rowOffset: 0,
}

describe('chart geometry', () => {
  it('puts row 1 at the bottom of a bottom-up chart', () => {
    expect(rowBand(chart, 1)).toEqual({ x: 100, y: 430, w: 260, h: 10 })
    expect(rowBand(chart, 24).y).toBe(200)
  })

  it('reads RS rows right to left and WS rows left to right when worked flat', () => {
    expect(stitchCell(chart, 1, 1).x).toBe(350)
    expect(stitchCell(chart, 2, 1).x).toBe(100)
    expect(stitchCell({ ...chart, flat: false }, 2, 1).x).toBe(350)
  })

  it('advances stitch by stitch onto the next row and wraps after the last row', () => {
    expect(advanceStitch({ ...chart, stitch: 26 }, 1)).toEqual({ row: 2, stitch: 1 })
    expect(advanceStitch({ ...chart, row: 24, stitch: 26 }, 1)).toEqual({ row: 1, stitch: 1 })
    expect(advanceStitch({ ...chart, row: 1, stitch: 1 }, -1)).toEqual({ row: 24, stitch: 26 })
  })

  it('maps counter rows onto chart repeats', () => {
    expect(linkedRow(chart, 1)).toBe(1)
    expect(linkedRow(chart, 24)).toBe(24)
    expect(linkedRow(chart, 25)).toBe(1)
    expect(linkedRow({ ...chart, rowOffset: -4 }, 5)).toBe(1)
  })

  it('moves a linked chart off row 1 even when the counter starts at 0', () => {
    expect(linkedSteps(chart, 0, 2, 1)).toBe(2)
    expect(linkedSteps(chart, 1, 2, 1)).toBe(1)
    expect(linkedSteps(chart, 24, 1, 1)).toBe(1)
    expect(linkedSteps(chart, 2, 1, -1)).toBe(1)
  })

  it('finds the cell under a point', () => {
    expect(cellAt(chart, 355, 435)).toEqual({ row: 1, stitch: 1 })
    expect(cellAt(chart, 105, 425)).toEqual({ row: 2, stitch: 1 })
    expect(cellAt(chart, 50, 50)).toBeNull()
  })
})

describe('estimateCells', () => {
  // Symbol centers measured on the Gleipnir lace chart (17 stitches, cells ~14 wide).
  const gleipnir = [94, 105.9, 119.9, 135.1, 148.4, 162.5, 176.5, 190.4, 205, 218.4, 232.4, 246.4, 260, 275, 287.8, 301.8, 317]

  it('detects non-square columns from symbol positions', () => {
    expect(estimateCells(gleipnir, 87, 237.8)?.n).toBe(17)
  })

  it('tolerates an imprecise box and reports how far to shift it', () => {
    const r = estimateCells(gleipnir, 84, 237.8)
    expect(r?.n).toBe(17)
    expect(r!.shift).toBeGreaterThan(1.5)
    expect(r!.shift).toBeLessThan(4.5)
  })

  it('works when only some columns have symbols', () => {
    const sparse = gleipnir.filter((_, i) => i % 3 !== 1)
    expect(estimateCells(sparse, 87, 237.8)?.n).toBe(17)
  })

  it('gives up without enough evidence', () => {
    expect(estimateCells([10, 20], 0, 100)).toBeNull()
  })
})
