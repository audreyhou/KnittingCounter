import { useState, type CSSProperties } from 'react'
import { COUNTER_COLORS, counterProgress, describeNoteRows, nextOccurrence, resetCounter } from '../lib/counters'
import { uid } from '../lib/id'
import type { Counter, NoteKind, Project, RowNote } from '../types'
import { Icon } from './Icon'
import { ColorDots, Modal, NumberStepper } from './Modal'
import { ProgressRing } from './ProgressRing'

function buzz(ms = 12) {
  if ('vibrate' in navigator) navigator.vibrate(ms)
}

export function MainCounter({
  counter,
  onStep,
  onEdit,
}: {
  counter: Counter
  onStep: (d: 1 | -1) => void
  onEdit: () => void
}) {
  const step = (d: 1 | -1) => {
    buzz()
    onStep(d)
  }
  return (
    <section className="card main-counter" aria-label={`${counter.name} counter`}>
      <button className="counter-title" onClick={onEdit}>
        {counter.name}
        <Icon name="edit" size={14} />
      </button>
      <div className="main-counter-row">
        <button className="round-btn" aria-label={`${counter.name} minus one`} onClick={() => step(-1)}>
          <Icon name="minus" size={30} />
        </button>
        <button className="ring-btn" aria-label={`${counter.name} plus one`} onClick={() => step(1)}>
          <ProgressRing
            progress={counter.max ? counterProgress(counter) : 0}
            size={176}
            stroke={14}
            color={counter.color}
          >
            <span className="big-value" data-testid="main-value">
              {counter.value}
            </span>
            {counter.max ? (
              <span className="ring-sub">of {counter.max}</span>
            ) : (
              <span className="ring-sub">tap to count</span>
            )}
            {counter.wrap && counter.cycles > 0 && <span className="ring-sub">repeat {counter.cycles + 1}</span>}
          </ProgressRing>
        </button>
        <button className="round-btn primary" aria-label={`${counter.name} plus one`} onClick={() => step(1)}>
          <Icon name="plus" size={30} />
        </button>
      </div>
    </section>
  )
}

export function CounterCard({
  counter,
  onStep,
  onEdit,
  onToggleLink,
}: {
  counter: Counter
  onStep: (d: 1 | -1) => void
  onEdit: () => void
  onToggleLink: () => void
}) {
  const step = (d: 1 | -1) => {
    buzz()
    onStep(d)
  }
  return (
    <section className="card mini-counter" style={{ '--accent': counter.color } as CSSProperties}>
      <button className="counter-title small" onClick={onEdit}>
        {counter.name}
      </button>
      <div className="mini-row">
        <button className="mini-btn" aria-label={`${counter.name} minus one`} onClick={() => step(-1)}>
          <Icon name="minus" size={18} />
        </button>
        <ProgressRing progress={counterProgress(counter)} size={78} stroke={7} color={counter.color}>
          <span className="mid-value">{counter.value}</span>
          {counter.max ? <span className="ring-sub tiny">/{counter.max}</span> : null}
        </ProgressRing>
        <button className="mini-btn" aria-label={`${counter.name} plus one`} onClick={() => step(1)}>
          <Icon name="plus" size={18} />
        </button>
      </div>
      <div className="mini-foot">
        {counter.wrap && counter.max ? (
          <span className="badge" title="Completed repeats">
            <Icon name="repeat" size={12} /> {counter.cycles}
          </span>
        ) : (
          <span />
        )}
        <button
          className={`link-btn ${counter.linked ? 'on' : ''}`}
          onClick={onToggleLink}
          aria-pressed={!!counter.linked}
          title={counter.linked ? 'Linked: moves with the main counter' : 'Not linked'}
          aria-label={`Link ${counter.name} to main counter`}
        >
          <Icon name="link" size={16} />
        </button>
      </div>
    </section>
  )
}

