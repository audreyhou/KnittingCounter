import { lazy, Suspense } from 'react'
import type { ViewerProps } from './PatternViewer'

// pdf.js is large, so the viewer is only downloaded when a pattern is opened.
const Viewer = lazy(() => import('./PatternViewer').then((m) => ({ default: m.PatternViewer })))

export function LazyPatternViewer(props: ViewerProps) {
  return (
    <Suspense
      fallback={
        <div className="viewer">
          <div className="empty">
            <div className="spinner" />
          </div>
        </div>
      }
    >
      <Viewer {...props} />
    </Suspense>
  )
}
