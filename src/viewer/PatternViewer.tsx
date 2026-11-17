import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { ColorDots } from '../components/Modal'
import { useToast } from '../components/Toast'
import { getPattern, savePattern } from '../db'
import { advanceStitch, estimateCells, linkedRow, linkedSteps, rowBand, stitchCell, wrapRow } from '../lib/chart'
import { uid } from '../lib/id'
import { pdfjs } from '../lib/pdf'
import type { Bookmark, Chart, Counter, Markup, PatternMeta, Rect, RowBar } from '../types'
import { PageView, type PageAction, type Tool } from './PageView'
import {
  BookmarkDock,
  BookmarkModal,
  ChartBar,
  ChartSettings,
  MarkupSheet,
  PinNoteModal,
  RowBarBar,
  SmartPanel,
} from './Panels'
import { CHART_COLORS, HL_COLORS, PEN_COLORS } from './colors'
import { openSource, type PageSource, type TextLine } from './source'
import { clientRectsToPage, type SmartRects } from './textMatch'
import { useMarkup } from './useMarkup'

const TOOLS: { id: Tool; icon: IconName; label: string; hint?: string }[] = [
  { id: 'pan', icon: 'hand', label: 'Scroll', hint: 'Scroll and zoom. Select text to highlight it.' },
  { id: 'rowbar', icon: 'rowbar', label: 'Row bar', hint: 'Tap a line or drag the bar. Use the arrows to move line by line.' },
  { id: 'highlight', icon: 'highlight', label: 'Highlight', hint: 'Drag over a size, instruction or area to highlight it.' },
  { id: 'marker', icon: 'marker', label: 'Marker', hint: 'Highlight freehand.' },
  { id: 'pen', icon: 'pen', label: 'Pen', hint: 'Draw on the pattern.' },
  { id: 'note', icon: 'note', label: 'Note', hint: 'Tap where the note should go.' },
  { id: 'eraser', icon: 'eraser', label: 'Erase', hint: 'Tap or drag over marks, highlights and notes to erase them.' },
  { id: 'bookmark', icon: 'bookmark', label: 'Bookmark', hint: 'Drag around info to keep pinned on screen (sizes, abbreviations…).' },
  { id: 'chart', icon: 'chart', label: 'Chart', hint: 'Drag a box tightly around the chart squares. Tap a square to jump to it.' },
]

const PEN_WIDTHS = [1.2, 2.2, 4]
const MARKER_WIDTHS = [8, 12, 18]
const DOCK_SIZES = [90, 130, 190]

type ModalState =
  | null
  | { type: 'chart'; id: string }
  | { type: 'note'; id: string }
  | { type: 'bookmark'; id: string }
  | { type: 'smart' }
  | { type: 'sheet' }

export interface ViewerProps {
  patternId: string
  counters?: Counter[]
  onStepCounter?: (counterId: string, d: 1 | -1) => void
  header?: ReactNode
  footer?: ReactNode
}

