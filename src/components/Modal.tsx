import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ColorDots({
  colors,
  value,
  onChange,
  size = 28,
}: {
  colors: string[]
  value: string
  onChange: (c: string) => void
  size?: number
}) {
  return (
    <div className="color-dots" role="radiogroup">
      {colors.map((c) => (
        <button
          key={c}
          role="radio"
          aria-checked={c === value}
          aria-label={`Color ${c}`}
          className={`color-dot ${c === value ? 'selected' : ''}`}
          style={{ background: c, width: size, height: size }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  )
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max,
  label,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  label?: string
}) {
  const clamp = (n: number) => Math.max(min, max !== undefined ? Math.min(max, n) : n)
  return (
    <div className="stepper">
      <button type="button" className="icon-btn" aria-label={`Decrease ${label ?? ''}`} onClick={() => onChange(clamp(value - 1))}>
        <Icon name="minus" size={18} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ''}
        aria-label={label}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10)
          if (!Number.isNaN(n)) onChange(clamp(n))
        }}
      />
      <button type="button" className="icon-btn" aria-label={`Increase ${label ?? ''}`} onClick={() => onChange(clamp(value + 1))}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  )
}
