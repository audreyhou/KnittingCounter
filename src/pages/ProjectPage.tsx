import { useEffect, useState } from 'react'
import { CounterCard, CounterEditor, MainCounter, NoteEditor, NotesList, RemindersCard } from '../components/Counters'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { PatternPicker } from '../components/PatternPicker'
import { useToast } from '../components/Toast'
import { deleteProject } from '../db'
import { useMediaQuery, useHideNav, useNow, useProject, useWakeLock } from '../hooks/data'
import { useVoiceControl, voiceSupported } from '../hooks/voice'
import {
  activeNotes,
  changeCounter,
  COUNTER_COLORS,
  counterProgress,
  elapsedMs,
  mainCounter,
  newCounter,
  pauseTimer,
  startTimer,
  triggeredReminders,
} from '../lib/counters'
import { formatDuration } from '../lib/format'
import { navigate } from '../router'
import type { Counter, Project, RowNote } from '../types'
import { LazyPatternViewer as PatternViewer } from '../viewer/LazyPatternViewer'

export function ProjectPage({ id }: { id: string }) {
  const [project, update] = useProject(id)
  const toast = useToast()
  const wide = useMediaQuery('(min-width: 980px)')
  const [view, setView] = useState<'counters' | 'pattern'>('counters')
  const [editCounter, setEditCounter] = useState<Counter | null>(null)
  const [editNote, setEditNote] = useState<RowNote | 'new' | null>(null)
  const [settings, setSettings] = useState(false)
  const [pickPattern, setPickPattern] = useState(false)
  const [voice, setVoice] = useState(false)
  const [alerts, setAlerts] = useState<RowNote[]>([])
  const running = project?.timer.runningSince != null
  const now = useNow(1000, running)
  useWakeLock(!!project?.keepAwake)
  useHideNav(!wide && view === 'pattern' && !!project?.patternId)

  const step = (counterId: string, d: 1 | -1) =>
    update((p) => {
      const next = changeCounter(p, counterId, d)
      const fired = triggeredReminders(p, next)
      if (fired.length) {
        setAlerts(fired)
        if ('vibrate' in navigator) navigator.vibrate([80, 60, 80])
      }
      return next
    })

  const toggleTimer = () =>
    update((p) => ({ ...p, timer: p.timer.runningSince != null ? pauseTimer(p.timer) : startTimer(p.timer), updatedAt: Date.now() }))

  const voiceError = useVoiceControl(voice, (cmd, heard) => {
    if (!project) return
    const main = mainCounter(project)
    if (cmd === 'next') step(main.id, 1)
    else if (cmd === 'back') step(main.id, -1)
    else if (cmd === 'start') update((p) => ({ ...p, timer: startTimer(p.timer) }))
    else if (cmd === 'stop') update((p) => ({ ...p, timer: pauseTimer(p.timer) }))
    toast(`🎙 “${heard.trim()}”`)
  })
  useEffect(() => {
    if (voiceError) {
      toast(voiceError, 'error', 4000)
      setVoice(false)
    }
  }, [voiceError, toast])

  if (project === undefined) return <div className="empty"><div className="spinner" /></div>
  if (project === null)
    return (
      <div className="empty">
        <p>Project not found.</p>
        <button className="btn" onClick={() => navigate('/')}>
          Back to projects
        </button>
      </div>
    )

  const main = mainCounter(project)
  const others = project.counters.filter((c) => c.id !== main.id)
  const active = activeNotes(project)
  const elapsed = elapsedMs(project.timer, now)
  const progress = main.max ? counterProgress(main) : null

  const saveCounter = (c: Counter) => {
    update((p) => {
      const exists = p.counters.some((x) => x.id === c.id)
      return { ...p, counters: exists ? p.counters.map((x) => (x.id === c.id ? c : x)) : [...p.counters, c], updatedAt: Date.now() }
    })
    setEditCounter(null)
  }

  const counters = (
    <div className="counters-pane">
      <section className="timer-strip">
        <div className="timer-display" aria-label="Time spent">
          <Icon name="clock" size={18} />
          <span data-testid="timer">{formatDuration(elapsed)}</span>
          {running && <span className="live-dot" aria-label="Timer running" />}
        </div>
        {progress !== null && (
          <div className="progress-line" aria-label={`${Math.round(progress * 100)}% done`}>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
            <span>{Math.round(progress * 100)}%</span>
          </div>
        )}
      </section>

      <MainCounter counter={main} onStep={(d) => step(main.id, d)} onEdit={() => setEditCounter(main)} />

      <RemindersCard project={project} active={active} onAdd={() => setEditNote('new')} onEdit={(n) => setEditNote(n)} />

      <div className="counter-grid">
        {others.map((c) => (
          <CounterCard
            key={c.id}
            counter={c}
            onStep={(d) => step(c.id, d)}
            onEdit={() => setEditCounter(c)}
            onToggleLink={() =>
              update((p) => ({ ...p, counters: p.counters.map((x) => (x.id === c.id ? { ...x, linked: !x.linked } : x)) }))
            }
          />
        ))}
        <button
          className="card add-counter"
          onClick={() => setEditCounter(newCounter('', COUNTER_COLORS[(project.counters.length) % COUNTER_COLORS.length]))}
        >
          <Icon name="plus" size={26} />
          <span>Add counter</span>
        </button>
      </div>

      <nav className="action-bar" aria-label="Project actions">
        <button onClick={() => setSettings(true)}>
          <Icon name="settings" />
          <span>Settings</span>
        </button>
        <button onClick={toggleTimer} className={running ? 'on' : ''}>
          <Icon name={running ? 'pause' : 'play'} />
          <span>{running ? 'Pause timer' : 'Start timer'}</span>
        </button>
        <button
          onClick={() => {
            if (!voiceSupported()) return toast('Voice control is not supported in this browser.', 'error')
            setVoice((v) => !v)
            if (!voice) toast('Listening… say “next”, “back”, “start” or “stop”.', 'info', 3500)
          }}
          className={voice ? 'on' : ''}
          aria-pressed={voice}
        >
          <Icon name="mic" />
          <span>Voice</span>
        </button>
        <button
          onClick={() => {
            if (project.patternId) {
              if (!wide) setView('pattern')
            } else setPickPattern(true)
          }}
        >
          <Icon name={project.patternId ? 'file' : 'upload'} />
          <span>{project.patternId ? 'Pattern' : 'Add pattern'}</span>
        </button>
      </nav>

      <NotesList project={project} onEdit={(n) => setEditNote(n)} />
    </div>
  )

  const compact = (
    <div className="viewer-bar compact-counter">
      <div className="bar-group grow">
        <span className="compact-name">{main.name}</span>
        <button className="bar-btn big" onClick={() => step(main.id, -1)} aria-label={`${main.name} minus one`}>
          <Icon name="minus" size={22} />
        </button>
        <span className="compact-value" data-testid="compact-value">
          {main.value}
          {main.max ? <small>/{main.max}</small> : null}
        </span>
        <button className="bar-btn big primary" onClick={() => step(main.id, 1)} aria-label={`${main.name} plus one`}>
          <Icon name="plus" size={22} />
        </button>
      </div>
      {active.length > 0 && (
        <div className="compact-notes">
          {active.map((n) => (
            <span key={n.id} className={`note-chip ${n.kind}`}>
              <Icon name={n.kind === 'reminder' ? 'bell' : 'comment'} size={13} /> {n.text}
            </span>
          ))}
        </div>
      )}
      <button className={`timer-pill ${running ? 'on' : ''}`} onClick={toggleTimer} aria-label={running ? 'Pause timer' : 'Start timer'}>
        <Icon name={running ? 'pause' : 'play'} size={14} /> {formatDuration(elapsed)}
      </button>
    </div>
  )

  const patternPane = project.patternId ? (
    <PatternViewer
      key={project.patternId}
      patternId={project.patternId}
      counters={project.counters}
      onStepCounter={step}
      header={
        !wide ? (
          <button className="icon-btn" onClick={() => setView('counters')} aria-label="Back to counters">
            <Icon name="back" />
          </button>
        ) : undefined
      }
      footer={!wide ? compact : undefined}
    />
  ) : (
    <div className="empty pattern-empty">
      <Icon name="file" size={42} />
      <p>Add your pattern to follow it next to your counters.</p>
      <button className="btn primary" onClick={() => setPickPattern(true)}>
        <Icon name="upload" size={18} /> Add pattern
      </button>
    </div>
  )

  return (
    <div className={`project-page ${wide ? 'wide' : ''} ${!wide && view === 'pattern' ? 'pattern-mode' : ''}`}>
      {(wide || view === 'counters') && (
        <header className="page-head">
          <button className="icon-btn" onClick={() => navigate('/')} aria-label="All projects">
            <Icon name="back" />
          </button>
          <h1 className="grow">{project.name}</h1>
          <button className="icon-btn" onClick={() => setSettings(true)} aria-label="Project settings">
            <Icon name="more" />
          </button>
        </header>
      )}
      <div className="project-body">
        {(wide || view === 'counters') && counters}
        {(wide || view === 'pattern') && <div className="pattern-pane">{patternPane}</div>}
      </div>

      {alerts.length > 0 && (
        <div className="reminder-alert" role="alertdialog" aria-label="Reminder">
          <div className="reminder-alert-icon">
            <Icon name="bell" size={26} />
          </div>
          <div className="grow">
            <b>
              {project.counters.find((c) => c.id === alerts[0].counterId)?.name} {project.counters.find((c) => c.id === alerts[0].counterId)?.value}
            </b>
            {alerts.map((a) => (
              <p key={a.id}>{a.text}</p>
            ))}
          </div>
          <button className="btn primary" onClick={() => setAlerts([])}>
            Got it
          </button>
        </div>
      )}

      {editCounter && (
        <CounterEditor
          counter={editCounter}
          isMain={editCounter.id === project.mainCounterId}
          onSave={saveCounter}
          onClose={() => setEditCounter(null)}
          onDelete={
            editCounter.id !== project.mainCounterId && project.counters.some((c) => c.id === editCounter.id)
              ? () => {
                  update((p) => ({
                    ...p,
                    counters: p.counters.filter((c) => c.id !== editCounter.id),
                    notes: p.notes.map((n) => (n.counterId === editCounter.id ? { ...n, counterId: p.mainCounterId } : n)),
                  }))
                  setEditCounter(null)
                }
              : undefined
          }
          onMakeMain={
            project.counters.some((c) => c.id === editCounter.id)
              ? () => {
                  update((p) => ({ ...p, mainCounterId: editCounter.id, counters: p.counters.map((c) => (c.id === editCounter.id ? { ...c, linked: false } : c)) }))
                  setEditCounter(null)
                }
              : undefined
          }
        />
      )}
      {editNote && (
        <NoteEditor
          note={editNote === 'new' ? null : editNote}
          project={project}
          onClose={() => setEditNote(null)}
          onSave={(n) => {
            update((p) => ({ ...p, notes: p.notes.some((x) => x.id === n.id) ? p.notes.map((x) => (x.id === n.id ? n : x)) : [...p.notes, n] }))
            setEditNote(null)
          }}
          onDelete={
            editNote !== 'new'
              ? () => {
                  update((p) => ({ ...p, notes: p.notes.filter((x) => x.id !== editNote.id) }))
                  setEditNote(null)
                }
              : undefined
          }
        />
      )}
      {settings && (
        <ProjectSettings
          project={project}
          onChange={(fn) => update(fn)}
          onPickPattern={() => {
            setSettings(false)
            setPickPattern(true)
          }}
          onClose={() => setSettings(false)}
        />
      )}
      {pickPattern && (
        <PatternPicker
          current={project.patternId}
          onClose={() => setPickPattern(false)}
          onPick={(pid) => {
            update((p) => ({ ...p, patternId: pid, updatedAt: Date.now() }))
            setPickPattern(false)
            if (pid && !wide) setView('pattern')
          }}
        />
      )}
    </div>
  )
}

