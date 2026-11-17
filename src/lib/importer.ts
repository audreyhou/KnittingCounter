import { addPattern } from '../db'
import type { PatternMeta } from '../types'
import { uid } from './id'

const THUMB_W = 240

export function isSupportedFile(f: File) {
  return f.type === 'application/pdf' || /\.pdf$/i.test(f.name) || f.type.startsWith('image/')
}

function niceName(fileName: string) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_]+/g, ' ')
    .trim()
}

function canvasToDataUrl(c: HTMLCanvasElement) {
  return c.toDataURL('image/jpeg', 0.75)
}

async function pdfThumb(data: ArrayBuffer): Promise<{ pages: number; thumb: string }> {
  const { loadPdf } = await import('./pdf')
  const { doc, destroy } = await loadPdf(data)
  try {
    const page = await doc.getPage(1)
    const vp1 = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: THUMB_W / vp1.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    await page.render({ canvas, viewport }).promise
    return { pages: doc.numPages, thumb: canvasToDataUrl(canvas) }
  } finally {
    destroy()
  }
}

async function imageThumb(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = THUMB_W
    canvas.height = Math.round((img.naturalHeight / img.naturalWidth) * THUMB_W)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvasToDataUrl(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Adds files to the library. Every PDF becomes its own pattern; images picked
 * together become one multi-page pattern (e.g. photos of each page).
 */
export async function importFiles(files: File[]): Promise<PatternMeta[]> {
  const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
  const images = files.filter((f) => !pdfs.includes(f) && f.type.startsWith('image/'))
  const out: PatternMeta[] = []
  const now = Date.now()

  for (const f of pdfs) {
    const data = await f.arrayBuffer()
    const { pages, thumb } = await pdfThumb(data.slice(0))
    const meta: PatternMeta = {
      id: uid(),
      name: niceName(f.name),
      kind: 'pdf',
      pageCount: pages,
      fileSize: f.size,
      createdAt: now,
      updatedAt: now,
      thumb,
    }
    await addPattern(meta, [new Blob([data], { type: 'application/pdf' })])
    out.push(meta)
  }

  if (images.length) {
    images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    const meta: PatternMeta = {
      id: uid(),
      name: niceName(images[0].name),
      kind: 'images',
      pageCount: images.length,
      fileSize: images.reduce((s, f) => s + f.size, 0),
      createdAt: now,
      updatedAt: now,
      thumb: await imageThumb(images[0]),
    }
    await addPattern(meta, images)
    out.push(meta)
  }
  return out
}
