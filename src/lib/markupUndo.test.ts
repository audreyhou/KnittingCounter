import { describe, expect, it } from 'vitest'
import type { Bookmark, Chart, Highlight, Markup } from '../types'
import { emptyMarkup } from '../types'
import { undoChange } from './markupUndo'

const chart: Chart = {
  id: 'c1',
  name: 'Chart 1',
  page: 3,
  rect: { x: 0, y: 0, w: 100, h: 100 },
  rows: 24,
  cols: 20,
  row: 1,
  stitch: 1,
  mode: 'row',
  bottomUp: true,
  flat: true,
  firstRowRS: true,
  color: '#000',
  showGrid: true,
  dimOthers: false,
  shadeDone: true,
  rowOffset: 0,
}
const hl: Highlight = { id: 'h1', page: 0, rects: [{ x: 1, y: 1, w: 5, h: 5 }], color: '#ff0' }
const bm: Bookmark = { id: 'b1', page: 2, rect: { x: 0, y: 0, w: 10, h: 10 }, label: 'Abbreviations', image: '', pinned: true }

const base: Markup = { ...emptyMarkup('p'), charts: [chart], bookmarks: [bm], activeChartId: 'c1' }

describe('undoChange', () => {
  it('removes an added highlight but keeps later chart settings and bookmark edits', () => {
    const after = { ...base, highlights: [hl] }
    const current: Markup = {
      ...after,
      charts: [{ ...chart, cols: 17, linkCounterId: 'row', row: 9 }],
      bookmarks: [{ ...bm, label: 'Sizes', pinned: false }],
    }
    const out = undoChange({ before: base, after }, current)
    expect(out.highlights).toEqual([])
    expect(out.charts[0]).toMatchObject({ cols: 17, linkCounterId: 'row', row: 9 })
    expect(out.bookmarks[0]).toMatchObject({ label: 'Sizes', pinned: false })
  })

  it('reverts a chart move while keeping progress and settings changed afterwards', () => {
    const moved = { ...chart, rect: { x: 5, y: 5, w: 100, h: 100 } }
    const after = { ...base, charts: [moved] }
    const current = { ...after, charts: [{ ...moved, rows: 12, row: 7, stitch: 3 }] }
    const out = undoChange({ before: base, after }, current)
    expect(out.charts[0]).toMatchObject({ rect: chart.rect, rows: 12, row: 7, stitch: 3 })
  })

  it('brings back a deleted item in its place and clears a removed active chart', () => {
    const two = { ...base, bookmarks: [bm, { ...bm, id: 'b2' }] }
    const deleted = { ...two, bookmarks: [{ ...bm, id: 'b2' }] }
    expect(undoChange({ before: two, after: deleted }, deleted).bookmarks.map((b) => b.id)).toEqual(['b1', 'b2'])

    const noChart = { ...base, charts: [], activeChartId: undefined }
    const created = { ...noChart, charts: [chart], activeChartId: 'c1' }
    const out = undoChange({ before: noChart, after: created }, created)
    expect(out.charts).toEqual([])
    expect(out.activeChartId).toBeUndefined()
  })
})
