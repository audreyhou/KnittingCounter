import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { ColorDots, Modal, NumberStepper } from '../components/Modal'
import { uid } from '../lib/id'
import type { Bookmark, Chart, Counter, Markup, PinNote, RowBar, SmartRule } from '../types'
import { detectSizeLabels } from './textMatch'
import type { PageSource } from './source'
import { CHART_COLORS, HL_COLORS, PEN_COLORS } from './colors'

export function ChartBar({
  chart,
  charts,
  pos,
  linkedCounter,
  onSelect,
  onStepRow,
  onStepStitch,
  onToggleMode,
  onSettings,
  onClose,
}: {
  chart: Chart
  charts: Chart[]
  pos: { row: number; stitch: number }
  linkedCounter?: Counter
  onSelect: (id: string) => void
  onStepRow: (d: 1 | -1) => void
  onStepStitch: (d: 1 | -1) => void
  onToggleMode: () => void
  onSettings: () => void
  onClose: () => void
}) {
  return (
    <div className="viewer-bar chart-bar" style={{ '--accent': chart.color } as CSSProperties}>
      <div className="bar-group">
        <Icon name="chart" size={18} />
        {charts.length > 1 ? (
          <select value={chart.id} onChange={(e) => onSelect(e.target.value)} aria-label="Active chart">
            {charts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : (
          <b className="bar-title">{chart.name}</b>
        )}
        {linkedCounter && (
          <span className="badge" title={`Follows ${linkedCounter.name}`}>
            <Icon name="link" size={12} /> {linkedCounter.name}
          </span>
        )}
      </div>
      <div className="bar-group">
        <button className="bar-btn" onClick={() => onStepRow(-1)} aria-label="Previous chart row">
          <Icon name="down" size={20} />
        </button>
        <span className="bar-value" data-testid="chart-row">
          Row <b>{pos.row}</b>/{chart.rows}
        </span>
        <button className="bar-btn primary" onClick={() => onStepRow(1)} aria-label="Next chart row">
          <Icon name="up" size={20} />
        </button>
      </div>
      {chart.mode === 'stitch' && (
        <div className="bar-group">
          <button className="bar-btn" onClick={() => onStepStitch(-1)} aria-label="Previous stitch">
            <Icon name="left" size={20} />
          </button>
          <span className="bar-value" data-testid="chart-stitch">
            St <b>{pos.stitch}</b>/{chart.cols}
          </span>
          <button className="bar-btn primary" onClick={() => onStepStitch(1)} aria-label="Next stitch">
            <Icon name="right" size={20} />
          </button>
        </div>
      )}
      <div className="bar-group">
        <button className={`bar-btn ${chart.mode === 'stitch' ? 'on' : ''}`} onClick={onToggleMode} title="Follow stitch by stitch">
          <Icon name="stitch" size={18} />
        </button>
        <button className="bar-btn" onClick={onSettings} aria-label="Chart settings">
          <Icon name="settings" size={18} />
        </button>
        <button className="bar-btn" onClick={onClose} aria-label="Hide chart tracker">
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  )
}

export function ChartSettings({
  chart,
  counters,
  onChange,
  onDelete,
  onClose,
}: {
  chart: Chart
  counters?: Counter[]
  onChange: (c: Chart) => void
  onDelete: () => void
  onClose: () => void
}) {
  const set = (patch: Partial<Chart>) => {
    const next = { ...chart, ...patch }
    next.row = Math.min(Math.max(1, next.row), next.rows)
    next.stitch = Math.min(Math.max(1, next.stitch), next.cols)
    onChange(next)
  }
  const nudge = (edge: 'l' | 'r' | 't' | 'b', d: number) => {
    const r = { ...chart.rect }
    if (edge === 'l') {
      r.x += d
      r.w -= d
    } else if (edge === 'r') r.w += d
    else if (edge === 't') {
      r.y += d
      r.h -= d
    } else r.h += d
    if (r.w > 2 && r.h > 2) set({ rect: r })
  }
  const step = Math.max(0.25, Math.min(chart.rect.w / chart.cols, chart.rect.h / chart.rows) / 8)
  return (
    <Modal
      title="Chart settings"
      onClose={onClose}
      footer={
        <>
          <button className="btn danger ghost" onClick={onDelete}>
            <Icon name="trash" size={18} /> Delete chart
          </button>
          <span className="spacer" />
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <label className="field">
        <span>Name</span>
        <input value={chart.name} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Rows</span>
          <NumberStepper value={chart.rows} min={1} max={500} onChange={(rows) => set({ rows })} label="rows" />
        </label>
        <label className="field">
          <span>Stitches (columns)</span>
          <NumberStepper value={chart.cols} min={1} max={500} onChange={(cols) => set({ cols })} label="stitches" />
        </label>
      </div>
      <p className="hint">Match the grid to the chart squares, then fine-tune the edges below or drag the corner handles with the chart tool.</p>
      <div className="nudge-grid">
        {(
          [
            ['l', 'Left edge'],
            ['r', 'Right edge'],
            ['t', 'Top edge'],
            ['b', 'Bottom edge'],
          ] as const
        ).map(([edge, label]) => (
          <div key={edge} className="nudge">
            <span>{label}</span>
            <button className="icon-btn" aria-label={`${label} ${edge === 't' || edge === 'b' ? 'up' : 'left'}`} onClick={() => nudge(edge, -step)}>
              <Icon name={edge === 't' || edge === 'b' ? 'up' : 'left'} size={18} />
            </button>
            <button className="icon-btn" aria-label={`${label} ${edge === 't' || edge === 'b' ? 'down' : 'right'}`} onClick={() => nudge(edge, step)}>
              <Icon name={edge === 't' || edge === 'b' ? 'down' : 'right'} size={18} />
            </button>
          </div>
        ))}
      </div>
      <div className="field-row">
        <label className="field">
          <span>Current row</span>
          <NumberStepper value={chart.row} min={1} max={chart.rows} onChange={(row) => set({ row })} label="current row" />
        </label>
        <label className="field">
          <span>Current stitch</span>
          <NumberStepper value={chart.stitch} min={1} max={chart.cols} onChange={(stitch) => set({ stitch })} label="current stitch" />
        </label>
      </div>
      <div className="segmented">
        <button className={chart.mode === 'row' ? 'on' : ''} onClick={() => set({ mode: 'row' })}>
          Row by row
        </button>
        <button className={chart.mode === 'stitch' ? 'on' : ''} onClick={() => set({ mode: 'stitch' })}>
          Stitch by stitch
        </button>
      </div>
      <label className="switch-field">
        <input type="checkbox" checked={chart.bottomUp} onChange={(e) => set({ bottomUp: e.target.checked })} />
        <span>
          <b>Row 1 at the bottom</b>
          <small>Most knitting charts are read from the bottom up.</small>
        </span>
      </label>
      <label className="switch-field">
        <input type="checkbox" checked={chart.flat} onChange={(e) => set({ flat: e.target.checked })} />
        <span>
          <b>Worked flat</b>
          <small>RS rows read right→left, WS rows left→right. Turn off for knitting in the round (or crochet in rounds).</small>
        </span>
      </label>
      {chart.flat && (
        <label className="switch-field">
          <input type="checkbox" checked={chart.firstRowRS} onChange={(e) => set({ firstRowRS: e.target.checked })} />
          <span>
            <b>Row 1 is a right-side row</b>
          </span>
        </label>
      )}
      <label className="switch-field">
        <input type="checkbox" checked={chart.showGrid} onChange={(e) => set({ showGrid: e.target.checked })} />
        <span>
          <b>Show grid</b>
        </span>
      </label>
      <label className="switch-field">
        <input type="checkbox" checked={chart.dimOthers} onChange={(e) => set({ dimOthers: e.target.checked })} />
        <span>
          <b>Fade other rows</b>
          <small>Focus on the row you are working.</small>
        </span>
      </label>
      <label className="switch-field">
        <input type="checkbox" checked={chart.shadeDone} onChange={(e) => set({ shadeDone: e.target.checked })} />
        <span>
          <b>Shade finished rows</b>
        </span>
      </label>
      <div className="field">
        <span>Color</span>
        <ColorDots colors={CHART_COLORS} value={chart.color} onChange={(color) => set({ color })} />
      </div>
      {counters && counters.length > 0 && (
        <div className="field-row">
          <label className="field">
            <span>Follow counter</span>
            <select value={chart.linkCounterId ?? ''} onChange={(e) => set({ linkCounterId: e.target.value || undefined })}>
              <option value="">Not linked</option>
              {counters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {chart.linkCounterId && (
            <label className="field">
              <span>Row offset</span>
              <NumberStepper value={chart.rowOffset} min={-999} onChange={(rowOffset) => set({ rowOffset })} label="row offset" />
            </label>
          )}
        </div>
      )}
      {chart.linkCounterId && <p className="hint">The chart row follows the counter and repeats every {chart.rows} rows.</p>}
    </Modal>
  )
}

export function RowBarBar({
  bar,
  hasLines,
  onStep,
  onChange,
  onClose,
}: {
  bar: RowBar
  hasLines: boolean
  onStep: (d: 1 | -1) => void
  onChange: (b: RowBar) => void
  onClose: () => void
}) {
  return (
    <div className="viewer-bar rowbar-bar">
      <div className="bar-group">
        <Icon name="rowbar" size={18} />
        <button className="bar-btn" onClick={() => onStep(-1)} aria-label="Row bar up">
          <Icon name="up" size={20} />
        </button>
        <button className="bar-btn primary" onClick={() => onStep(1)} aria-label="Row bar down">
          <Icon name="down" size={20} />
        </button>
      </div>
      <div className="bar-group">
        <button className="bar-btn" onClick={() => onChange({ ...bar, h: Math.max(4, bar.h * 0.85) })} aria-label="Thinner bar">
          <Icon name="minus" size={16} />
        </button>
        <span className="bar-label">Size</span>
        <button className="bar-btn" onClick={() => onChange({ ...bar, h: bar.h * 1.18 })} aria-label="Thicker bar">
          <Icon name="plus" size={16} />
        </button>
      </div>
      <div className="bar-group">
        <button className={`bar-btn ${bar.mask ? 'on' : ''}`} onClick={() => onChange({ ...bar, mask: !bar.mask })} title="Fade everything else">
          <Icon name="eye" size={18} />
        </button>
        {hasLines && (
          <button className={`bar-btn ${bar.snap ? 'on' : ''}`} onClick={() => onChange({ ...bar, snap: !bar.snap })} title="Snap to text lines">
            <Icon name="list" size={18} />
          </button>
        )}
        <button
          className="bar-btn"
          onClick={() => onChange({ ...bar, color: HL_COLORS[(HL_COLORS.indexOf(bar.color) + 1) % 4] })}
          title="Change color"
          aria-label="Change row bar color"
        >
          <span className="swatch round" style={{ background: bar.color }} />
        </button>
        <button className="bar-btn" onClick={onClose} aria-label="Remove row bar">
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  )
}

export function SmartPanel({
  markup,
  source,
  onRules,
  onClose,
}: {
  markup: Markup
  source: PageSource
  onRules: (rules: SmartRule[]) => void
  onClose: () => void
}) {
  const sizeRule = markup.rules.find((r) => r.type === 'size')
  const terms = markup.rules.filter((r) => r.type === 'term')
  const [labels, setLabels] = useState<string[] | null | undefined>(sizeRule?.sizeLabels)
  const [term, setTerm] = useState('')
  const [termColor, setTermColor] = useState(HL_COLORS[1])
  const [manualCount, setManualCount] = useState(sizeRule?.sizeCount ?? 5)

  useEffect(() => {
    if (labels !== undefined || source.kind !== 'pdf') return
    let alive = true
    void (async () => {
      let found: string[] | null = null
      for (let i = 0; i < source.sizes.length && i < 8 && !found; i++) found = detectSizeLabels(await source.pageText(i))
      if (alive) setLabels(found)
    })()
    return () => {
      alive = false
    }
  }, [labels, source])

  const setSize = (index: number, count: number, lbls?: string[]) => {
    const rule: SmartRule = {
      id: sizeRule?.id ?? uid(),
      type: 'size',
      color: sizeRule?.color ?? HL_COLORS[0],
      enabled: true,
      sizeCount: count,
      sizeIndex: index,
      sizeLabels: lbls,
    }
    onRules([rule, ...terms])
  }
  const patchSize = (patch: Partial<SmartRule>) => sizeRule && onRules([{ ...sizeRule, ...patch }, ...terms])

  return (
    <Modal title="Smart highlights" onClose={onClose}>
      {source.kind !== 'pdf' && (
        <p className="hint">
          <Icon name="info" size={16} /> Smart highlights need a PDF with text. For photos and scans, use the highlighter tool to mark areas by hand.
        </p>
      )}
      <h3 className="section-title">Highlight my size</h3>
      <p className="hint">Finds every “31 (33) 35 (37)…” number group in the pattern and highlights the number for your size.</p>
      {labels === undefined && source.kind === 'pdf' && <p className="muted">Looking for sizes…</p>}
      {labels && labels.length > 0 ? (
        <div className="chips" role="radiogroup" aria-label="Size">
          {labels.map((l, i) => (
            <button
              key={`${l}${i}`}
              role="radio"
              aria-checked={sizeRule?.enabled && sizeRule.sizeIndex === i}
              className={`chip ${sizeRule?.enabled && sizeRule.sizeIndex === i ? 'on' : ''}`}
              onClick={() => setSize(i, labels.length, labels)}
            >
              {l}
            </button>
          ))}
        </div>
      ) : (
        labels === null && (
          <div className="field-row">
            <label className="field">
              <span>Number of sizes</span>
              <NumberStepper value={manualCount} min={2} max={12} onChange={setManualCount} label="number of sizes" />
            </label>
            <label className="field">
              <span>My size is number</span>
              <NumberStepper
                value={(sizeRule?.sizeIndex ?? -1) + 1}
                min={1}
                max={manualCount}
                onChange={(n) => setSize(n - 1, manualCount)}
                label="my size"
              />
            </label>
          </div>
        )
      )}
      {sizeRule && (
        <div className="field-row align-center">
          <ColorDots colors={HL_COLORS} value={sizeRule.color} onChange={(color) => patchSize({ color })} />
          <label className="inline-check">
            <input type="checkbox" checked={sizeRule.enabled} onChange={(e) => patchSize({ enabled: e.target.checked })} /> Show
          </label>
        </div>
      )}

      <h3 className="section-title">Highlight words</h3>
      <p className="hint">Highlight every place a stitch, marker or word appears, e.g. “M1L”, “MM2” or “ssk”.</p>
      <form
        className="field-row align-center"
        onSubmit={(e) => {
          e.preventDefault()
          if (!term.trim()) return
          onRules([...markup.rules, { id: uid(), type: 'term', term: term.trim(), color: termColor, enabled: true }])
          setTerm('')
        }}
      >
        <input className="grow" value={term} placeholder="Word or abbreviation" onChange={(e) => setTerm(e.target.value)} aria-label="Word to highlight" />
        <button className="btn primary" type="submit" disabled={!term.trim()}>
          Add
        </button>
      </form>
      <ColorDots colors={HL_COLORS} value={termColor} onChange={setTermColor} />
      {terms.length > 0 && (
        <ul className="plain-list">
          {terms.map((t) => (
            <li key={t.id}>
              <span className="swatch" style={{ background: t.color }} />
              <span className="grow">{t.term}</span>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={t.enabled}
                  onChange={(e) => onRules(markup.rules.map((r) => (r.id === t.id ? { ...r, enabled: e.target.checked } : r)))}
                />{' '}
                Show
              </label>
              <button className="icon-btn" aria-label={`Remove ${t.term}`} onClick={() => onRules(markup.rules.filter((r) => r.id !== t.id))}>
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

export function BookmarkDock({
  bookmarks,
  size,
  collapsed,
  onToggle,
  onSize,
  onOpen,
}: {
  bookmarks: Bookmark[]
  size: number
  collapsed: boolean
  onToggle: () => void
  onSize: () => void
  onOpen: (b: Bookmark) => void
}) {
  const pinned = bookmarks.filter((b) => b.pinned)
  if (!pinned.length) return null
  return (
    <div className={`dock ${collapsed ? 'collapsed' : ''}`}>
      <div className="dock-head">
        <button className="dock-toggle" onClick={onToggle} aria-expanded={!collapsed}>
          <Icon name="pin" size={15} /> Pinned ({pinned.length}) <Icon name={collapsed ? 'down' : 'up'} size={15} />
        </button>
        {!collapsed && (
          <button className="dock-toggle" onClick={onSize} aria-label="Change pinned size">
            <Icon name="fit" size={15} />
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="dock-items">
          {pinned.map((b) => (
            <button key={b.id} className="dock-item" onClick={() => onOpen(b)} title={b.label}>
              <img src={b.image} alt={b.label} style={{ height: size - 30 }} />
              <span>{b.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function BookmarkModal({
  bookmark,
  onChange,
  onDelete,
  onGo,
  onClose,
}: {
  bookmark: Bookmark
  onChange: (b: Bookmark) => void
  onDelete: () => void
  onGo: () => void
  onClose: () => void
}) {
  return (
    <Modal
      wide
      title={
        <input className="title-input" value={bookmark.label} onChange={(e) => onChange({ ...bookmark, label: e.target.value })} aria-label="Bookmark name" />
      }
      onClose={onClose}
      footer={
        <>
          <button className="btn danger ghost" onClick={onDelete}>
            <Icon name="trash" size={18} /> Delete
          </button>
          <span className="spacer" />
          <button className="btn" onClick={() => onChange({ ...bookmark, pinned: !bookmark.pinned })}>
            <Icon name="pin" size={18} /> {bookmark.pinned ? 'Unpin' : 'Pin on screen'}
          </button>
          <button className="btn primary" onClick={onGo}>
            Go to page {bookmark.page + 1}
          </button>
        </>
      }
    >
      <img className="bookmark-full" src={bookmark.image} alt={bookmark.label} />
    </Modal>
  )
}

export function PinNoteModal({
  note,
  onSave,
  onDelete,
  onClose,
}: {
  note: PinNote
  onSave: (n: PinNote) => void
  onDelete: () => void
  onClose: () => void
}) {
  const [n, setN] = useState(note)
  return (
    <Modal
      title="Note"
      onClose={onClose}
      footer={
        <>
          <button className="btn danger ghost" onClick={onDelete}>
            <Icon name="trash" size={18} /> Delete
          </button>
          <span className="spacer" />
          <button className="btn primary" onClick={() => onSave(n)}>
            Save
          </button>
        </>
      }
    >
      <textarea
        rows={4}
        autoFocus
        value={n.text}
        onChange={(e) => setN({ ...n, text: e.target.value })}
        placeholder="e.g. Knit 2 extra rows here for length"
        aria-label="Note text"
      />
      <div className="field">
        <span>Color</span>
        <ColorDots colors={PEN_COLORS} value={n.color} onChange={(color) => setN({ ...n, color })} />
      </div>
    </Modal>
  )
}

export function MarkupSheet({
  markup,
  onGo,
  onOpenBookmark,
  onOpenChart,
  onOpenNote,
  onToggleLabels,
  onDeleteHighlight,
  onClose,
}: {
  markup: Markup
  onGo: (page: number, y?: number) => void
  onOpenBookmark: (b: Bookmark) => void
  onOpenChart: (c: Chart) => void
  onOpenNote: (n: PinNote) => void
  onToggleLabels: () => void
  onDeleteHighlight: (id: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'bookmarks' | 'charts' | 'notes' | 'highlights'>('bookmarks')
  return (
    <Modal title="Pattern markup" onClose={onClose}>
      <div className="segmented small">
        {(['bookmarks', 'charts', 'notes', 'highlights'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'bookmarks' && (
        <ListOrEmpty empty="Use the bookmark tool and drag over sizes, abbreviations or anything you want to keep on screen.">
          {markup.bookmarks.map((b) => (
            <li key={b.id}>
              <button className="list-btn" onClick={() => onOpenBookmark(b)}>
                <img src={b.image} alt="" className="list-thumb" />
                <span className="grow">
                  {b.label}
                  <small className="muted"> · page {b.page + 1}</small>
                </span>
                {b.pinned && <Icon name="pin" size={16} />}
              </button>
            </li>
          ))}
        </ListOrEmpty>
      )}
      {tab === 'charts' && (
        <ListOrEmpty empty="Use the chart tool and drag a box around the chart squares to start tracking it.">
          {markup.charts.map((c) => (
            <li key={c.id}>
              <button className="list-btn" onClick={() => onOpenChart(c)}>
                <span className="swatch" style={{ background: c.color }} />
                <span className="grow">
                  {c.name}
                  <small className="muted">
                    {' '}
                    · {c.rows}×{c.cols} · page {c.page + 1}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ListOrEmpty>
      )}
      {tab === 'notes' && (
        <>
          <label className="inline-check">
            <input type="checkbox" checked={markup.showNoteLabels !== false} onChange={onToggleLabels} /> Show note text on the pattern
          </label>
          <ListOrEmpty empty="Use the note tool and tap the pattern to add a note.">
            {markup.notes.map((n) => (
              <li key={n.id}>
                <button className="list-btn" onClick={() => onOpenNote(n)}>
                  <span className="swatch" style={{ background: n.color }} />
                  <span className="grow">
                    {n.text || '(empty)'}
                    <small className="muted"> · page {n.page + 1}</small>
                  </span>
                </button>
              </li>
            ))}
          </ListOrEmpty>
        </>
      )}
      {tab === 'highlights' && (
        <ListOrEmpty empty="Select text or use the highlighter tool to mark important instructions.">
          {markup.highlights.map((h) => (
            <li key={h.id}>
              <button className="list-btn" onClick={() => onGo(h.page, h.rects[0]?.y)}>
                <span className="swatch" style={{ background: h.color }} />
                <span className="grow">
                  {h.text || 'Area highlight'}
                  <small className="muted"> · page {h.page + 1}</small>
                </span>
              </button>
              <button className="icon-btn" aria-label="Delete highlight" onClick={() => onDeleteHighlight(h.id)}>
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ListOrEmpty>
      )}
    </Modal>
  )
}

function ListOrEmpty({ children, empty }: { children: ReactNode[]; empty: string }) {
  if (!children.length) return <p className="muted empty-text">{empty}</p>
  return <ul className="plain-list">{children}</ul>
}
