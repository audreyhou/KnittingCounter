import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from 'react'
import type { PDFPageProxy, TextLayer as TextLayerT } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { rowBand, stitchCell, cellAt } from '../lib/chart'
import { pdfjs } from '../lib/pdf'
import type { Chart, Markup, Rect, SmartRule } from '../types'
import type { PageSize, PageSource } from './source'
import { computeSmartRects, type SmartRects } from './textMatch'

export type Tool = 'pan' | 'rowbar' | 'highlight' | 'marker' | 'pen' | 'note' | 'eraser' | 'bookmark' | 'chart'

export type PageAction =
  | { type: 'rect'; tool: 'highlight' | 'bookmark' | 'chart'; page: number; rect: Rect }
  | { type: 'stroke'; page: number; points: number[] }
  | { type: 'tap'; tool: Tool; page: number; x: number; y: number }
  | { type: 'erase'; page: number; x: number; y: number }
  | { type: 'rowbar'; page: number; y: number }
  | { type: 'chart-rect'; chartId: string; rect: Rect }
  | { type: 'chart-cell'; chartId: string; row: number; stitch: number }
  | { type: 'note-open'; id: string }

const MAX_CANVAS_PIXELS = 14_000_000

interface Props {
  index: number
  size: PageSize
  scale: number
  source: PageSource
  active: boolean
  markup: Markup
  rules: SmartRule[]
  tool: Tool
  color: string
  penWidth: number
  chartRows: Record<string, { row: number; stitch: number }>
  activeChartId?: string
  onAction: (a: PageAction) => void
  onSmartRects: (page: number, rects: SmartRects[]) => void
  registerCanvas: (page: number, c: HTMLCanvasElement | null) => void
}

type Drag =
  | { kind: 'stroke'; points: number[] }
  | { kind: 'rect'; x0: number; y0: number; x1: number; y1: number; tool: 'highlight' | 'bookmark' | 'chart' }
  | { kind: 'rowbar'; offset: number }
  | { kind: 'chart-resize'; chart: Chart; corner: number; rect: Rect }
  | { kind: 'chart-move'; chart: Chart; dx: number; dy: number; rect: Rect; moved: boolean; x0: number; y0: number }
  | { kind: 'erase' }
  | { kind: 'tap'; x: number; y: number }

function normRect(x0: number, y0: number, x1: number, y1: number): Rect {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }
}

function pointsToPath(p: number[]) {
  if (p.length < 2) return ''
  let d = `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`
  if (p.length === 2) d += `l0.01 0`
  for (let i = 2; i < p.length; i += 2) d += `L${p[i].toFixed(1)} ${p[i + 1].toFixed(1)}`
  return d
}

// Multi-touch guard shared by all pages: a second finger (pinch-zoom) cancels the
// drawing in progress and no new drag starts until every finger is lifted.
// Window capture listeners run before React's handlers for the same event.
const downPointers = new Set<number>()
let multiTouch = false
let cancelActiveDrag: (() => void) | null = null
window.addEventListener(
  'pointerdown',
  (e) => {
    downPointers.add(e.pointerId)
    if (downPointers.size > 1) {
      multiTouch = true
      cancelActiveDrag?.()
    }
  },
  true,
)
const releasePointer = (e: PointerEvent) => {
  downPointers.delete(e.pointerId)
  if (downPointers.size === 0) multiTouch = false
}
window.addEventListener('pointerup', releasePointer, true)
window.addEventListener('pointercancel', releasePointer, true)
window.addEventListener('blur', () => {
  downPointers.clear()
  multiTouch = false
})

