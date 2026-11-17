export type Craft = 'knit' | 'crochet'

export interface Counter {
  id: string
  name: string
  value: number
  /** Target value. For repeat counters this is the repeat length. */
  max?: number
  /** When true the counter goes back to 1 after reaching `max` and `cycles` increases. */
  wrap?: boolean
  /** Number of completed repeats (only meaningful when `wrap` is set). */
  cycles: number
  /** Linked counters advance / go back together with the main counter. */
  linked?: boolean
  color: string
}

export type NoteKind = 'reminder' | 'comment'

/** A comment or reminder that shows up while working a specific row. */
export interface RowNote {
  id: string
  counterId: string
  kind: NoteKind
  text: string
  row: number
  /** Repeat every N rows after `row`. */
  every?: number
  /** Last row the repeat applies to. */
  until?: number
}

export interface TimerState {
  totalMs: number
  runningSince: number | null
}

export interface Project {
  id: string
  name: string
  craft: Craft
  createdAt: number
  updatedAt: number
  counters: Counter[]
  mainCounterId: string
  notes: RowNote[]
  timer: TimerState
  patternId?: string
  keepAwake?: boolean
}

export type PatternKind = 'pdf' | 'images'

export interface PatternMeta {
  id: string
  name: string
  kind: PatternKind
  pageCount: number
  fileSize: number
  createdAt: number
  updatedAt: number
  lastOpenedAt?: number
  thumb?: string
}

/** Rectangle in page units (PDF points at scale 1, or natural image pixels). */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Highlight {
  id: string
  page: number
  rects: Rect[]
  color: string
  text?: string
}

export interface Stroke {
  id: string
  page: number
  /** Flat list of x,y pairs in page units. */
  points: number[]
  color: string
  width: number
  opacity: number
}

export interface PinNote {
  id: string
  page: number
  x: number
  y: number
  text: string
  color: string
}

export interface Bookmark {
  id: string
  page: number
  rect: Rect
  label: string
  /** Cropped snapshot (data URL) so it can be pinned on screen. */
  image: string
  pinned: boolean
}

export interface Chart {
  id: string
  name: string
  page: number
  rect: Rect
  rows: number
  cols: number
  /** 1-based row currently being worked. */
  row: number
  /** 1-based stitch within the row, in working direction. */
  stitch: number
  mode: 'row' | 'stitch'
  /** Knitting charts are usually read from the bottom up. */
  bottomUp: boolean
  /** Worked flat: right-side rows read right→left, wrong-side rows left→right. */
  flat: boolean
  /** Row 1 is a right-side row. */
  firstRowRS: boolean
  color: string
  showGrid: boolean
  dimOthers: boolean
  shadeDone: boolean
  /** Follow a project counter: chart row = ((value - 1 + offset) mod rows) + 1. */
  linkCounterId?: string
  rowOffset: number
}

export interface RowBar {
  page: number
  y: number
  h: number
  color: string
  mask: boolean
  snap: boolean
}

export interface SmartRule {
  id: string
  type: 'size' | 'term'
  color: string
  enabled: boolean
  /** size rule */
  sizeCount?: number
  sizeIndex?: number
  sizeLabels?: string[]
  /** term rule */
  term?: string
  caseSensitive?: boolean
}

export interface Markup {
  patternId: string
  highlights: Highlight[]
  strokes: Stroke[]
  notes: PinNote[]
  bookmarks: Bookmark[]
  charts: Chart[]
  rowBar: RowBar | null
  rules: SmartRule[]
  activeChartId?: string
  lastPage?: number
  showNoteLabels?: boolean
}

export function emptyMarkup(patternId: string): Markup {
  return {
    patternId,
    highlights: [],
    strokes: [],
    notes: [],
    bookmarks: [],
    charts: [],
    rowBar: null,
    rules: [],
    showNoteLabels: true,
  }
}
