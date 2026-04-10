import { useState, type FormEvent } from 'react'
import type { Payment, Client } from '../../types'

interface PaymentFormProps {
  initial?: Partial<Payment>
  clients: Client[]
  onSave: (data: Partial<Payment>) => Promise<void>
  onCancel: () => void
}

export function PaymentForm({ initial, clients, onSave, onCancel }: PaymentFormProps) {
  const [form, setForm] = useState({
    client_id: initial?.client_id ?? null as number | null,
    amount: initial?.amount ?? 0,
    payment_date: initial?.payment_date ?? new Date().toISOString().split('T')[0],
    concept: initial?.concept ?? '',
    source: initial?.source ?? 'manual',
    status: initial?.status ?? 'confirmed',
    notes: initial?.notes ?? '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onSave({ ...form, concept: form.concept || null, notes: form.notes || null })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Cliente</label>
          <select
            value={form.client_id ?? ''}
            onChange={e => setForm(f => ({ ...f, client_id: parseInt(e.target.value) || null }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white"
          >
            <option value="">Sin cliente (pago no identificado)</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Monto (€) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">€</span>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount || ''}
              onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha *</label>
          <input
            required
            type="date"
            value={form.payment_date}
            onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Concepto</label>
          <input
            value={form.concept}
            onChange={e => setForm(f => ({ ...f, concept: e.target.value }))}
            placeholder="Ej: Mensualidad marzo"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Estado</label>
          <select
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white"
          >
            <option value="confirmed">Confirmado</option>
            <option value="pending">Pendiente</option>
            <option value="unmatched">No identificado</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Notas</label>
          <input
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
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
          disabled={isSubmitting}
          className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-md shadow-primary/20 flex items-center gap-2"
        >
          {isSubmitting && <span className="material-symbols-outlined text-base animate-spin">sync</span>}
          Registrar pago
        </button>
      </div>
    </form>
  )
}
