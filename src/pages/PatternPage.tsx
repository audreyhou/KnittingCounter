import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { getPattern } from '../db'
import { useHideNav, useMediaQuery } from '../hooks/data'
import { navigate } from '../router'
import { LazyPatternViewer as PatternViewer } from '../viewer/LazyPatternViewer'

export function PatternPage({ id }: { id: string }) {
  const [name, setName] = useState('')
  const wide = useMediaQuery('(min-width: 980px)')
  useHideNav(!wide)
  useEffect(() => {
    void getPattern(id).then((p) => setName(p?.name ?? ''))
  }, [id])
  return (
    <div className="pattern-page">
      <PatternViewer
        patternId={id}
        header={
          <div className="viewer-title">
            <button className="icon-btn" onClick={() => (history.length > 1 ? history.back() : navigate('/library'))} aria-label="Back">
              <Icon name="back" />
            </button>
            <span className="viewer-name" title={name}>
              {name}
            </span>
          </div>
        }
      />
    </div>
  )
}
