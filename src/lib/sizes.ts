// Finds multi-size number groups in pattern text such as
//   "Cast on 31 (31) 33 (33) 35 (35) 35 (35) sts"   (alternating)
//   "Cast on 31 (33, 35, 37) sts"                    (grouped)
//   "Cast on 31/33/35/37 sts"                        (slash)
// and returns the character range of the value for one chosen size.

const NUM = String.raw`(?:\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?|[-–—])`

function wrap(body: string) {
  return new RegExp(String.raw`(?<![\d.,/])${body}(?![\d/])`, 'dg')
}

export function sizeRegexes(count: number): RegExp[] {
  if (count < 2) return []
  const alt = Array.from({ length: count }, (_, i) => (i % 2 ? String.raw`\(\s*(${NUM})\s*\)` : `(${NUM})`)).join(
    String.raw`\s*`,
  )
  const grouped =
    `(${NUM})` +
    String.raw`\s*\(\s*` +
    Array.from({ length: count - 1 }, () => `(${NUM})`).join(String.raw`\s*,\s*`) +
    String.raw`\s*\)`
  const slash = Array.from({ length: count }, () => `(${NUM})`).join(String.raw`\s*/\s*`)
  return [alt, grouped, slash].map(wrap)
}

export interface TextMatch {
  start: number
  end: number
}

/** Ranges (in `text`) of the value for size `index` (0-based) out of `count` sizes. */
export function findSizeValues(text: string, count: number, index: number): TextMatch[] {
  if (index < 0 || index >= count) return []
  const out: TextMatch[] = []
  const taken: [number, number][] = []
  for (const re of sizeRegexes(count)) {
    re.lastIndex = 0
    for (const m of text.matchAll(re)) {
      const whole = m.indices?.[0]
      if (!whole || taken.some(([s, e]) => whole[0] < e && whole[1] > s)) continue
      // A lone dash means the size has no value here; skip highlighting it.
      const g = m.indices![index + 1]
      if (!g) continue
      taken.push([whole[0], whole[1]])
      out.push({ start: g[0], end: g[1] })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

const LABEL = String.raw`(?:XXS|XXL|XXXL|[2-6]?X{0,3}[SML]|[2-6]X)`
const LABEL_SEQ = new RegExp(
  String.raw`(?<![A-Za-z0-9])${LABEL}(?:\s*(?:\(\s*${LABEL}(?:\s*,\s*${LABEL})*\s*\)|/\s*${LABEL}|,\s*${LABEL})\s*(?:${LABEL}(?![A-Za-z0-9]))?)+`,
  'g',
)
const LABEL_TOKEN = new RegExp(LABEL, 'g')

/** Tries to find the list of sizes (e.g. "XS (S) M (L) XL (2XL) 3XL (4XL)"). */
export function detectSizeLabels(text: string): string[] | null {
  let best: string[] | null = null
  for (const m of text.matchAll(LABEL_SEQ)) {
    const labels = m[0].match(LABEL_TOKEN) ?? []
    if (labels.length >= 3 && (!best || labels.length > best.length)) best = labels
  }
  return best
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** All occurrences of a term, matching whole words where the term starts/ends with a letter or digit. */
export function findTerm(text: string, term: string, caseSensitive = false): TextMatch[] {
  const t = term.trim()
  if (!t) return []
  const pre = /^[A-Za-z0-9]/.test(t) ? '(?<![A-Za-z0-9])' : ''
  const post = /[A-Za-z0-9]$/.test(t) ? '(?![A-Za-z0-9])' : ''
  const re = new RegExp(pre + escapeRe(t).replace(/\s+/g, '\\s+') + post, caseSensitive ? 'g' : 'gi')
  return Array.from(text.matchAll(re), (m) => ({ start: m.index!, end: m.index! + m[0].length }))
}
