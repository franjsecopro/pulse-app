import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TOAST_DURATION_MS = 4000

const CONFIG: Record<ToastType, { icon: string; bar: string; text: string }> = {
  success: { icon: 'check_circle', bar: 'bg-emerald-500', text: 'text-emerald-600' },
  error:   { icon: 'error',        bar: 'bg-red-500',     text: 'text-red-600'     },
  warning: { icon: 'warning',      bar: 'bg-amber-500',   text: 'text-amber-600'   },
  info:    { icon: 'info',         bar: 'bg-primary',     text: 'text-primary'     },
}

// ─── Single toast item ────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const { icon, bar, text } = CONFIG[toast.type]

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div className="relative flex items-start gap-3 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 min-w-[280px] max-w-sm overflow-hidden">
      {/* Colored left bar */}
      <div className={`absolute left-0 inset-y-0 w-1 rounded-l-xl ${bar}`} />

      <span className={`material-symbols-outlined text-xl shrink-0 mt-0.5 ${text}`}>
        {icon}
      </span>

      <p className="text-sm font-medium text-slate-800 flex-1 leading-snug pt-0.5">
        {toast.message}
      </p>

      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors mt-0.5"
        aria-label="Cerrar"
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  )
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, type, message }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast container — top-right, above everything */}
      <div
        className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
