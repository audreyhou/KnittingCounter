import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { exportAll, importAll, type BackupData } from '../db'
import { formatBytes } from '../lib/format'
import { installPrompt, onInstallChange } from '../pwa'

export function ToolsPage() {
  const toast = useToast()
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [canInstall, setCanInstall] = useState(!!installPrompt())
  const fileRef = useRef<HTMLInputElement>(null)
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = window.matchMedia('(display-mode: standalone)').matches

  const refresh = async () => {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate()
      setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 })
    }
    if (navigator.storage?.persisted) setPersisted(await navigator.storage.persisted())
  }
  useEffect(() => {
    void refresh()
    return onInstallChange(() => setCanInstall(!!installPrompt()))
  }, [])

  const doExport = async () => {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `knitting-counter-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    toast('Backup downloaded.')
  }

  const doImport = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as BackupData
      await importAll(data)
      toast(`Restored ${data.projects.length} projects and ${data.patterns.length} patterns.`)
      void refresh()
    } catch (e) {
      toast(`Could not restore: ${(e as Error).message}`, 'error', 5000)
    }
  }

  return (
    <div className="page-wrap">
      <header className="page-head">
        <h1 className="grow">Tools & Settings</h1>
      </header>

      <section className="card tool-card">
        <h3>
          <Icon name="download" size={20} /> Install the app
        </h3>
        {standalone ? (
          <p className="muted">Installed. You can use Knitting Counter offline from your home screen.</p>
        ) : canInstall ? (
          <>
            <p className="muted">Add Knitting Counter to your home screen or desktop and use it offline.</p>
            <button className="btn primary" onClick={() => void installPrompt()?.prompt()}>
              Install
            </button>
          </>
        ) : isIOS ? (
          <p className="muted">
            In Safari tap <b>Share</b> → <b>Add to Home Screen</b> to install. It works offline after the first visit.
          </p>
        ) : (
          <p className="muted">Use your browser’s “Install app” or “Add to Home screen” option. It works offline after the first visit.</p>
        )}
      </section>

      <section className="card tool-card">
        <h3>
          <Icon name="library" size={20} /> Storage on this device
        </h3>
        <p className="muted">
          Projects, patterns, highlights and notes are saved in this browser only. Export a backup to move them to another device or keep
          them safe.
        </p>
        {usage && (
          <p>
            Using <b>{formatBytes(usage.used)}</b>
            {usage.quota ? ` of ${formatBytes(usage.quota)} available` : ''}
          </p>
        )}
        {persisted === false && (
          <button
            className="btn"
            onClick={async () => {
              const ok = await navigator.storage.persist()
              setPersisted(ok)
              toast(ok ? 'Storage is now protected from automatic clean-up.' : 'The browser did not allow persistent storage.')
            }}
          >
            Protect my data from clean-up
          </button>
        )}
        {persisted && <p className="muted small">✓ Storage is protected from automatic clean-up.</p>}
        <div className="row-actions">
          <button className="btn primary" onClick={() => void doExport()}>
            <Icon name="download" size={18} /> Export backup
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> Restore backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void doImport(f)
            }}
          />
        </div>
      </section>

      <section className="card tool-card help">
        <h3>
          <Icon name="info" size={20} /> How to use
        </h3>
        <dl>
          <dt>Counters</dt>
          <dd>
            Tap the big ring or + to count a row. Add as many counters as you like. Turn on the <Icon name="link" size={14} /> link so a
            counter moves with the main row counter, and set a target with “Repeat counter” for pattern repeats.
          </dd>
          <dt>Reminders & comments</dt>
          <dd>Add them to a row (or every few rows). Reminders pop up when you reach the row; comments stay visible while you work it.</dd>
          <dt>Timer</dt>
          <dd>Start the timer while you knit; the time spent is saved with the project.</dd>
          <dt>Row bar</dt>
          <dd>Marks the line you are on. Move it with the arrows (or ↑/↓ keys); it snaps to text lines in PDFs.</dd>
          <dt>Highlights</dt>
          <dd>
            Select text or drag with the highlighter to mark instructions in different colors. Use <Icon name="sun" size={14} /> Smart
            highlights to mark your size everywhere, or every “M1L”.
          </dd>
          <dt>Charts</dt>
          <dd>
            Choose the chart tool and drag a box around the chart squares. Set rows and stitches, then follow it row by row or stitch by
            stitch (← → keys). Link it to a counter so it follows your rows.
          </dd>
          <dt>Notes & drawing</dt>
          <dd>Add notes, draw with the pen or highlight freehand with the marker, in any color.</dd>
          <dt>Bookmarks</dt>
          <dd>Drag around sizes, abbreviations or anything else to pin it on top of the pattern while you work.</dd>
        </dl>
      </section>
    </div>
  )
}
