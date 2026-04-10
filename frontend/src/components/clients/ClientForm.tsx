import { useState, type FormEvent } from 'react'
import type { Client } from '../../types'

interface ClientFormProps {
  initial?: Partial<Client>
  onSave: (data: Partial<Client>) => Promise<void>
  onCancel: () => void
}

export function ClientForm({ initial, onSave, onCancel }: ClientFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    whatsapp_phone: initial?.whatsapp_phone ?? '',
    address: initial?.address ?? '',
    is_active: initial?.is_active ?? true,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!initial?.id
  const isDirty = !isEditing || (
    form.name           !== (initial?.name           ?? '') ||
    form.email          !== (initial?.email          ?? '') ||
    form.phone          !== (initial?.phone          ?? '') ||
    form.whatsapp_phone !== (initial?.whatsapp_phone ?? '') ||
    form.address        !== (initial?.address        ?? '') ||
    form.is_active !== (initial?.is_active ?? true)
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onSave(form)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Nombre *
          </label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Teléfono
          </label>
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            WhatsApp
          </label>
          <input
            placeholder="+34 600 000 000"
            value={form.whatsapp_phone}
            onChange={(e) => setForm((f) => ({ ...f, whatsapp_phone: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
          <p className="text-xs text-slate-400 mt-1">Número para recordatorios automáticos</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Dirección
          </label>
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <input
            type="checkbox"
            id="is_active"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            className="w-4 h-4 accent-primary"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
            Cliente activo
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20 flex items-center gap-2"
        >
          {isSubmitting && (
            <span className="material-symbols-outlined text-base animate-spin">sync</span>
          )}
          {isEditing && !isDirty ? 'Sin cambios' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
