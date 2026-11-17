import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { PatternPicker } from '../components/PatternPicker'
import { saveProject } from '../db'
import { usePatterns, useProjects } from '../hooks/data'
import { counterProgress, elapsedMs, mainCounter, newProject } from '../lib/counters'
import { formatShortDuration, relativeDate } from '../lib/format'
import { navigate } from '../router'
import type { Craft } from '../types'

export function ProjectsPage() {
  const projects = useProjects()
  const patterns = usePatterns()
  const [creating, setCreating] = useState(false)
  const thumb = (id?: string) => patterns?.find((p) => p.id === id)?.thumb

  return (
    <div className="page-wrap">
      <header className="page-head">
        <h1 className="grow">My Projects</h1>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={18} /> New project
        </button>
      </header>
      {projects && projects.length === 0 && (
        <div className="welcome card">
          <img src="./logo.svg" alt="" width={72} height={72} />
          <h2>Welcome to Knitting Counter</h2>
          <p>
            Keep every row on track: as many counters as you need, reminders that pop up on the right row, a project timer, and a
            pattern viewer with highlighters, chart tracking, notes and bookmarks.
          </p>
          <p className="muted">Everything is stored on this device only. No account needed.</p>
          <button className="btn primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={18} /> Start your first project
          </button>
        </div>
      )}
      <ul className="project-list">
        {projects?.map((p) => {
          const main = mainCounter(p)
          const running = p.timer.runningSince != null
          return (
            <li key={p.id}>
              <button className="card project-card" onClick={() => navigate(`/project/${p.id}`)}>
                <div className="project-thumb">
                  {thumb(p.patternId) ? <img src={thumb(p.patternId)} alt="" /> : <Icon name="projects" size={34} />}
                </div>
                <div className="grow project-info">
                  <h3>{p.name}</h3>
                  <p className="muted">
                    {main.name} {main.value}
                    {main.max ? ` of ${main.max}` : ''} · {p.counters.length} {p.counters.length === 1 ? 'counter' : 'counters'}
                  </p>
                  <p className="muted small">
                    <Icon name="clock" size={13} /> {formatShortDuration(elapsedMs(p.timer))}
                    {running && <span className="live-dot" />} · {p.craft === 'crochet' ? 'Crochet' : 'Knitting'} · {relativeDate(p.updatedAt)}
                  </p>
                  {main.max ? (
                    <div className="progress-track thin">
                      <div className="progress-fill" style={{ width: `${counterProgress(main) * 100}%` }} />
                    </div>
                  ) : null}
                </div>
                <Icon name="right" />
              </button>
            </li>
          )
        })}
      </ul>
      {creating && <NewProjectModal onClose={() => setCreating(false)} />}
    </div>
  )
}

export function NewProjectModal({ onClose, patternId }: { onClose: () => void; patternId?: string }) {
  const patterns = usePatterns()
  const [name, setName] = useState(() => (patternId ? (patterns?.find((p) => p.id === patternId)?.name ?? '') : ''))
  const [craft, setCraft] = useState<Craft>('knit')
  const [pattern, setPattern] = useState<string | undefined>(patternId)
  const [picking, setPicking] = useState(false)
  const [rows, setRows] = useState('')
  const chosen = patterns?.find((p) => p.id === pattern)

  const create = async () => {
    const p = newProject(name.trim() || chosen?.name || 'New project', craft)
    p.patternId = pattern
    const n = parseInt(rows, 10)
    if (n > 0) p.counters[0].max = n
    await saveProject(p)
    onClose()
    navigate(`/project/${p.id}`)
  }

  return (
    <Modal
      title="New project"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => void create()}>
            Create
          </button>
        </>
      }
    >
      <label className="field">
        <span>Project name</span>
        <input autoFocus value={name} placeholder={chosen?.name ?? 'e.g. Cardigan No. 10'} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="segmented">
        {(['knit', 'crochet'] as const).map((c) => (
          <button key={c} className={craft === c ? 'on' : ''} onClick={() => setCraft(c)}>
            {c === 'knit' ? 'Knitting' : 'Crochet'}
          </button>
        ))}
      </div>
      <label className="field">
        <span>Total rows (optional, for progress)</span>
        <input inputMode="numeric" value={rows} onChange={(e) => setRows(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 120" />
      </label>
      <div className="field">
        <span>Pattern</span>
        <button className="list-btn bordered" onClick={() => setPicking(true)}>
          {chosen?.thumb ? <img src={chosen.thumb} alt="" className="list-thumb" /> : <Icon name="file" />}
          <span className="grow">{chosen ? chosen.name : 'Choose from library or import (optional)'}</span>
          <Icon name="right" />
        </button>
      </div>
      {picking && (
        <PatternPicker
          current={pattern}
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setPattern(id)
            setPicking(false)
          }}
        />
      )}
    </Modal>
  )
}
