import { useState, type FormEvent } from 'react'
import type { ClassSession, ClassStatus, Client, Contract } from '../../types'

interface ClassFormProps {
  initial?: Partial<ClassSession>
  clients: Client[]
  onSave: (data: Partial<ClassSession>) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}

export function ClassForm({ initial, clients, onSave, onCancel, onDelete }: ClassFormProps) {
  const [selectedClientId, setSelectedClientId] = useState<number | ''>(initial?.client_id ?? '')
  const [form, setForm] = useState({
    contract_id: initial?.contract_id ?? null,
    class_date: initial?.class_date ?? new Date().toISOString().split('T')[0],
    class_time: initial?.class_time ?? '',
    duration_hours: initial?.duration_hours ?? 1,
    hourly_rate: initial?.hourly_rate ?? 0,
    status: (initial?.status ?? 'normal') as ClassStatus,
    notes: initial?.notes ?? '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedClient = clients.find((c) => c.id === selectedClientId)
  const activeContracts: Contract[] = selectedClient?.contracts?.filter((c) => c.is_active) ?? []

  const handleClientChange = (clientId: string) => {
    const cid = parseInt(clientId) || ''
    setSelectedClientId(cid)
    const client = clients.find((c) => c.id === cid)
    const contracts = client?.contracts?.filter((c) => c.is_active) ?? []
    if (contracts.length === 1) {
      setForm((f) => ({ ...f, contract_id: contracts[0].id, hourly_rate: contracts[0].hourly_rate }))
    } else {
      setForm((f) => ({ ...f, contract_id: null }))
    }
  }

  const handleContractChange = (contractId: string) => {
    const cid = contractId ? parseInt(contractId) : null
    setForm((f) => {
      const contract = activeContracts.find((c) => c.id === cid)
      return { ...f, contract_id: cid, hourly_rate: contract?.hourly_rate ?? f.hourly_rate }
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedClientId) { setError('Selecciona un cliente'); return }
    if (activeContracts.length > 1 && !form.contract_id) {
      setError('Este cliente tiene varios contratos. Selecciona uno.')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      await onSave({ client_id: selectedClientId as number, ...form, class_time: form.class_time || null })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalAmount = form.duration_hours * form.hourly_rate

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Cliente *</label>
          <select
            required
            value={selectedClientId}
            onChange={(e) => handleClientChange(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white"
          >
            <option value="">Seleccionar cliente</option>
            {clients.filter((c) => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {activeContracts.length === 1 && (
          <div className="sm:col-span-2">
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              Contrato: <span className="font-semibold text-slate-700">{activeContracts[0].description}</span> — €{activeContracts[0].hourly_rate}/h
            </p>
          </div>
        )}
        {activeContracts.length > 1 && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Contrato <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.contract_id ?? ''}
              onChange={(e) => handleContractChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white"
            >
              <option value="">Seleccionar contrato...</option>
              {activeContracts.map((c) => (
                <option key={c.id} value={c.id}>{c.description} — €{c.hourly_rate}/h</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha *</label>
          <input
            required
            type="date"
            value={form.class_date}
            onChange={(e) => setForm((f) => ({ ...f, class_date: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Hora</label>
          <input
            type="time"
            value={form.class_time}
            onChange={(e) => setForm((f) => ({ ...f, class_time: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Duración (horas) *</label>
          <input
            required
            type="number"
            step="0.5"
            min="0.5"
            value={form.duration_hours}
            onChange={(e) => setForm((f) => ({ ...f, duration_hours: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Tarifa €/hora *</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={form.hourly_rate}
            onChange={(e) => setForm((f) => ({ ...f, hourly_rate: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Estado de la clase</label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ClassStatus }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white"
          >
            <option value="normal">Normal — clase celebrada</option>
            <option value="cancelled_with_payment">Cancelada con pago (menos de 24h)</option>
            <option value="cancelled_without_payment">Cancelada sin pago (más de 24h)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Notas</label>
          <input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
          />
        </div>
      </div>
      {form.duration_hours > 0 && form.hourly_rate > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm text-slate-600 font-medium">Total de la clase</span>
          <span className="text-primary font-black text-xl">€{totalAmount.toFixed(2)}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 pt-2">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60 flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">delete</span>
            Eliminar clase
          </button>
        ) : <span />}
        <div className="flex gap-3">
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
            {isSubmitting && (
              <span className="material-symbols-outlined text-base animate-spin">sync</span>
            )}
            Guardar clase
          </button>
        </div>
      </div>
    </form>
  )
}
