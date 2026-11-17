import { useRef, useState } from 'react'
import { usePatterns } from '../hooks/data'
import { importFiles, isSupportedFile } from '../lib/importer'
import type { PatternMeta } from '../types'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { useToast } from './Toast'

export function ImportButton({
  onImported,
  className = 'btn primary',
  label = 'Import pattern',
}: {
  onImported?: (items: PatternMeta[]) => void
  className?: string
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const run = async (files: File[]) => {
    const ok = files.filter(isSupportedFile)
    if (!ok.length) return toast('Choose a PDF or image file.', 'error')
    setBusy(true)
    try {
      const items = await importFiles(ok)
      toast(`Added ${items.map((i) => `“${i.name}”`).join(', ')} to your library.`)
      onImported?.(items)
    } catch (e) {
      toast(`Could not import: ${(e as Error).message}`, 'error', 5000)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button className={className} onClick={() => input.current?.click()} disabled={busy}>
        <Icon name="upload" size={18} /> {busy ? 'Importing…' : label}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept="application/pdf,.pdf,image/*"
        data-testid="import-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) void run(files)
        }}
      />
    </>
  )
}

export function PatternPicker({
  current,
  onPick,
  onClose,
}: {
  current?: string
  onPick: (id: string | undefined) => void
  onClose: () => void
}) {
  const patterns = usePatterns()
  return (
    <Modal
      title="Choose a pattern"
      onClose={onClose}
      footer={
        <>
          {current && (
            <button className="btn ghost" onClick={() => onPick(undefined)}>
              Unlink pattern
            </button>
          )}
          <span className="spacer" />
          <ImportButton label="Import new" onImported={(items) => items[0] && onPick(items[0].id)} />
        </>
      }
    >
      {patterns && patterns.length === 0 && <p className="muted">Your library is empty. Import a PDF or photos of your pattern.</p>}
      <ul className="picker-list">
        {patterns?.map((p) => (
          <li key={p.id}>
            <button className={`list-btn ${p.id === current ? 'selected' : ''}`} onClick={() => onPick(p.id)}>
              {p.thumb ? <img src={p.thumb} alt="" className="list-thumb" /> : <Icon name="file" />}
              <span className="grow">
                {p.name}
                <small className="muted">
                  {' '}
                  · {p.pageCount} {p.pageCount === 1 ? 'page' : 'pages'}
                </small>
              </span>
              {p.id === current && <Icon name="check" />}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
