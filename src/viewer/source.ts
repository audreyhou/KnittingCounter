import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { getPatternFiles } from '../db'
import { loadPdf, pdfjs } from '../lib/pdf'
import type { PatternMeta } from '../types'

export interface PageSize {
  w: number
  h: number
}

/** A line of text on a page, in page units. Used to snap the row bar. */
export interface TextLine {
  x: number
  y: number
  w: number
  h: number
}

export interface RenderJob {
  promise: Promise<void>
  cancel(): void
}

export interface PageSource {
  kind: 'pdf' | 'images'
  sizes: PageSize[]
  render(page: number, canvas: HTMLCanvasElement, pxPerUnit: number): RenderJob
  pdfPage(page: number): Promise<PDFPageProxy> | null
  lines(page: number): Promise<TextLine[]>
  pageText(page: number): Promise<string>
  destroy(): void
}

export async function openSource(meta: PatternMeta): Promise<PageSource> {
  const blobs = await getPatternFiles(meta.id)
  if (!blobs.length) throw new Error('The pattern file is missing.')
  if (meta.kind === 'pdf') {
    const { doc, destroy } = await loadPdf(await blobs[0].arrayBuffer())
    return pdfSource(doc, destroy)
  }
  return imageSource(blobs)
}

async function pdfSource(doc: PDFDocumentProxy, destroy: () => void): Promise<PageSource> {
  const pages = await Promise.all(Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1)))
  const sizes = pages.map((p) => {
    const vp = p.getViewport({ scale: 1 })
    return { w: vp.width, h: vp.height }
  })
  const lineCache = new Map<number, Promise<TextLine[]>>()
  const textCache = new Map<number, Promise<string>>()
  // Render one page at a time: image-heavy pages are expensive on the main thread.
  let queue: Promise<unknown> = Promise.resolve()

  return {
    kind: 'pdf',
    sizes,
    render(page, canvas, px) {
      let cancelled = false
      let task: ReturnType<PDFPageProxy['render']> | null = null
      const run = async () => {
        if (cancelled) return
        const p = pages[page]
        const viewport = p.getViewport({ scale: px })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        task = p.render({ canvas, viewport })
        try {
          await task.promise
        } catch (e) {
          if ((e as Error)?.name !== 'RenderingCancelledException') throw e
        }
      }
      const promise = queue.then(run, run)
      queue = promise.catch(() => {})
      return {
        promise,
        cancel: () => {
          cancelled = true
          task?.cancel()
        },
      }
    },
    pdfPage: (page) => Promise.resolve(pages[page]),
    lines(page) {
      if (!lineCache.has(page)) lineCache.set(page, extractLines(pages[page]))
      return lineCache.get(page)!
    },
    pageText(page) {
      if (!textCache.has(page)) {
        textCache.set(
          page,
          pages[page].getTextContent().then((tc) =>
            tc.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join(''),
          ),
        )
      }
      return textCache.get(page)!
    },
    destroy,
  }
}

async function extractLines(page: PDFPageProxy): Promise<TextLine[]> {
  const vp = page.getViewport({ scale: 1 })
  const tc = await page.getTextContent()
  const boxes: TextLine[] = []
  for (const it of tc.items) {
    if (!('str' in it) || !it.str.trim()) continue
    const t = pdfjs.Util.transform(vp.transform, it.transform)
    const fs = Math.hypot(t[2], t[3])
    if (fs < 2) continue
    const w = it.width * vp.scale
    boxes.push({ x: t[4], y: t[5] - fs * 0.85, w, h: fs * 1.15 })
  }
  boxes.sort((a, b) => a.y - b.y)
  const lines: TextLine[] = []
  for (const b of boxes) {
    const last = lines[lines.length - 1]
    const lastMid = last ? last.y + last.h / 2 : -1e9
    if (last && Math.abs(b.y + b.h / 2 - lastMid) < Math.min(last.h, b.h) * 0.5) {
      const x1 = Math.min(last.x, b.x)
      const x2 = Math.max(last.x + last.w, b.x + b.w)
      const y1 = Math.min(last.y, b.y)
      const y2 = Math.max(last.y + last.h, b.y + b.h)
      Object.assign(last, { x: x1, w: x2 - x1, y: y1, h: y2 - y1 })
    } else {
      lines.push({ ...b })
    }
  }
  return lines
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => res(img)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      rej(new Error('Could not read image'))
    }
    img.src = url
  })
}

async function imageSource(blobs: Blob[]): Promise<PageSource> {
  const imgs = await Promise.all(blobs.map(loadImage))
  return {
    kind: 'images',
    sizes: imgs.map((i) => ({ w: i.naturalWidth, h: i.naturalHeight })),
    render(page, canvas, px) {
      const img = imgs[page]
      canvas.width = Math.max(1, Math.floor(img.naturalWidth * px))
      canvas.height = Math.max(1, Math.floor(img.naturalHeight * px))
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      return { promise: Promise.resolve(), cancel() {} }
    },
    pdfPage: () => null,
    lines: () => Promise.resolve([]),
    pageText: () => Promise.resolve(''),
    destroy() {
      for (const i of imgs) URL.revokeObjectURL(i.src)
    },
  }
}
