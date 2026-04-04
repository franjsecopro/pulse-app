import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmModalProps {
  isOpen: boolean
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  message,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    if (isOpen) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-500 text-xl">delete</span>
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">Confirmar eliminación</p>
            <p className="text-slate-500 text-sm mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors shadow-md shadow-red-200"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