function ProjectSettings({
  project,
  onChange,
  onPickPattern,
  onClose,
}: {
  project: Project
  onChange: (fn: (p: Project) => Project) => void
  onPickPattern: () => void
  onClose: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  return (
    <Modal
      title="Project settings"
      onClose={onClose}
      footer={
        <>
          {confirm ? (
            <>
              <span className="danger-text">Delete this project?</span>
              <button
                className="btn danger"
                onClick={async () => {
                  await deleteProject(project.id)
                  navigate('/', true)
                }}
              >
                Delete
              </button>
              <button className="btn" onClick={() => setConfirm(false)}>
                Keep
              </button>
            </>
          ) : (
            <button className="btn danger ghost" onClick={() => setConfirm(true)}>
              <Icon name="trash" size={18} /> Delete project
            </button>
          )}
          <span className="spacer" />
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <label className="field">
        <span>Name</span>
        <input value={project.name} onChange={(e) => onChange((p) => ({ ...p, name: e.target.value }))} />
      </label>
      <div className="segmented">
        {(['knit', 'crochet'] as const).map((c) => (
          <button key={c} className={project.craft === c ? 'on' : ''} onClick={() => onChange((p) => ({ ...p, craft: c }))}>
            {c === 'knit' ? 'Knitting' : 'Crochet'}
          </button>
        ))}
      </div>
      <label className="switch-field">
        <input type="checkbox" checked={!!project.keepAwake} onChange={(e) => onChange((p) => ({ ...p, keepAwake: e.target.checked }))} />
        <span>
          <b>Keep screen awake</b>
          <small>Stops your phone from dimming while this project is open.</small>
        </span>
      </label>
      <div className="row-actions">
        <button className="btn" onClick={onPickPattern}>
          <Icon name="file" size={18} /> {project.patternId ? 'Change pattern' : 'Add pattern'}
        </button>
        <button className="btn ghost" onClick={() => onChange((p) => ({ ...p, timer: { totalMs: 0, runningSince: null } }))}>
          <Icon name="reset" size={18} /> Reset timer
        </button>
      </div>
    </Modal>
  )
}
