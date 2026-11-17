import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { ImportButton } from '../components/PatternPicker'
import { useToast } from '../components/Toast'
import { deletePattern, savePattern } from '../db'
import { usePatterns } from '../hooks/data'
import { formatBytes, relativeDate } from '../lib/format'
import { importFiles, isSupportedFile } from '../lib/importer'
import { navigate } from '../router'
import type { PatternMeta } from '../types'
import { NewProjectModal } from './ProjectsPage'

export function LibraryPage() {
  const patterns = usePatterns()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<PatternMeta | null>(null)
  const [startFrom, setStartFrom] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const shown = patterns?.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))

  const onDrop = async (files: File[]) => {
    const ok = files.filter(isSupportedFile)
    if (!ok.length) return
    try {
      const items = await importFiles(ok)
      toast(`Added ${items.length} ${items.length === 1 ? 'pattern' : 'patterns'} to your library.`)
    } catch (e) {
      toast(`Could not import: ${(e as Error).message}`, 'error')
    }
  }

  return (
    <div
      className={`page-wrap ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        void onDrop(Array.from(e.dataTransfer.files))
      }}
    >
      <header className="page-head">
        <h1 className="grow">Pattern Library</h1>
        <ImportButton />
      </header>
      <p className="muted lead">
        Import PDFs or photos of your patterns. Several photos picked together become one multi-page pattern. Files stay on this device.
      </p>
      {patterns && patterns.length > 3 && (
        <label className="search">
          <Icon name="search" size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search patterns" aria-label="Search patterns" />
        </label>
      )}
      {patterns && patterns.length === 0 && (
        <div className="drop-zone">
          <Icon name="upload" size={40} />
          <p>Drop PDF or image files here, or use “Import pattern”.</p>
        </div>
      )}
      <ul className="library-grid">
        {shown?.map((p) => (
          <li key={p.id} className="card pattern-card">
            <button className="pattern-open" onClick={() => navigate(`/pattern/${p.id}`)}>
              <div className="pattern-thumb">{p.thumb ? <img src={p.thumb} alt="" /> : <Icon name="file" size={40} />}</div>
              <div className="pattern-meta">
                <h3>{p.name}</h3>
                <p className="muted small">
                  {p.kind === 'pdf' ? 'PDF' : 'Images'} · {p.pageCount} {p.pageCount === 1 ? 'page' : 'pages'} · {formatBytes(p.fileSize)}
                </p>
                <p className="muted small">{p.lastOpenedAt ? `Opened ${relativeDate(p.lastOpenedAt)}` : `Added ${relativeDate(p.createdAt)}`}</p>
              </div>
            </button>
            <button className="icon-btn card-menu" onClick={() => setMenu(p)} aria-label={`Options for ${p.name}`}>
              <Icon name="more" />
            </button>
          </li>
        ))}
      </ul>
      {menu && (
        <PatternMenu
          pattern={menu}
          onClose={() => setMenu(null)}
          onStart={() => {
            setStartFrom(menu.id)
            setMenu(null)
          }}
        />
      )}
      {startFrom && <NewProjectModal patternId={startFrom} onClose={() => setStartFrom(null)} />}
    </div>
  )
}

function PatternMenu({ pattern, onClose, onStart }: { pattern: PatternMeta; onClose: () => void; onStart: () => void }) {
  const [name, setName] = useState(pattern.name)
  const [confirm, setConfirm] = useState(false)
  return (
    <Modal
      title="Pattern"
      onClose={() => {
        if (name.trim() && name !== pattern.name) void savePattern({ ...pattern, name: name.trim(), updatedAt: Date.now() })
        onClose()
      }}
      footer={
        confirm ? (
          <>
            <span className="danger-text grow">Delete “{pattern.name}” and its highlights and notes?</span>
            <button
              className="btn danger"
              onClick={async () => {
                await deletePattern(pattern.id)
                onClose()
              }}
            >
              Delete
            </button>
            <button className="btn" onClick={() => setConfirm(false)}>
              Keep
            </button>
          </>
        ) : (
          <>
            <button className="btn danger ghost" onClick={() => setConfirm(true)}>
              <Icon name="trash" size={18} /> Delete
            </button>
            <span className="spacer" />
            <button className="btn" onClick={onStart}>
              <Icon name="plus" size={18} /> Start project
            </button>
            <button className="btn primary" onClick={() => navigate(`/pattern/${pattern.id}`)}>
              Open
            </button>
          </>
        )
      }
    >
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
    </Modal>
  )
}