export function PatternViewer({ patternId, counters, onStepCounter, header, footer }: ViewerProps) {
  const toast = useToast()
  const [meta, setMeta] = useState<PatternMeta | null>(null)
  const [source, setSource] = useState<PageSource | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { markup, update, undo, canUndo } = useMarkup(patternId)
  const [tool, setTool] = useState<Tool>('pan')
  const [colors, setColors] = useState({ highlight: HL_COLORS[0], marker: HL_COLORS[2], pen: PEN_COLORS[0], note: PEN_COLORS[1] })
  const [widthIdx, setWidthIdx] = useState({ pen: 1, marker: 1 })
  const [zoom, setZoom] = useState(1)
  const [containerW, setContainerW] = useState(0)
  const [visible, setVisible] = useState<Set<number>>(() => new Set([0, 1]))
  const [currentPage, setCurrentPage] = useState(0)
  const [modal, setModal] = useState<ModalState>(null)
  const [dockCollapsed, setDockCollapsed] = useState(false)
  const [dockSize, setDockSize] = useState(1)
  const [selection, setSelection] = useState<{ x: number; y: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const canvases = useRef(new Map<number, HTMLCanvasElement>())
  const smartRects = useRef(new Map<number, SmartRects[]>())
  const anchor = useRef<{ left: number; top: number } | null>(null)
  const restored = useRef(false)

  // Load pattern file.
  useEffect(() => {
    let alive = true
    let src: PageSource | null = null
    setSource(null)
    setError(null)
    restored.current = false
    void (async () => {
      try {
        const m = await getPattern(patternId)
        if (!m) throw new Error('This pattern is no longer in your library.')
        if (!alive) return
        setMeta(m)
        void savePattern({ ...m, lastOpenedAt: Date.now() })
        src = await openSource(m)
        if (!alive) return src.destroy()
        setSource(src)
      } catch (e) {
        if (alive) setError((e as Error).message || String(e))
      }
    })()
    return () => {
      alive = false
      src?.destroy()
    }
  }, [patternId])

  // Track container width for fit-to-width.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerW(el.clientWidth))
    ro.observe(el)
    setContainerW(el.clientWidth)
    return () => ro.disconnect()
  }, [source])

  const maxW = source ? Math.max(...source.sizes.map((s) => s.w)) : 1
  const fitScale = containerW > 0 ? Math.max(0.1, (containerW - (containerW < 600 ? 12 : 40)) / maxW) : 1
  const scale = fitScale * zoom
  const unit = (page: number) => (source ? source.sizes[page].w / 600 : 1)

  // Lazily render pages near the viewport.
  useEffect(() => {
    const root = scrollRef.current
    const pages = pagesRef.current
    if (!root || !pages || !source) return
    const io = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev)
          for (const e of entries) {
            const i = Number((e.target as HTMLElement).dataset.page)
            if (e.isIntersecting) next.add(i)
            else next.delete(i)
          }
          return next
        })
      },
      { root, rootMargin: '120% 40% 120% 40%' },
    )
    pages.querySelectorAll('.page').forEach((p) => io.observe(p))
    return () => io.disconnect()
  }, [source, containerW])

  const pageTop = useCallback((page: number) => {
    const el = scrollRef.current
    const pageEl = pagesRef.current?.querySelector<HTMLElement>(`[data-page="${page}"]`)
    if (!el || !pageEl) return null
    return {
      top: pageEl.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop,
      left: pageEl.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft,
    }
  }, [])

  const goTo = useCallback(
    (page: number, y = 0, smooth = true) => {
      const el = scrollRef.current
      const pos = pageTop(page)
      if (!el || !pos) return
      el.scrollTo({ top: Math.max(0, pos.top + y * scale - 70), behavior: smooth ? 'smooth' : 'auto' })
    },
    [pageTop, scale],
  )

  /** Scrolls just enough to keep a region (page units) comfortably on screen. */
  const ensureVisible = useCallback(
    (page: number, r: Rect) => {
      const el = scrollRef.current
      const pos = pageTop(page)
      if (!el || !pos) return
      const top = pos.top + r.y * scale
      const bottom = top + r.h * scale
      const left = pos.left + r.x * scale
      const right = left + r.w * scale
      const margin = Math.min(120, el.clientHeight * 0.2)
      let nextTop = el.scrollTop
      let nextLeft = el.scrollLeft
      if (top < el.scrollTop + margin || bottom > el.scrollTop + el.clientHeight - margin) nextTop = top - el.clientHeight * 0.4
      if (r.w * scale < el.clientWidth && (left < el.scrollLeft || right > el.scrollLeft + el.clientWidth)) nextLeft = left - el.clientWidth / 2 + (r.w * scale) / 2
      if (nextTop !== el.scrollTop || nextLeft !== el.scrollLeft) el.scrollTo({ top: nextTop, left: nextLeft, behavior: 'smooth' })
    },
    [pageTop, scale],
  )

  // Restore reading position once.
  useLayoutEffect(() => {
    if (restored.current || !source || !markup || containerW === 0) return
    restored.current = true
    if (markup.lastPage) requestAnimationFrame(() => goTo(markup.lastPage!, 0, false))
  }, [source, markup, containerW, goTo])

  // Current page from scroll position.
  const onScroll = useCallback(() => {
    const el = scrollRef.current
    const pages = pagesRef.current
    if (!el || !pages) return
    const probe = el.getBoundingClientRect().top + el.clientHeight * 0.35
    let cur = 0
    pages.querySelectorAll<HTMLElement>('.page').forEach((p, i) => {
      if (p.getBoundingClientRect().top <= probe) cur = i
    })
    setCurrentPage(cur)
  }, [])

  useEffect(() => {
    if (!markup || !restored.current || markup.lastPage === currentPage) return
    update((m) => ({ ...m, lastPage: currentPage }), false)
  }, [currentPage, markup, update])

  // Zoom with anchor point.
  const zoomTo = useCallback(
    (z: number, clientX?: number, clientY?: number) => {
      const el = scrollRef.current
      const nz = Math.min(6, Math.max(0.4, z))
      if (!el) return setZoom(nz)
      const r = el.getBoundingClientRect()
      const fx = (clientX ?? r.left + r.width / 2) - r.left
      const fy = (clientY ?? r.top + r.height / 2) - r.top
      const ratio = nz / zoom
      anchor.current = { left: (el.scrollLeft + fx) * ratio - fx, top: (el.scrollTop + fy) * ratio - fy }
      setZoom(nz)
    },
    [zoom],
  )

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && anchor.current) {
      el.scrollLeft = anchor.current.left
      el.scrollTop = anchor.current.top
      anchor.current = null
    }
  }, [zoom])

  // Pinch-to-zoom and ctrl+wheel zoom.
  const zoomRef = useRef(zoomTo)
  zoomRef.current = zoomTo
  const zoomVal = useRef(zoom)
  zoomVal.current = zoom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let pinch: { d: number; z: number } | null = null
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch = { d: dist(e.touches), z: zoomVal.current }
    }
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return
      e.preventDefault()
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const z = pinch.z * (dist(e.touches) / pinch.d)
      if (Math.abs(z - zoomVal.current) / zoomVal.current > 0.02) zoomRef.current(z, cx, cy)
    }
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null
    }
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoomRef.current(zoomVal.current * Math.exp(-e.deltaY * 0.0025), e.clientX, e.clientY)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('wheel', onWheel)
    }
  }, [source])

  // Effective chart positions (linked charts follow a project counter).
  const chartRows = useMemo(() => {
    const out: Record<string, { row: number; stitch: number }> = {}
    for (const c of markup?.charts ?? []) {
      const counter = c.linkCounterId ? counters?.find((x) => x.id === c.linkCounterId) : undefined
      out[c.id] = { row: counter ? linkedRow(c, counter.value) : c.row, stitch: c.stitch }
    }
    return out
  }, [markup?.charts, counters])

  const activeChart = markup?.charts.find((c) => c.id === markup.activeChartId)
  const linkedCounterOf = (c: Chart) => (c.linkCounterId ? counters?.find((x) => x.id === c.linkCounterId) : undefined)

  const patchChart = useCallback(
    (id: string, patch: Partial<Chart>, undoable = false) =>
      update((m) => ({ ...m, charts: m.charts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), undoable),
    [update],
  )

  /** Steps the counter a linked chart follows until the chart reaches `targetRow`. */
  const stepLinkedCounter = (chart: Chart, counter: Counter, targetRow: number, d: 1 | -1) => {
    const n = linkedSteps(chart, counter.value, targetRow, d)
    for (let i = 0; i < n; i++) onStepCounter?.(counter.id, d)
  }

  const stepChartRow = (d: 1 | -1) => {
    if (!activeChart) return
    const id = activeChart.id
    const linked = linkedCounterOf(activeChart)
    if (linked && onStepCounter) {
      stepLinkedCounter(activeChart, linked, wrapRow(chartRows[id].row + d, activeChart.rows), d)
      patchChart(id, { stitch: 1 })
    } else {
      update((m) => ({ ...m, charts: m.charts.map((c) => (c.id === id ? { ...c, row: wrapRow(c.row + d, c.rows), stitch: 1 } : c)) }), false)
    }
  }

  const stepChartStitch = (d: 1 | -1) => {
    if (!activeChart) return
    const id = activeChart.id
    const linked = linkedCounterOf(activeChart)
    let crossed = false as boolean
    let target = 0
    // Computed from the latest markup so quick repeated taps are not lost.
    update((m) => {
      const c = m.charts.find((x) => x.id === id)
      if (!c) return m
      const row = linked ? chartRows[id].row : c.row
      const next = advanceStitch({ ...c, row }, d)
      crossed = next.row !== row
      target = next.row
      return { ...m, charts: m.charts.map((x) => (x.id === id ? { ...x, stitch: next.stitch, row: linked ? x.row : next.row } : x)) }
    }, false)
    if (crossed && linked && onStepCounter) stepLinkedCounter(activeChart, linked, target, d)
  }

  // Keep the active chart row / stitch on screen as it moves.
  const activePos = activeChart ? chartRows[activeChart.id] : null
  useEffect(() => {
    if (!activeChart || !activePos) return
    const r = activeChart.mode === 'stitch' ? stitchCell(activeChart, activePos.row, activePos.stitch) : rowBand(activeChart, activePos.row)
    ensureVisible(activeChart.page, r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePos?.row, activePos?.stitch, activeChart?.id])

  // Row bar
  const defaultBar = (page: number, y: number): RowBar => ({
    page,
    y,
    h: 15 * unit(page),
    color: HL_COLORS[0],
    mask: false,
    snap: source?.kind === 'pdf',
  })

  const linesFor = useCallback((page: number): Promise<TextLine[]> => source?.lines(page) ?? Promise.resolve([]), [source])

  const stepRowBar = async (d: 1 | -1) => {
    const bar = markup?.rowBar
    if (!bar || !source) return
    let next: RowBar | null = null
    if (bar.snap && source.kind === 'pdf') {
      const center = bar.y + bar.h / 2
      const pad = 1.5 * unit(bar.page)
      const fit = (page: number, l: TextLine): RowBar => ({ ...bar, page, y: l.y - pad, h: l.h + pad * 2 })
      const here = await linesFor(bar.page)
      const cand = d > 0 ? here.find((l) => l.y + l.h / 2 > center + 1) : [...here].reverse().find((l) => l.y + l.h / 2 < center - 1)
      if (cand) next = fit(bar.page, cand)
      for (let p = bar.page + d; !next && p >= 0 && p < source.sizes.length; p += d) {
        const ls = await linesFor(p)
        if (ls.length) next = fit(p, d > 0 ? ls[0] : ls[ls.length - 1])
      }
    } else {
      let page = bar.page
      let y = bar.y + d * bar.h
      if (y + bar.h > source.sizes[page].h && page + 1 < source.sizes.length) {
        page += 1
        y = 0
      } else if (y < 0 && page > 0) {
        page -= 1
        y = source.sizes[page].h - bar.h
      }
      y = Math.max(0, Math.min(source.sizes[page].h - bar.h, y))
      next = { ...bar, page, y }
    }
    if (next) {
      const n = next
      update((m) => ({ ...m, rowBar: n }), false)
      ensureVisible(n.page, { x: 0, y: n.y, w: 1, h: n.h })
    }
  }

  const startRowBar = async () => {
    if (!source || markup?.rowBar) return
    const page = currentPage
    const ls = await linesFor(page)
    if (ls.length) {
      const pad = 1.5 * unit(page)
      const el = scrollRef.current
      const pos = pageTop(page)
      const viewY = el && pos ? (el.scrollTop - pos.top) / scale + 60 / scale : 0
      const l = ls.find((x) => x.y > viewY) ?? ls[0]
      update((m) => ({ ...m, rowBar: { ...defaultBar(page, l.y - pad), h: l.h + pad * 2 } }), false)
    } else update((m) => ({ ...m, rowBar: defaultBar(page, source.sizes[page].h * 0.15) }), false)
  }

  // Bookmarks
  const cropImage = async (page: number, rect: Rect): Promise<string> => {
    if (!source) return ''
    const size = source.sizes[page]
    let s = Math.min(4, Math.max(0.5, 900 / rect.w))
    while (size.w * size.h * s * s > 20_000_000) s *= 0.8
    const full = document.createElement('canvas')
    await source.render(page, full, s).promise
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(rect.w * s))
    out.height = Math.max(1, Math.round(rect.h * s))
    const ctx = out.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(full, rect.x * s, rect.y * s, rect.w * s, rect.h * s, 0, 0, out.width, out.height)
    full.width = 0
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = 0.5
    const rects: { color: string; r: Rect }[] = []
    for (const h of markup?.highlights ?? []) if (h.page === page) h.rects.forEach((r) => rects.push({ color: h.color, r }))
    for (const sr of smartRects.current.get(page) ?? []) sr.rects.forEach((r) => rects.push({ color: sr.color, r }))
    for (const { color, r } of rects) {
      ctx.fillStyle = color
      ctx.fillRect((r.x - rect.x) * s, (r.y - rect.y) * s, r.w * s, r.h * s)
    }
    return out.toDataURL('image/jpeg', 0.9)
  }

  const textInRect = async (page: number, rect: Rect): Promise<string> => {
    const p = await source?.pdfPage(page)
    if (!p) return ''
    const vp = p.getViewport({ scale: 1 })
    const tc = await p.getTextContent()
    const words: string[] = []
    for (const it of tc.items) {
      if (!('str' in it) || !it.str.trim()) continue
      const t = pdfjs.Util.transform(vp.transform, it.transform)
      if (t[4] >= rect.x - 2 && t[4] <= rect.x + rect.w && t[5] >= rect.y && t[5] <= rect.y + rect.h + 4) words.push(it.str.trim())
    }
    return words.join(' ')
  }

  const createBookmark = async (page: number, rect: Rect) => {
    const [image, text] = await Promise.all([cropImage(page, rect), textInRect(page, rect)])
    const n = (markup?.bookmarks.length ?? 0) + 1
    const label = text ? (text.length > 32 ? `${text.slice(0, 30).trim()}…` : text) : `Bookmark ${n}`
    const b: Bookmark = { id: uid(), page, rect, label, image, pinned: true }
    update((m) => ({ ...m, bookmarks: [...m.bookmarks, b] }))
    setDockCollapsed(false)
    toast(<>Pinned “{label}” to the top. Tap it to rename or jump.</>)
  }

  /**
   * Guesses the grid: rows from row numbers printed beside the chart, columns from
   * where chart symbols sit (cells are often not square). Also nudges the box so
   * symbols land in the middle of their cells. Falls back to square cells.
   */
  const guessGrid = async (page: number, rect: Rect): Promise<{ rows: number; cols: number; rect: Rect }> => {
    let rows = 0
    let cols = 0
    let out = rect
    const p = await source?.pdfPage(page)
    if (p) {
      const vp = p.getViewport({ scale: 1 })
      const tc = await p.getTextContent()
      const nums = new Set<number>()
      const xs: number[] = []
      const ys: number[] = []
      const side = Math.max(30, rect.w * 0.12)
      for (const it of tc.items) {
        if (!('str' in it) || !it.str.trim()) continue
        const t = pdfjs.Util.transform(vp.transform, it.transform)
        const x = t[4]
        const y = t[5]
        const fs = Math.hypot(t[2], t[3])
        if (/^\s*\d{1,3}\s*$/.test(it.str)) {
          if (y >= rect.y - 2 && y <= rect.y + rect.h + 8 && x >= rect.x - side && x <= rect.x + rect.w + side) nums.add(parseInt(it.str, 10))
          continue
        }
        if (it.str.trim().length !== 1) continue
        const cx = x + (it.width * vp.scale) / 2
        const cy = y - fs * 0.35
        if (cx > rect.x && cx < rect.x + rect.w && cy > rect.y && cy < rect.y + rect.h) {
          xs.push(cx)
          ys.push(cy)
        }
      }
      const max = Math.max(0, ...nums)
      if (max >= 2 && nums.size >= Math.min(max, 4) * 0.4 && max <= 200) rows = max
      else rows = estimateCells(ys, rect.y, rect.h)?.n ?? 0
      const est = estimateCells(xs, rect.x, rect.w)
      if (est) {
        cols = est.n
        if (Math.abs(est.shift) < rect.w / est.n / 2) out = { ...rect, x: rect.x + est.shift }
      }
    }
    if (!rows) rows = Math.max(1, Math.round(rect.h / (rect.w / 10)))
    if (!cols) cols = Math.max(1, Math.round(rect.w / (rect.h / rows)))
    return { rows, cols, rect: out }
  }

  const createChart = async (page: number, drawn: Rect) => {
    const { rows, cols, rect } = await guessGrid(page, drawn)
    const n = markup?.charts.length ?? 0
    const c: Chart = {
      id: uid(),
      name: `Chart ${n + 1}`,
      page,
      rect,
      rows,
      cols,
      row: 1,
      stitch: 1,
      mode: 'row',
      bottomUp: true,
      flat: true,
      firstRowRS: true,
      color: CHART_COLORS[n % CHART_COLORS.length],
      showGrid: true,
      dimOthers: false,
      shadeDone: true,
      rowOffset: 0,
    }
    update((m) => ({ ...m, charts: [...m.charts, c], activeChartId: c.id }))
    setModal({ type: 'chart', id: c.id })
  }

  const erase = (page: number, x: number, y: number) => {
    const tol = 8 / scale
    update((m) => {
      const hitStroke = m.strokes.find((s) => {
        if (s.page !== page) return false
        const reach = s.width / 2 + tol
        for (let i = 0; i < s.points.length; i += 2) {
          const ax = s.points[i]
          const ay = s.points[i + 1]
          const bx = s.points[i + 2] ?? ax
          const by = s.points[i + 3] ?? ay
          const dx = bx - ax
          const dy = by - ay
          const len = dx * dx + dy * dy
          const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0
          if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) < reach) return true
        }
        return false
      })
      if (hitStroke) return { ...m, strokes: m.strokes.filter((s) => s !== hitStroke) }
      const hitNote = m.notes.find((n) => n.page === page && Math.hypot(n.x - x, n.y - y) < tol * 2)
      if (hitNote) return { ...m, notes: m.notes.filter((n) => n !== hitNote) }
      const hitHl = m.highlights.find((h) => h.page === page && h.rects.some((r) => x >= r.x - 1 && x <= r.x + r.w + 1 && y >= r.y - 1 && y <= r.y + r.h + 1))
      if (hitHl) return { ...m, highlights: m.highlights.filter((h) => h !== hitHl) }
      return m
    })
  }

  // Page actions (kept in a ref so PageView callbacks stay stable).
  const actionRef = useRef<(a: PageAction) => void>(() => {})
  actionRef.current = (a: PageAction) => {
    if (!markup || !source) return
    switch (a.type) {
      case 'rect':
        if (a.tool === 'highlight') {
          update((m) => ({ ...m, highlights: [...m.highlights, { id: uid(), page: a.page, rects: [a.rect], color: colors.highlight }] }))
        } else if (a.tool === 'bookmark') void createBookmark(a.page, a.rect)
        else void createChart(a.page, a.rect)
        break
      case 'stroke': {
        const marker = tool === 'marker'
        const width = (marker ? MARKER_WIDTHS[widthIdx.marker] : PEN_WIDTHS[widthIdx.pen]) * unit(a.page)
        update((m) => ({
          ...m,
          strokes: [...m.strokes, { id: uid(), page: a.page, points: a.points, color: marker ? colors.marker : colors.pen, width, opacity: marker ? 0.4 : 1 }],
        }))
        break
      }
      case 'tap':
        if (a.tool === 'note') {
          const id = uid()
          update((m) => ({ ...m, notes: [...m.notes, { id, page: a.page, x: a.x, y: a.y, text: '', color: colors.note }] }))
          setModal({ type: 'note', id })
        } else if (a.tool === 'chart') {
          const hit = markup.charts.find((c) => c.page === a.page && a.x >= c.rect.x && a.x <= c.rect.x + c.rect.w && a.y >= c.rect.y && a.y <= c.rect.y + c.rect.h)
          if (hit) update((m) => ({ ...m, activeChartId: hit.id }), false)
        }
        break
      case 'erase':
        erase(a.page, a.x, a.y)
        break
      case 'rowbar': {
        const size = source.sizes[a.page]
        update((m) => {
          const bar = m.rowBar ?? defaultBar(a.page, a.y)
          return { ...m, rowBar: { ...bar, page: a.page, y: Math.max(-bar.h / 2, Math.min(size.h - bar.h / 2, a.y)) } }
        }, false)
        break
      }
      case 'chart-rect':
        patchChart(a.chartId, { rect: a.rect }, true)
        break
      case 'chart-cell': {
        const c = markup.charts.find((x) => x.id === a.chartId)
        if (!c) break
        const linked = linkedCounterOf(c)
        if (linked) {
          if (a.row !== chartRows[c.id]?.row) toast(`This chart follows the ${linked.name} counter. Change the counter to move rows.`)
          update((m) => ({ ...m, activeChartId: c.id, charts: m.charts.map((x) => (x.id === c.id ? { ...x, stitch: a.stitch } : x)) }), false)
        } else {
          update((m) => ({ ...m, activeChartId: c.id, charts: m.charts.map((x) => (x.id === c.id ? { ...x, row: a.row, stitch: a.stitch } : x)) }), false)
        }
        break
      }
      case 'note-open':
        setModal({ type: 'note', id: a.id })
        break
    }
  }
  const onAction = useCallback((a: PageAction) => actionRef.current(a), [])
  const onSmartRects = useCallback((page: number, r: SmartRects[]) => smartRects.current.set(page, r), [])
  const registerCanvas = useCallback((page: number, c: HTMLCanvasElement | null) => {
    if (c) canvases.current.set(page, c)
    else canvases.current.delete(page)
  }, [])

  // Highlight selected text.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const on = () => {
      clearTimeout(t)
      t = setTimeout(() => {
        const sel = document.getSelection()
        if (!sel || sel.isCollapsed || !sel.rangeCount || !pagesRef.current) return setSelection(null)
        const range = sel.getRangeAt(0)
        const node = range.commonAncestorContainer
        const el = node instanceof Element ? node : node.parentElement
        if (!el || !pagesRef.current.contains(el)) return setSelection(null)
        const r = range.getBoundingClientRect()
        setSelection({ x: r.left + r.width / 2, y: r.bottom })
      }, 180)
    }
    document.addEventListener('selectionchange', on)
    return () => {
      clearTimeout(t)
      document.removeEventListener('selectionchange', on)
    }
  }, [])

  const highlightSelection = (color: string) => {
    const sel = document.getSelection()
    if (!sel || !sel.rangeCount || !pagesRef.current) return
    const range = sel.getRangeAt(0)
    const text = sel.toString().trim().replace(/\s+/g, ' ')
    const added: { page: number; rects: Rect[] }[] = []
    pagesRef.current.querySelectorAll<HTMLElement>('.page').forEach((pageEl) => {
      const layer = pageEl.querySelector('.textLayer')
      if (!layer || !range.intersectsNode(layer)) return
      // Measure only the selected text. A range's own client rects also include
      // whole elements it fully covers (canvases, overlays), which span the page.
      const pieces: DOMRect[] = []
      const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!range.intersectsNode(n)) continue
        const sub = document.createRange()
        sub.selectNodeContents(n)
        if (range.compareBoundaryPoints(Range.START_TO_START, sub) > 0) sub.setStart(range.startContainer, range.startOffset)
        if (range.compareBoundaryPoints(Range.END_TO_END, sub) < 0) sub.setEnd(range.endContainer, range.endOffset)
        if (!sub.collapsed) pieces.push(...Array.from(sub.getClientRects()))
      }
      const rects = clientRectsToPage(pieces, pageEl, scale, 0.8)
      if (rects.length) added.push({ page: Number(pageEl.dataset.page), rects })
    })
    if (added.length) {
      update((m) => ({ ...m, highlights: [...m.highlights, ...added.map((a) => ({ id: uid(), page: a.page, rects: a.rects, color, text: text.slice(0, 120) }))] }))
    }
    sel.removeAllRanges()
    setSelection(null)
  }

  // Keyboard shortcuts.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyRef.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (modal || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      undo()
    } else if (e.key === 'Escape') setTool('pan')
    else if (e.key === 'ArrowDown' && markup?.rowBar) {
      e.preventDefault()
      void stepRowBar(1)
    } else if (e.key === 'ArrowUp' && markup?.rowBar) {
      e.preventDefault()
      void stepRowBar(-1)
    } else if (e.key === 'ArrowRight' && activeChart) {
      e.preventDefault()
      if (activeChart.mode === 'stitch') stepChartStitch(1)
      else stepChartRow(1)
    } else if (e.key === 'ArrowLeft' && activeChart) {
      e.preventDefault()
      if (activeChart.mode === 'stitch') stepChartStitch(-1)
      else stepChartRow(-1)
    } else if (e.key === '+' || e.key === '=') zoomTo(zoom * 1.2)
    else if (e.key === '-') zoomTo(zoom / 1.2)
  }
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  const selectTool = (t: Tool) => {
    setTool(t)
    if (t === 'rowbar') void startRowBar()
    if (t === 'chart' && !markup?.charts.length) toast('Drag a box tightly around the chart squares (not the row numbers).', 'info', 4000)
  }

  if (error) {
    return (
      <div className="viewer">
        <div className="viewer-toolbar">{header}</div>
        <div className="empty">
          <p>Could not open this pattern.</p>
          <p className="muted">{error}</p>
        </div>
      </div>
    )
  }

  const toolInfo = TOOLS.find((t) => t.id === tool)!
  const colorKey = tool === 'highlight' || tool === 'marker' || tool === 'pen' || tool === 'note' ? tool : null
  const palette = tool === 'pen' || tool === 'note' ? PEN_COLORS : HL_COLORS
  const modalChart = modal?.type === 'chart' ? markup?.charts.find((c) => c.id === modal.id) : undefined
  const modalNote = modal?.type === 'note' ? markup?.notes.find((n) => n.id === modal.id) : undefined
  const modalBookmark = modal?.type === 'bookmark' ? markup?.bookmarks.find((b) => b.id === modal.id) : undefined
  const penWidth = (tool === 'marker' ? MARKER_WIDTHS[widthIdx.marker] : PEN_WIDTHS[widthIdx.pen]) * unit(currentPage)

  return (
    <div className="viewer">
      <div className="viewer-toolbar">
        {header}
        <div className="tools" role="toolbar" aria-label="Pattern tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`tool ${tool === t.id ? 'on' : ''}`}
              onClick={() => selectTool(t.id)}
              aria-pressed={tool === t.id}
              title={t.label}
            >
              <Icon name={t.icon} size={20} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-actions">
          <button className="icon-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
            <Icon name="undo" size={20} />
          </button>
          <button className="icon-btn" onClick={() => zoomTo(zoom / 1.25)} aria-label="Zoom out">
            <Icon name="zoomOut" size={20} />
          </button>
          <button className="zoom-label" onClick={() => zoomTo(1)} title="Fit width">
            {Math.round(zoom * 100)}%
          </button>
          <button className="icon-btn" onClick={() => zoomTo(zoom * 1.25)} aria-label="Zoom in">
            <Icon name="zoomIn" size={20} />
          </button>
          <button className="icon-btn" onClick={() => setModal({ type: 'smart' })} title="Smart highlights (my size, words)" aria-label="Smart highlights">
            <Icon name="sun" size={20} />
          </button>
          <button className="icon-btn" onClick={() => setModal({ type: 'sheet' })} title="Bookmarks, charts and notes" aria-label="Markup list">
            <Icon name="list" size={20} />
          </button>
        </div>
      </div>
      {markup && (
        <BookmarkDock
          bookmarks={markup.bookmarks}
          size={DOCK_SIZES[dockSize]}
          collapsed={dockCollapsed}
          onToggle={() => setDockCollapsed((c) => !c)}
          onSize={() => setDockSize((s) => (s + 1) % DOCK_SIZES.length)}
          onOpen={(b) => setModal({ type: 'bookmark', id: b.id })}
        />
      )}
      <div className="viewer-stage">
      {tool !== 'pan' && (
        <div className="tool-context">
          <span className="tool-hint">{toolInfo.hint}</span>
          {colorKey && (
            <ColorDots colors={palette} value={colors[colorKey]} onChange={(c) => setColors((x) => ({ ...x, [colorKey]: c }))} size={24} />
          )}
          {(tool === 'pen' || tool === 'marker') && (
            <div className="widths" role="radiogroup" aria-label="Line width">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  role="radio"
                  aria-checked={widthIdx[tool] === i}
                  className={widthIdx[tool] === i ? 'on' : ''}
                  onClick={() => setWidthIdx((w) => ({ ...w, [tool]: i }))}
                  aria-label={['Thin', 'Medium', 'Thick'][i]}
                >
                  <span style={{ width: 4 + i * 5, height: 4 + i * 5 }} />
                </button>
              ))}
            </div>
          )}
          {tool === 'chart' && activeChart && (
            <button className="btn small" onClick={() => setModal({ type: 'chart', id: activeChart.id })}>
              <Icon name="settings" size={16} /> {activeChart.name} settings
            </button>
          )}
          <button className="btn small ghost" onClick={() => setTool('pan')}>
            Done
          </button>
        </div>
      )}
      <div className={`viewer-scroll tool-${tool}`} ref={scrollRef} onScroll={onScroll}>
        {!source || !markup ? (
          <div className="empty">
            <div className="spinner" />
            <p className="muted">Opening {meta?.name ?? 'pattern'}…</p>
          </div>
        ) : (
          <div className="pages" ref={pagesRef}>
            {source.sizes.map((size, i) => (
              <PageView
                key={i}
                index={i}
                size={size}
                scale={scale}
                source={source}
                active={visible.has(i)}
                markup={markup}
                rules={markup.rules}
                tool={tool}
                color={colorKey ? colors[colorKey] : colors.highlight}
                penWidth={penWidth}
                chartRows={chartRows}
                activeChartId={markup.activeChartId}
                onAction={onAction}
                onSmartRects={onSmartRects}
                registerCanvas={registerCanvas}
              />
            ))}
          </div>
        )}
        {source && (
          <div className="page-indicator" aria-live="polite">
            {currentPage + 1} / {source.sizes.length}
          </div>
        )}
      </div>
      </div>
      {selection && (
        <div className="selection-pop" style={{ left: selection.x, top: selection.y + 8 }} onPointerDown={(e) => e.preventDefault()}>
          <span>Highlight</span>
          {HL_COLORS.map((c) => (
            <button key={c} className="color-dot" style={{ background: c }} aria-label={`Highlight ${c}`} onClick={() => highlightSelection(c)} />
          ))}
        </div>
      )}
      <div className="viewer-bars">
        {markup?.rowBar && source && (
          <RowBarBar
            bar={markup.rowBar}
            hasLines={source.kind === 'pdf'}
            onStep={(d) => void stepRowBar(d)}
            onChange={(b) => update((m) => ({ ...m, rowBar: b }), false)}
            onClose={() => {
              update((m) => ({ ...m, rowBar: null }), false)
              if (tool === 'rowbar') setTool('pan')
            }}
          />
        )}
        {activeChart && chartRows[activeChart.id] && (
          <ChartBar
            chart={activeChart}
            charts={markup!.charts}
            pos={chartRows[activeChart.id]}
            linkedCounter={linkedCounterOf(activeChart)}
            onSelect={(id) => update((m) => ({ ...m, activeChartId: id }), false)}
            onStepRow={stepChartRow}
            onStepStitch={stepChartStitch}
            onToggleMode={() => patchChart(activeChart.id, { mode: activeChart.mode === 'row' ? 'stitch' : 'row' })}
            onSettings={() => setModal({ type: 'chart', id: activeChart.id })}
            onClose={() => update((m) => ({ ...m, activeChartId: undefined }), false)}
          />
        )}
        {footer}
      </div>

      {modalChart && (
        <ChartSettings
          chart={modalChart}
          counters={counters}
          onChange={(c) => update((m) => ({ ...m, charts: m.charts.map((x) => (x.id === c.id ? c : x)) }), false)}
          onDelete={() => {
            update((m) => ({ ...m, charts: m.charts.filter((x) => x.id !== modalChart.id), activeChartId: m.activeChartId === modalChart.id ? undefined : m.activeChartId }))
            setModal(null)
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modalNote && (
        <PinNoteModal
          note={modalNote}
          onSave={(n) => {
            update((m) => ({ ...m, notes: m.notes.map((x) => (x.id === n.id ? n : x)) }))
            setModal(null)
          }}
          onDelete={() => {
            update((m) => ({ ...m, notes: m.notes.filter((x) => x.id !== modalNote.id) }))
            setModal(null)
          }}
          onClose={() => {
            // Drop notes that were created but left empty.
            if (!modalNote.text) update((m) => ({ ...m, notes: m.notes.filter((x) => x.id !== modalNote.id) }), false)
            setModal(null)
          }}
        />
      )}
      {modalBookmark && (
        <BookmarkModal
          bookmark={modalBookmark}
          onChange={(b) => update((m) => ({ ...m, bookmarks: m.bookmarks.map((x) => (x.id === b.id ? b : x)) }), false)}
          onDelete={() => {
            update((m) => ({ ...m, bookmarks: m.bookmarks.filter((x) => x.id !== modalBookmark.id) }))
            setModal(null)
          }}
          onGo={() => {
            setModal(null)
            goTo(modalBookmark.page, modalBookmark.rect.y)
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'smart' && markup && source && (
        <SmartPanel markup={markup} source={source} onRules={(rules) => update((m) => ({ ...m, rules }))} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'sheet' && markup && (
        <MarkupSheet
          markup={markup}
          onGo={(p, y) => {
            setModal(null)
            goTo(p, y)
          }}
          onOpenBookmark={(b) => setModal({ type: 'bookmark', id: b.id })}
          onOpenChart={(c) => {
            update((m: Markup) => ({ ...m, activeChartId: c.id }), false)
            goTo(c.page, c.rect.y)
            setModal({ type: 'chart', id: c.id })
          }}
          onOpenNote={(n) => {
            goTo(n.page, n.y)
            setModal({ type: 'note', id: n.id })
          }}
          onToggleLabels={() => update((m) => ({ ...m, showNoteLabels: m.showNoteLabels === false }), false)}
          onDeleteHighlight={(id) => update((m) => ({ ...m, highlights: m.highlights.filter((h) => h.id !== id) }))}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