export function CounterEditor({
  counter,
  isMain,
  onSave,
  onDelete,
  onMakeMain,
  onClose,
}: {
  counter: Counter
  isMain: boolean
  onSave: (c: Counter) => void
  onDelete?: () => void
  onMakeMain?: () => void
  onClose: () => void
}) {
  const [c, setC] = useState(counter)
  const set = (patch: Partial<Counter>) => setC((x) => ({ ...x, ...patch }))
  return (
    <Modal
      title={counter.name ? 'Edit counter' : 'New counter'}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <button className="btn danger ghost" onClick={onDelete}>
              <Icon name="trash" size={18} /> Delete
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => onSave({ ...c, name: c.name.trim() || 'Counter' })}
          >
            Save
          </button>
        </>
      }
    >
      <label className="field">
        <span>Name</span>
        <input value={c.name} autoFocus onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Increase rows" />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Current value</span>
          <NumberStepper value={c.value} onChange={(value) => set({ value })} label="value" />
        </label>
        <label className="field">
          <span>Target / repeat length</span>
          <NumberStepper value={c.max ?? 0} onChange={(n) => set({ max: n || undefined })} label="target" />
        </label>
      </div>
      <label className="switch-field">
        <input type="checkbox" checked={!!c.wrap} onChange={(e) => set({ wrap: e.target.checked })} disabled={!c.max} />
        <span>
          <b>Repeat counter</b>
          <small>Starts again at 1 after reaching the target and counts the repeats (e.g. a 4-row pattern repeat).</small>
        </span>
      </label>
      {!isMain && (
        <label className="switch-field">
          <input type="checkbox" checked={!!c.linked} onChange={(e) => set({ linked: e.target.checked })} />
          <span>
            <b>Link to main counter</b>
            <small>Moves forward and back whenever the main row counter does.</small>
          </span>
        </label>
      )}
      <div className="field">
        <span>Color</span>
        <ColorDots colors={COUNTER_COLORS} value={c.color} onChange={(color) => set({ color })} />
      </div>
      <div className="row-actions">
        <button className="btn ghost" onClick={() => setC(resetCounter(c))}>
          <Icon name="reset" size={18} /> Reset to 0
        </button>
        {!isMain && onMakeMain && (
          <button className="btn ghost" onClick={onMakeMain}>
            <Icon name="star" size={18} /> Make main counter
          </button>
        )}
      </div>
    </Modal>
  )
}

