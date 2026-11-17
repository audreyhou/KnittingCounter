import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export { pdfjs }

function assetUrl(path: string) {
  return new URL(`pdfjs/${path}`, document.baseURI).href
}

export async function loadPdf(data: ArrayBuffer | Uint8Array) {
  const task = pdfjs.getDocument({
    data,
    cMapUrl: assetUrl('cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: assetUrl('standard_fonts/'),
    wasmUrl: assetUrl('wasm/'),
    iccUrl: assetUrl('iccs/'),
  })
  const doc = await task.promise
  return { doc, destroy: () => void task.destroy() }
}
