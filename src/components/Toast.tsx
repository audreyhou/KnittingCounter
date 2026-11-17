import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ToastItem {
  id: number
  text: ReactNode
  kind: 'info' | 'reminder' | 'error'
}

const ToastCtx = createContext<(text: ReactNode, kind?: ToastItem['kind'], ms?: number) => void>(() => {})

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const show = useCallback((text: ReactNode, kind: ToastItem['kind'] = 'info', ms = 2600) => {
    const id = nextId++
    setItems((xs) => [...xs, { id, text, kind }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), ms)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {createPortal(
        <div className="toasts" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