export function NoteEditor({
  note,
  project,
  onSave,
  onDelete,
  onClose,
}: {
  note: RowNote | null
  project: Project
  onSave: (n: RowNote) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const main = project.counters.find((c) => c.id === project.mainCounterId)!
  const [n, setN] = useState<RowNote>(
    note ?? {
      id: uid(),
      counterId: main.id,
      kind: 'reminder',
      text: '',
      row: Math.max(1, main.value + 1),
    },
  )
  const set = (patch: Partial<RowNote>) => setN((x) => ({ ...x, ...patch }))
  const repeating = !!n.every
  return (
    <Modal
      title={note ? 'Edit row note' : 'Add reminder or comment'}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <button className="btn danger ghost" onClick={onDelete}>
              <Icon name="trash" size={18} /> Delete
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={!n.text.trim()} onClick={() => onSave({ ...n, text: n.text.trim() })}>
            Save
          </button>
        </>
      }
    >
      <div className="segmented" role="radiogroup">
        {(['reminder', 'comment'] as NoteKind[]).map((k) => (
          <button key={k} role="radio" aria-checked={n.kind === k} className={n.kind === k ? 'on' : ''} onClick={() => set({ kind: k })}>
            <Icon name={k === 'reminder' ? 'bell' : 'comment'} size={16} /> {k === 'reminder' ? 'Reminder' : 'Comment'}
          </button>
        ))}
      </div>
      <p className="hint">
        {n.kind === 'reminder'
          ? 'Reminders pop up when you reach the row.'
          : 'Comments stay visible while you work the row.'}
      </p>
      <label className="field">
        <span>Text</span>
        <textarea
          rows={3}
          autoFocus
          value={n.text}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="e.g. Change color, decrease at both ends, place marker…"
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Counter</span>
          <select value={n.counterId} onChange={(e) => set({ counterId: e.target.value })}>
            {project.counters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Row</span>
          <NumberStepper value={n.row} min={1} onChange={(row) => set({ row })} label="row" />
        </label>
      </div>
      <label className="switch-field">
        <input type="checkbox" checked={repeating} onChange={(e) => set({ every: e.target.checked ? 4 : undefined, until: undefined })} />
        <span>
          <b>Repeat</b>
          <small>Also show it every few rows (e.g. decrease every 6th row).</small>
        </span>
      </label>
      {repeating && (
        <div className="field-row">
          <label className="field">
            <span>Every … rows</span>
            <NumberStepper value={n.every ?? 1} min={1} onChange={(every) => set({ every })} label="every" />
          </label>
          <label className="field">
            <span>Until row (0 = forever)</span>
            <NumberStepper value={n.until ?? 0} onChange={(u) => set({ until: u || undefined })} label="until" />
          </label>
        </div>
      )}
    </Modal>
  )
}

export function RemindersCard({
  project,
  active,
  onAdd,
  onEdit,
}: {
  project: Project
  active: RowNote[]
  onAdd: () => void
  onEdit: (n: RowNote) => void
}) {
  const main = project.counters.find((c) => c.id === project.mainCounterId)!
  let upcoming: { note: RowNote; at: number } | null = null
  for (const n of project.notes) {
    if (n.counterId !== main.id) continue
    const at = nextOccurrence(n, main.value + 1)
    if (at !== null && (!upcoming || at < upcoming.at)) upcoming = { note: n, at }
  }
  return (
    <section className={`card reminders ${active.some((n) => n.kind === 'reminder') ? 'alert' : ''}`}>
      <div className="card-head">
        <h3>
          <Icon name="bell" size={18} /> Reminders
        </h3>
        <button className="icon-btn" onClick={onAdd} aria-label="Add reminder or comment">
          <Icon name="plus" size={20} />
        </button>
      </div>
      {active.length === 0 && !upcoming && (
        <p className="muted">Add reminders and comments that show up on specific rows.</p>
      )}
      {active.length > 0 && (
        <ul className="note-list">
          {active.map((n) => {
            const c = project.counters.find((x) => x.id === n.counterId)
            return (
              <li key={n.id} className={`note-item ${n.kind}`}>
                <button onClick={() => onEdit(n)}>
                  <Icon name={n.kind === 'reminder' ? 'bell' : 'comment'} size={16} />
                  <span className="note-text">{n.text}</span>
                  <span className="note-meta">
                    {c?.name} {c?.value}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {upcoming && (
        <p className="upcoming">
          Next: <b>{upcoming.note.text}</b> at {main.name.toLowerCase()} {upcoming.at}
          <span className="muted"> ({upcoming.at - main.value} to go)</span>
        </p>
      )}
    </section>
  )
}

export function NotesList({ project, onEdit }: { project: Project; onEdit: (n: RowNote) => void }) {
  if (!project.notes.length) return null
  const sorted = [...project.notes].sort((a, b) => a.row - b.row)
  return (
    <section className="card">
      <div className="card-head">
        <h3>
          <Icon name="list" size={18} /> All row notes
        </h3>
      </div>
      <ul className="note-list">
        {sorted.map((n) => {
          const c = project.counters.find((x) => x.id === n.counterId)
          return (
            <li key={n.id} className={`note-item ${n.kind}`}>
              <button onClick={() => onEdit(n)}>
                <Icon name={n.kind === 'reminder' ? 'bell' : 'comment'} size={16} />
                <span className="note-text">{n.text}</span>
                <span className="note-meta">
                  {c?.name}: {describeNoteRows(n)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
