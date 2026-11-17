import { detectSizeLabels, findSizeValues, findTerm, type TextMatch } from '../lib/sizes'
import type { Rect, SmartRule } from '../types'

interface TextIndex {
  text: string
  nodes: { node: Text; start: number }[]
}

/** Concatenates the text layer's text nodes so regexes can run across spans. */
export function buildTextIndex(container: HTMLElement): TextIndex {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const nodes: TextIndex['nodes'] = []
  let text = ''
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text
    if (!t.data) continue
    nodes.push({ node: t, start: text.length })
    text += t.data
    if (!/\s$/.test(t.data)) text += ' '
  }
  return { text, nodes }
}

function locate(idx: TextIndex, pos: number, isEnd: boolean): { node: Text; offset: number } | null {
  let lo = 0
  let hi = idx.nodes.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (idx.nodes[mid].start <= pos - (isEnd ? 1 : 0)) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  if (found < 0) return null
  const { node, start } = idx.nodes[found]
  return { node, offset: Math.max(0, Math.min(node.data.length, pos - start)) }
}

/** Converts client rects into page units, merging pieces that sit on the same line. */
export function clientRectsToPage(rects: Iterable<DOMRect>, pageEl: Element, scale: number, pad = 0.6): Rect[] {
  const box = pageEl.getBoundingClientRect()
  const out: Rect[] = []
  for (const r of rects) {
    if (r.width < 0.5 || r.height < 0.5) continue
    const rect = {
      x: (r.left - box.left) / scale - pad,
      y: (r.top - box.top) / scale - pad * 0.5,
      w: r.width / scale + pad * 2,
      h: r.height / scale + pad,
    }
    const prev = out[out.length - 1]
    if (prev && Math.abs(prev.y - rect.y) < rect.h * 0.4 && rect.x <= prev.x + prev.w + 2 && rect.x >= prev.x - 2) {
      const x2 = Math.max(prev.x + prev.w, rect.x + rect.w)
      const y1 = Math.min(prev.y, rect.y)
      const y2 = Math.max(prev.y + prev.h, rect.y + rect.h)
      Object.assign(prev, { w: x2 - prev.x, y: y1, h: y2 - y1 })
    } else out.push(rect)
  }
  return out
}

function matchRects(idx: TextIndex, m: TextMatch, pageEl: Element, scale: number): Rect[] {
  const a = locate(idx, m.start, false)
  const b = locate(idx, m.end, true)
  if (!a || !b) return []
  const range = document.createRange()
  try {
    range.setStart(a.node, a.offset)
    range.setEnd(b.node, b.offset)
  } catch {
    return []
  }
  return clientRectsToPage(range.getClientRects(), pageEl, scale)
}

export interface SmartRects {
  ruleId: string
  color: string
  rects: Rect[]
}

/** Finds rule matches (chosen size values, keywords) in a rendered text layer. */
export function computeSmartRects(textLayer: HTMLElement, pageEl: Element, scale: number, rules: SmartRule[]): SmartRects[] {
  const enabled = rules.filter((r) => r.enabled)
  if (!enabled.length) return []
  const idx = buildTextIndex(textLayer)
  return enabled.map((rule) => {
    let matches: TextMatch[] = []
    if (rule.type === 'size' && rule.sizeCount && rule.sizeIndex !== undefined) {
      matches = findSizeValues(idx.text, rule.sizeCount, rule.sizeIndex)
    } else if (rule.type === 'term' && rule.term) {
      matches = findTerm(idx.text, rule.term, rule.caseSensitive)
    }
    return { ruleId: rule.id, color: rule.color, rects: matches.flatMap((m) => matchRects(idx, m, pageEl, scale)) }
  })
}

export { detectSizeLabels }
