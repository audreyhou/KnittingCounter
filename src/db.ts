import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Markup, PatternMeta, Project } from './types'
import { emptyMarkup } from './types'

interface FileRecord {
  key: string
  patternId: string
  index: number
  blob: Blob
}

interface KnitDB extends DBSchema {
  projects: { key: string; value: Project }
  patterns: { key: string; value: PatternMeta }
  files: { key: string; value: FileRecord; indexes: { byPattern: string } }
  markup: { key: string; value: Markup }
}

export type StoreName = 'projects' | 'patterns' | 'files' | 'markup'

let dbPromise: Promise<IDBPDatabase<KnitDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<KnitDB>('knitting-counter', 1, {
      upgrade(d) {
        d.createObjectStore('projects', { keyPath: 'id' })
        d.createObjectStore('patterns', { keyPath: 'id' })
        const files = d.createObjectStore('files', { keyPath: 'key' })
        files.createIndex('byPattern', 'patternId')
        d.createObjectStore('markup', { keyPath: 'patternId' })
      },
    })
  }
  return dbPromise
}

/** Notifies hooks that a store changed so lists can refresh. */
export const dbEvents = new EventTarget()
function changed(store: StoreName, id?: string) {
  dbEvents.dispatchEvent(new CustomEvent('change', { detail: { store, id } }))
}

// Projects
export async function listProjects(): Promise<Project[]> {
  const all = await (await db()).getAll('projects')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}
export async function getProject(id: string) {
  return (await db()).get('projects', id)
}
export async function saveProject(p: Project) {
  await (await db()).put('projects', p)
  changed('projects', p.id)
}
export async function deleteProject(id: string) {
  await (await db()).delete('projects', id)
  changed('projects', id)
}

// Patterns
export async function listPatterns(): Promise<PatternMeta[]> {
  const all = await (await db()).getAll('patterns')
  return all.sort((a, b) => (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt))
}
export async function getPattern(id: string) {
  return (await db()).get('patterns', id)
}
export async function savePattern(p: PatternMeta) {
  await (await db()).put('patterns', p)
  changed('patterns', p.id)
}
export async function addPattern(meta: PatternMeta, blobs: Blob[]) {
  const d = await db()
  const tx = d.transaction(['patterns', 'files', 'markup'], 'readwrite')
  await tx.objectStore('patterns').put(meta)
  for (let i = 0; i < blobs.length; i++) {
    await tx.objectStore('files').put({ key: `${meta.id}:${i}`, patternId: meta.id, index: i, blob: blobs[i] })
  }
  await tx.objectStore('markup').put(emptyMarkup(meta.id))
  await tx.done
  changed('patterns', meta.id)
}
export async function getPatternFiles(patternId: string): Promise<Blob[]> {
  const recs = await (await db()).getAllFromIndex('files', 'byPattern', patternId)
  return recs.sort((a, b) => a.index - b.index).map((r) => r.blob)
}
export async function deletePattern(id: string) {
  const d = await db()
  const tx = d.transaction(['patterns', 'files', 'markup', 'projects'], 'readwrite')
  await tx.objectStore('patterns').delete(id)
  const keys = await tx.objectStore('files').index('byPattern').getAllKeys(id)
  for (const k of keys) await tx.objectStore('files').delete(k)
  await tx.objectStore('markup').delete(id)
  // Unlink from projects that used this pattern.
  const projects = await tx.objectStore('projects').getAll()
  for (const p of projects) {
    if (p.patternId === id) await tx.objectStore('projects').put({ ...p, patternId: undefined })
  }
  await tx.done
  changed('patterns', id)
  changed('projects')
}

// Markup
export async function getMarkup(patternId: string): Promise<Markup> {
  const m = await (await db()).get('markup', patternId)
  return { ...emptyMarkup(patternId), ...m }
}
export async function saveMarkup(m: Markup) {
  await (await db()).put('markup', m)
  changed('markup', m.patternId)
}

// Backup
export interface BackupData {
  app: 'knitting-counter'
  version: 1
  exportedAt: number
  projects: Project[]
  patterns: PatternMeta[]
  markup: Markup[]
  files: { key: string; patternId: string; index: number; type: string; data: string }[]
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })
}

function base64ToBlob(data: string, type: string) {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function exportAll(): Promise<BackupData> {
  const d = await db()
  const files = await d.getAll('files')
  return {
    app: 'knitting-counter',
    version: 1,
    exportedAt: Date.now(),
    projects: await d.getAll('projects'),
    patterns: await d.getAll('patterns'),
    markup: await d.getAll('markup'),
    files: await Promise.all(
      files.map(async (f) => ({
        key: f.key,
        patternId: f.patternId,
        index: f.index,
        type: f.blob.type,
        data: await blobToBase64(f.blob),
      })),
    ),
  }
}

export async function importAll(data: BackupData) {
  if (data.app !== 'knitting-counter') throw new Error('This file is not a Knitting Counter backup.')
  const d = await db()
  const tx = d.transaction(['projects', 'patterns', 'files', 'markup'], 'readwrite')
  for (const p of data.projects) await tx.objectStore('projects').put(p)
  for (const p of data.patterns) await tx.objectStore('patterns').put(p)
  for (const m of data.markup) await tx.objectStore('markup').put(m)
  for (const f of data.files) {
    await tx.objectStore('files').put({
      key: f.key,
      patternId: f.patternId,
      index: f.index,
      blob: base64ToBlob(f.data, f.type),
    })
  }
  await tx.done
  changed('projects')
  changed('patterns')
}