function PageViewImpl(props: Props) {
  const { index, size, scale, source, active, markup, rules, tool, color, penWidth, chartRows, activeChartId, onAction } = props
  const pageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const textLayer = useRef<TextLayerT | null>(null)
  const pdfPage = useRef<PDFPageProxy | null>(null)
  const renderedPx = useRef(0)
  const [textReady, setTextReady] = useState(0)
  const [smart, setSmart] = useState<SmartRects[]>([])
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)

  const w = size.w * scale
  const h = size.h * scale
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  let px = scale * dpr
  if (size.w * size.h * px * px > MAX_CANVAS_PIXELS) px = Math.sqrt(MAX_CANVAS_PIXELS / (size.w * size.h))

  useEffect(() => {
    props.registerCanvas(index, canvasRef.current)
    return () => props.registerCanvas(index, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // Canvas rendering (rendered off-screen then swapped in to avoid flashing).
  useEffect(() => {
    const canvas = canvasRef.current!
    if (!active) {
      if (renderedPx.current) {
        canvas.width = 0
        canvas.height = 0
        renderedPx.current = 0
      }
      return
    }
    if (Math.abs(renderedPx.current - px) < 0.001) return
    let job: ReturnType<PageSource['render']> | null = null
    let cancelled = false
    const t = setTimeout(
      () => {
        const off = document.createElement('canvas')
        job = source.render(index, off, px)
        job.promise
          .then(() => {
            if (cancelled) return
            canvas.width = off.width
            canvas.height = off.height
            canvas.getContext('2d')!.drawImage(off, 0, 0)
            renderedPx.current = px
            off.width = 0
          })
          .catch((e) => console.warn('render failed', e))
      },
      renderedPx.current ? 140 : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(t)
      job?.cancel()
    }
  }, [active, px, index, source])

  // Text layer (PDF only): enables text selection and smart highlights.
  useEffect(() => {
    if (!active || source.kind !== 'pdf' || textLayer.current) return
    let cancelled = false
    void (async () => {
      const page = await source.pdfPage(index)
      if (!page || cancelled || !textRef.current) return
      pdfPage.current = page
      const div = textRef.current
      div.replaceChildren()
      const tl = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent(),
        container: div,
        viewport: page.getViewport({ scale }),
      })
      try {
        await tl.render()
      } catch {
        return
      }
      if (cancelled) return
      textLayer.current = tl
      setTextReady((n) => n + 1)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, source, index])

  useEffect(() => {
    if (textLayer.current && pdfPage.current) textLayer.current.update({ viewport: pdfPage.current.getViewport({ scale }) })
  }, [scale])

  const rulesKey = JSON.stringify(rules.map((r) => [r.id, r.enabled, r.color, r.sizeCount, r.sizeIndex, r.term, r.caseSensitive]))
  useLayoutEffect(() => {
    if (!textReady || !textRef.current || !pageRef.current) return
    const raf = requestAnimationFrame(() => {
      const res = computeSmartRects(textRef.current!, pageRef.current!, scale, rules)
      setSmart(res)
      props.onSmartRects(index, res)
    })
    return () => cancelAnimationFrame(raf)
    // Rects are in page units, so they only need recomputing when rules or text change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textReady, rulesKey])

  const toPage = (clientX: number, clientY: number) => {
    const r = pageRef.current!.getBoundingClientRect()
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale }
  }

  const charts = markup.charts.filter((c) => c.page === index)
  const activeChart = charts.find((c) => c.id === activeChartId)
  const rowBar = markup.rowBar?.page === index ? markup.rowBar : null
  const handleR = 9 / scale

  const startDrag = (d: Drag, e: RPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (multiTouch) return
    const pointerId = e.pointerId
    dragRef.current = d
    setDrag(d)
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      const cur = dragRef.current
      if (!cur) return
      const p = toPage(ev.clientX, ev.clientY)
      let next: Drag = cur
      switch (cur.kind) {
        case 'stroke': {
          const n = cur.points.length
          const minDist = 1.5 / scale
          if (Math.hypot(p.x - cur.points[n - 2], p.y - cur.points[n - 1]) < minDist) return
          next = { ...cur, points: [...cur.points, p.x, p.y] }
          break
        }
        case 'rect':
          next = { ...cur, x1: p.x, y1: p.y }
          break
        case 'rowbar':
          onAction({ type: 'rowbar', page: index, y: p.y - cur.offset })
          return
        case 'chart-resize': {
          const r = cur.chart.rect
          let x0 = r.x
          let y0 = r.y
          let x1 = r.x + r.w
          let y1 = r.y + r.h
          if (cur.corner === 0 || cur.corner === 3) x0 = p.x
          else x1 = p.x
          if (cur.corner === 0 || cur.corner === 1) y0 = p.y
          else y1 = p.y
          next = { ...cur, rect: normRect(x0, y0, x1, y1) }
          break
        }
        case 'chart-move': {
          const moved = cur.moved || Math.hypot(p.x - cur.x0, p.y - cur.y0) > 4 / scale
          next = { ...cur, moved, rect: { ...cur.chart.rect, x: p.x - cur.dx, y: p.y - cur.dy } }
          break
        }
        case 'erase':
          onAction({ type: 'erase', page: index, x: p.x, y: p.y })
          return
        case 'tap':
          return
      }
      dragRef.current = next
      setDrag(next)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (cancelActiveDrag === cancel) cancelActiveDrag = null
    }
    const cancel = () => {
      cleanup()
      dragRef.current = null
      setDrag(null)
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      cleanup()
      const cur = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!cur || ev.type === 'pointercancel') return
      const p = toPage(ev.clientX, ev.clientY)
      switch (cur.kind) {
        case 'stroke':
          if (cur.points.length >= 2) onAction({ type: 'stroke', page: index, points: cur.points })
          break
        case 'rect': {
          const r = normRect(cur.x0, cur.y0, cur.x1, cur.y1)
          if (r.w > 4 / scale && r.h > 4 / scale) onAction({ type: 'rect', tool: cur.tool, page: index, rect: r })
          break
        }
        case 'chart-resize':
          onAction({ type: 'chart-rect', chartId: cur.chart.id, rect: cur.rect })
          break
        case 'chart-move':
          if (cur.moved) onAction({ type: 'chart-rect', chartId: cur.chart.id, rect: cur.rect })
          else {
            const cell = cellAt(cur.chart, p.x, p.y)
            if (cell) onAction({ type: 'chart-cell', chartId: cur.chart.id, ...cell })
          }
          break
        case 'tap':
          if (Math.hypot(p.x - cur.x, p.y - cur.y) < 8 / scale) onAction({ type: 'tap', tool, page: index, x: p.x, y: p.y })
          break
      }
    }
    cancelActiveDrag?.()
    cancelActiveDrag = cancel
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const onPointerDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (tool === 'pan' || e.button > 0 || multiTouch) return
    const p = toPage(e.clientX, e.clientY)
    switch (tool) {
      case 'pen':
      case 'marker':
        return startDrag({ kind: 'stroke', points: [p.x, p.y] }, e)
      case 'highlight':
      case 'bookmark':
        return startDrag({ kind: 'rect', x0: p.x, y0: p.y, x1: p.x, y1: p.y, tool }, e)
      case 'chart': {
        if (activeChart) {
          const r = activeChart.rect
          const corners = [
            [r.x, r.y],
            [r.x + r.w, r.y],
            [r.x + r.w, r.y + r.h],
            [r.x, r.y + r.h],
          ]
          const ci = corners.findIndex(([cx, cy]) => Math.hypot(cx - p.x, cy - p.y) < handleR * 2.2)
          if (ci >= 0) return startDrag({ kind: 'chart-resize', chart: activeChart, corner: ci, rect: r }, e)
          if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
            return startDrag(
              { kind: 'chart-move', chart: activeChart, dx: p.x - r.x, dy: p.y - r.y, rect: r, moved: false, x0: p.x, y0: p.y },
              e,
            )
          }
        }
        const other = charts.find((c) => p.x >= c.rect.x && p.x <= c.rect.x + c.rect.w && p.y >= c.rect.y && p.y <= c.rect.y + c.rect.h)
        if (other) return onAction({ type: 'tap', tool, page: index, x: p.x, y: p.y })
        return startDrag({ kind: 'rect', x0: p.x, y0: p.y, x1: p.x, y1: p.y, tool: 'chart' }, e)
      }
      case 'rowbar': {
        if (rowBar && p.y >= rowBar.y && p.y <= rowBar.y + rowBar.h) return startDrag({ kind: 'rowbar', offset: p.y - rowBar.y }, e)
        const hh = markup.rowBar?.h ?? 16
        onAction({ type: 'rowbar', page: index, y: p.y - hh / 2 })
        return startDrag({ kind: 'rowbar', offset: hh / 2 }, e)
      }
      case 'eraser':
        onAction({ type: 'erase', page: index, x: p.x, y: p.y })
        return startDrag({ kind: 'erase' }, e)
      case 'note':
        return startDrag({ kind: 'tap', x: p.x, y: p.y }, e)
    }
  }

  const strokes = markup.strokes.filter((s) => s.page === index)
  const highlights = markup.highlights.filter((s) => s.page === index)
  const notes = markup.notes.filter((n) => n.page === index)
  const bookmarks = markup.bookmarks.filter((b) => b.page === index)

  const pageStyle = {
    width: w,
    height: h,
    '--scale-factor': scale,
    '--total-scale-factor': scale,
    '--scale-round-x': '1px',
    '--scale-round-y': '1px',
  } as CSSProperties

  const liveRect = (c: Chart) => (drag && (drag.kind === 'chart-resize' || drag.kind === 'chart-move') && drag.chart.id === c.id ? drag.rect : c.rect)

  return (
    <div className="page" ref={pageRef} style={pageStyle} data-page={index}>
      <canvas ref={canvasRef} className="page-canvas" />
      {!active && <div className="page-placeholder">Page {index + 1}</div>}
      <div ref={textRef} className="textLayer" />

      {/* Highlighter layer: multiplied onto the page like a real highlighter. */}
      <svg className="layer hl-layer" viewBox={`0 0 ${size.w} ${size.h}`} width={w} height={h}>
        {smart.map((s) =>
          s.rects.map((r, i) => <rect key={`${s.ruleId}${i}`} x={r.x} y={r.y} width={r.w} height={r.h} rx={1.5} fill={s.color} opacity={0.55} />),
        )}
        {highlights.map((hl) =>
          hl.rects.map((r, i) => <rect key={`${hl.id}${i}`} x={r.x} y={r.y} width={r.w} height={r.h} rx={1.5} fill={hl.color} opacity={0.5} />),
        )}
        {strokes
          .filter((s) => s.opacity < 1)
          .map((s) => (
            <path key={s.id} d={pointsToPath(s.points)} stroke={s.color} strokeWidth={s.width} opacity={s.opacity} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        {charts.map((c) => {
          const pos = chartRows[c.id] ?? { row: c.row, stitch: c.stitch }
          const live = { ...c, rect: liveRect(c) }
          const band = rowBand(live, pos.row)
          return <rect key={c.id} x={band.x} y={band.y} width={band.w} height={band.h} fill={c.color} opacity={0.28} />
        })}
        {rowBar && <rect x={0} y={rowBar.y} width={size.w} height={rowBar.h} fill={rowBar.color} opacity={0.4} />}
        {drag?.kind === 'stroke' && tool === 'marker' && (
          <path d={pointsToPath(drag.points)} stroke={color} strokeWidth={penWidth} opacity={0.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {drag?.kind === 'rect' && drag.tool === 'highlight' && (
          <rect {...rectProps(normRect(drag.x0, drag.y0, drag.x1, drag.y1))} fill={color} opacity={0.45} />
        )}
      </svg>

      {/* Ink layer: pen, chart guides, row bar mask, editing handles. Captures input for tools. */}
      <svg
        className={`layer ink-layer ${tool !== 'pan' ? 'capture' : ''} tool-${tool}`}
        viewBox={`0 0 ${size.w} ${size.h}`}
        width={w}
        height={h}
        onPointerDown={onPointerDown}
      >
        {rowBar?.mask && (
          <path
            d={`M0 0H${size.w}V${size.h}H0Z M0 ${rowBar.y}V${rowBar.y + rowBar.h}H${size.w}V${rowBar.y}Z`}
            fillRule="evenodd"
            fill="rgba(245,246,250,0.72)"
          />
        )}
        {strokes
          .filter((s) => s.opacity >= 1)
          .map((s) => (
            <path key={s.id} d={pointsToPath(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        {charts.map((c) => (
          <ChartOverlay
            key={c.id}
            chart={{ ...c, rect: liveRect(c) }}
            pos={chartRows[c.id] ?? { row: c.row, stitch: c.stitch }}
            active={c.id === activeChartId}
            editing={tool === 'chart' && c.id === activeChartId}
            handleR={handleR}
            scale={scale}
            onTapCell={
              tool === 'pan'
                ? (x, y) => {
                    const cell = cellAt(c, x, y)
                    if (cell) onAction({ type: 'chart-cell', chartId: c.id, ...cell })
                  }
                : undefined
            }
            toPage={toPage}
          />
        ))}
        {rowBar && (
          <g className="rowbar">
            <line x1={0} x2={size.w} y1={rowBar.y} y2={rowBar.y} stroke={rowBar.color} strokeWidth={1.4 / scale} />
            <line x1={0} x2={size.w} y1={rowBar.y + rowBar.h} y2={rowBar.y + rowBar.h} stroke={rowBar.color} strokeWidth={1.4 / scale} />
            <g
              className="rowbar-handle"
              onPointerDown={(e) => {
                const p = toPage(e.clientX, e.clientY)
                startDrag({ kind: 'rowbar', offset: p.y - rowBar.y }, e)
              }}
            >
              <rect x={size.w - 26 / scale} y={rowBar.y + rowBar.h / 2 - 13 / scale} width={24 / scale} height={26 / scale} rx={6 / scale} fill={rowBar.color} />
              <path
                d={`M${size.w - 19 / scale} ${rowBar.y + rowBar.h / 2 - 4 / scale}h${10 / scale}M${size.w - 19 / scale} ${rowBar.y + rowBar.h / 2}h${10 / scale}M${size.w - 19 / scale} ${rowBar.y + rowBar.h / 2 + 4 / scale}h${10 / scale}`}
                stroke="#fff"
                strokeWidth={1.6 / scale}
                strokeLinecap="round"
              />
            </g>
          </g>
        )}
        {tool === 'bookmark' &&
          bookmarks.map((b) => (
            <g key={b.id}>
              <rect {...rectProps(b.rect)} fill="none" stroke="#29a3f5" strokeDasharray={`${4 / scale} ${3 / scale}`} strokeWidth={1.5 / scale} />
              <text x={b.rect.x + 2 / scale} y={b.rect.y - 3 / scale} fontSize={11 / scale} fill="#1677c9" fontWeight={600}>
                {b.label}
              </text>
            </g>
          ))}
        {drag?.kind === 'stroke' && tool === 'pen' && (
          <path d={pointsToPath(drag.points)} stroke={color} strokeWidth={penWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {drag?.kind === 'rect' && drag.tool !== 'highlight' && (
          <rect
            {...rectProps(normRect(drag.x0, drag.y0, drag.x1, drag.y1))}
            fill={drag.tool === 'chart' ? 'rgba(41,163,245,0.08)' : 'rgba(41,163,245,0.06)'}
            stroke="#29a3f5"
            strokeDasharray={`${5 / scale} ${3 / scale}`}
            strokeWidth={1.5 / scale}
          />
        )}
      </svg>

      <div className="pins">
        {notes.map((n) => (
          <button
            key={n.id}
            className={`pin ${n.x > size.w * 0.6 ? 'pin-left' : ''}`}
            style={{ left: n.x * scale, top: n.y * scale, '--pin': n.color } as CSSProperties}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              if (tool === 'eraser') onAction({ type: 'erase', page: index, x: n.x, y: n.y })
              else onAction({ type: 'note-open', id: n.id })
            }}
            aria-label={`Note: ${n.text}`}
          >
            <span className="pin-dot" />
            {markup.showNoteLabels !== false && n.text && <span className="pin-label">{n.text}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function rectProps(r: Rect) {
  return { x: r.x, y: r.y, width: r.w, height: r.h }
}

function ChartOverlay({
  chart,
  pos,
  active,
  editing,
  handleR,
  scale,
  onTapCell,
  toPage,
}: {
  chart: Chart
  pos: { row: number; stitch: number }
  active: boolean
  editing: boolean
  handleR: number
  scale: number
  onTapCell?: (x: number, y: number) => void
  toPage: (x: number, y: number) => { x: number; y: number }
}) {
  const { rect, rows, cols } = chart
  const cw = rect.w / cols
  const ch = rect.h / rows
  const band = rowBand(chart, pos.row)
  const sw = 1 / scale
  const parts: ReactNode[] = []

  if (chart.shadeDone && pos.row > 1) {
    // Rows already worked (below the current row on a bottom-up chart).
    const first = rowBand(chart, 1)
    const prev = rowBand(chart, pos.row - 1)
    const y = Math.min(first.y, prev.y)
    const yEnd = Math.max(first.y + first.h, prev.y + prev.h)
    parts.push(<rect key="done" x={rect.x} y={y} width={rect.w} height={yEnd - y} fill="rgba(60,70,90,0.16)" />)
  }
  if (chart.dimOthers) {
    parts.push(
      <path
        key="dim"
        d={`M${rect.x} ${rect.y}h${rect.w}v${rect.h}h${-rect.w}Z M${band.x} ${band.y}v${band.h}h${band.w}v${-band.h}Z`}
        fillRule="evenodd"
        fill="rgba(255,255,255,0.62)"
      />,
    )
  }
  if (chart.showGrid || editing) {
    let d = ''
    for (let i = 0; i <= cols; i++) d += `M${rect.x + i * cw} ${rect.y}v${rect.h}`
    for (let j = 0; j <= rows; j++) d += `M${rect.x} ${rect.y + j * ch}h${rect.w}`
    parts.push(<path key="grid" d={d} stroke={chart.color} strokeWidth={sw * (editing ? 1 : 0.7)} opacity={editing ? 0.9 : 0.45} fill="none" />)
  }
  parts.push(
    <rect key="band" x={band.x} y={band.y} width={band.w} height={band.h} fill="none" stroke={chart.color} strokeWidth={sw * (active ? 2.4 : 1.4)} />,
  )
  if (chart.mode === 'stitch') {
    const cell = stitchCell(chart, pos.row, pos.stitch)
    // Stitches already worked in this row.
    const startCell = stitchCell(chart, pos.row, 1)
    const doneX1 = Math.min(startCell.x, cell.x)
    const doneX2 = Math.max(startCell.x + startCell.w, cell.x + cell.w)
    parts.push(
      <rect key="done-st" x={doneX1} y={band.y} width={doneX2 - doneX1} height={band.h} fill={chart.color} opacity={0.12} />,
      <rect key="cell" x={cell.x} y={cell.y} width={cell.w} height={cell.h} fill={chart.color} fillOpacity={0.3} stroke={chart.color} strokeWidth={sw * 3} />,
    )
  }
  // Row number tag on the side the row is read from.
  const tagRight = chart.flat ? pos.row % 2 === (chart.firstRowRS ? 1 : 0) : true
  const fs = Math.max(7, Math.min(ch * 0.9, 12 / scale + ch * 0.2))
  parts.push(
    <g key="tag">
      <rect
        x={tagRight ? rect.x + rect.w + 3 / scale : rect.x - 3 / scale - fs * 2.6}
        y={band.y + band.h / 2 - fs * 0.7}
        width={fs * 2.6}
        height={fs * 1.4}
        rx={fs * 0.3}
        fill={chart.color}
      />
      <text
        x={tagRight ? rect.x + rect.w + 3 / scale + fs * 1.3 : rect.x - 3 / scale - fs * 1.3}
        y={band.y + band.h / 2 + fs * 0.35}
        fontSize={fs}
        fill="#fff"
        textAnchor="middle"
        fontWeight={700}
      >
        {pos.row}
      </text>
    </g>,
  )
  if (editing) {
    parts.push(<rect key="outline" {...rectProps(rect)} fill="rgba(41,163,245,0.05)" stroke={chart.color} strokeWidth={sw * 1.5} strokeDasharray={`${5 / scale} ${3 / scale}`} />)
    const corners = [
      [rect.x, rect.y],
      [rect.x + rect.w, rect.y],
      [rect.x + rect.w, rect.y + rect.h],
      [rect.x, rect.y + rect.h],
    ]
    corners.forEach(([x, y], i) => parts.push(<circle key={`h${i}`} cx={x} cy={y} r={handleR} fill="#fff" stroke={chart.color} strokeWidth={sw * 2.5} />))
  }
  return (
    <g className="chart-overlay">
      {parts}
      {onTapCell && (
        <rect
          {...rectProps(rect)}
          fill="transparent"
          className="chart-hit"
          onClick={(e) => {
            const p = toPage(e.clientX, e.clientY)
            onTapCell(p.x, p.y)
          }}
        />
      )}
    </g>
  )
}

export const PageView = memo(PageViewImpl)
