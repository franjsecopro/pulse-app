import { useState, useEffect, useCallback, useRef, type FormEvent, type ChangeEvent } from 'react'
import { paymentService } from '../services/payment.service'
import { clientService } from '../services/client.service'
import { api } from '../services/api'
import { Modal } from '../components/ui/Modal'
import type { Payment, Client } from '../types'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// --- Payment Form ---
function PaymentForm({
  initial,
  clients,
  onSave,
  onCancel,
}: {
  initial?: Partial<Payment>
  clients: Client[]
  onSave: (data: Partial<Payment>) => Promise<void>
  onCancel: () => void
}) {
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
          <select value={form.client_id ?? ''} onChange={e => setForm(f => ({ ...f, client_id: parseInt(e.target.value) || null }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white">
            <option value="">Sin cliente (pago no identificado)</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Monto (€) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">€</span>
            <input required type="number" step="0.01" min="0.01" value={form.amount || ''}
              onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha *</label>
          <input required type="date" value={form.payment_date}
            onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Concepto</label>
          <input value={form.concept} onChange={e => setForm(f => ({ ...f, concept: e.target.value }))}
            placeholder="Ej: Mensualidad marzo"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Estado</label>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white">
            <option value="confirmed">Confirmado</option>
            <option value="pending">Pendiente</option>
            <option value="unmatched">No identificado</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-slate-700 mb-1">Notas</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting}
          className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-md shadow-primary/20 flex items-center gap-2">
          {isSubmitting && <span className="material-symbols-outlined text-base animate-spin">sync</span>}
          Registrar pago
        </button>
      </div>
    </form>
  )
}

// --- PDF Import types ---
interface ParsedRow {
  date: string
  concept: string
  amount: number
  suggested_client_id: number | null
  suggested_client_name: string | null
  match_type: string
  confidence: number
  // user overrides
  selected_client_id: number | null
  skip: boolean
}

// --- PDF Import Modal ---
function PdfImportModal({
  clients,
  onClose,
  onImported,
}: {
  clients: Client[]
  onClose: () => void
  onImported: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    setIsParsing(true)
    setRows([])

    try {
      const formData = new FormData()
      formData.append('file', file)

      const { accessToken } = api.getStoredTokens()
      const response = await fetch('/api/imports/pdf', {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.detail ?? 'Error al parsear el PDF')
      }

      setRows((data as ParsedRow[]).map(r => ({
        ...r,
        selected_client_id: r.suggested_client_id,
        skip: false,
      })))
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsParsing(false)
    }
  }

  const handleConfirm = async () => {
    const toImport = rows.filter(r => !r.skip)
    if (toImport.length === 0) return

    setIsConfirming(true)
    try {
      await api.post('/imports/pdf/confirm', {
        payments: toImport.map(r => ({
          date: r.date,
          concept: r.concept,
          amount: r.amount,
          client_id: r.selected_client_id,
        })),
      })
      onImported()
      onClose()
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setIsConfirming(false)
    }
  }

  const toImportCount = rows.filter(r => !r.skip).length
  const totalAmount = rows.filter(r => !r.skip).reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      {rows.length === 0 && (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">upload_file</span>
          <p className="text-slate-600 font-semibold text-sm">
            {isParsing ? 'Procesando PDF...' : 'Haz clic para seleccionar el PDF'}
          </p>
          <p className="text-slate-400 text-xs mt-1">Extracto de cuenta Hello Bank / BNP Paribas</p>
          {fileName && <p className="text-primary text-xs mt-2 font-medium">{fileName}</p>}
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {isParsing && (
        <div className="flex items-center justify-center gap-2 py-6">
          <span className="material-symbols-outlined animate-spin text-primary">sync</span>
          <span className="text-sm text-slate-500">Analizando PDF...</span>
        </div>
      )}

      {parseError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {parseError}
          <button onClick={() => { setParseError(null); setFileName(null); fileRef.current && (fileRef.current.value = '') }}
            className="ml-2 text-red-500 underline text-xs">Intentar de nuevo</button>
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <strong>{rows.length}</strong> transacciones encontradas en <span className="text-primary">{fileName}</span>
            </p>
            <button onClick={() => { setRows([]); setFileName(null); fileRef.current && (fileRef.current.value = '') }}
              className="text-xs text-slate-400 hover:text-slate-600 underline">Cambiar archivo</button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Concepto banco</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Importe</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">Importar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <tr key={i} className={row.skip ? 'opacity-40' : ''}>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.date}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[220px]">
                      <span className="truncate block" title={row.concept}>{row.concept}</span>
                      {row.match_type !== 'none' && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${row.match_type === 'exact' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {row.match_type === 'exact' ? 'Exacto' : `Parcial ${Math.round(row.confidence * 100)}%`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">€{row.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={row.selected_client_id ?? ''}
                        onChange={e => setRows(prev => prev.map((r, j) =>
                          j === i ? { ...r, selected_client_id: parseInt(e.target.value) || null } : r
                        ))}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:border-primary outline-none w-full"
                        disabled={row.skip}
                      >
                        <option value="">Sin asignar</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={!row.skip}
                        onChange={e => setRows(prev => prev.map((r, j) =>
                          j === i ? { ...r, skip: !e.target.checked } : r
                        ))}
                        className="w-4 h-4 accent-primary"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary + Confirm */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-slate-600">
              <span className="font-bold text-primary">{toImportCount}</span> pagos · <span className="font-bold">€{totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConfirming || toImportCount === 0}
                className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {isConfirming && <span className="material-symbols-outlined text-base animate-spin">sync</span>}
                Confirmar importación ({toImportCount})
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// --- Status config ---
const statusConfig: Record<string, { label: string; className: string; icon: string }> = {
  confirmed: { label: 'Confirmado', className: 'bg-emerald-100 text-emerald-700', icon: 'check_circle' },
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700', icon: 'schedule' },
  unmatched: { label: 'Sin identificar', className: 'bg-slate-100 text-slate-600', icon: 'help' },
}

// --- Main Page ---
export function Payments() {
  const now = new Date()
  const [payments, setPayments] = useState<Payment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState<number | ''>('')
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [filterClient, setFilterClient] = useState<number | ''>('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)

  const loadPayments = useCallback(async () => {
    setIsLoading(true)
    const data = await paymentService.getAll({
      month: filterMonth || undefined,
      year: filterMonth ? filterYear : undefined,
      client_id: filterClient || undefined,
      status: filterStatus || undefined,
    })
    setPayments(data)
    setIsLoading(false)
  }, [filterMonth, filterYear, filterClient, filterStatus])

  useEffect(() => { clientService.getAll().then(setClients) }, [])
  useEffect(() => { loadPayments() }, [loadPayments])

  const handleCreate = async (data: Partial<Payment>) => {
    await paymentService.create(data as Parameters<typeof paymentService.create>[0])
    setShowCreateModal(false)
    loadPayments()
  }

  const handleUpdate = async (data: Partial<Payment>) => {
    if (!editingPayment) return
    await paymentService.update(editingPayment.id, data)
    setEditingPayment(null)
    loadPayments()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este pago?')) return
    await paymentService.delete(id)
    loadPayments()
  }

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Pagos</h1>
          <p className="text-slate-500 text-sm mt-1">Gestión y seguimiento de cobros.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border border-slate-200">
            <span className="material-symbols-outlined text-base">upload_file</span>
            Importar PDF
          </button>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all">
            <span className="material-symbols-outlined">add</span>
            Nuevo pago
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value) || '')}
          className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary">
          <option value="">Todos los meses</option>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        {filterMonth !== '' && (
          <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}
            className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <select value={filterClient} onChange={e => setFilterClient(parseInt(e.target.value) || '')}
          className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary">
          <option value="">Todos los clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary">
          <option value="">Todos los estados</option>
          <option value="confirmed">Confirmados</option>
          <option value="pending">Pendientes</option>
          <option value="unmatched">Sin identificar</option>
        </select>
        {payments.length > 0 && (
          <div className="ml-auto bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 text-sm font-bold text-primary">
            Total: €{totalAmount.toFixed(2)}
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin">sync</span>
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">payments</span>
          <p className="text-slate-500 font-medium">No hay pagos registrados</p>
          <button onClick={() => setShowCreateModal(true)}
            className="mt-4 text-primary text-sm font-semibold hover:underline">
            Registrar primer pago
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Concepto</th>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-slate-500 text-xs font-bold uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-right text-slate-500 text-xs font-bold uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => {
                  const status = statusConfig[p.status] ?? statusConfig.pending
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                            {(p.client_name ?? '?').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900">{p.client_name ?? 'Sin cliente'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{p.concept ?? '—'}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">€{p.amount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-slate-500">{p.payment_date}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${status.className}`}>
                          <span className="material-symbols-outlined text-[12px]">{status.icon}</span>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditingPayment(p)}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button onClick={() => handleDelete(p.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Registrar pago">
        <PaymentForm clients={clients} onSave={handleCreate} onCancel={() => setShowCreateModal(false)} />
      </Modal>

      <Modal isOpen={!!editingPayment} onClose={() => setEditingPayment(null)} title="Editar pago">
        {editingPayment && (
          <PaymentForm
            initial={editingPayment}
            clients={clients}
            onSave={handleUpdate}
            onCancel={() => setEditingPayment(null)}
          />
        )}
      </Modal>

      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} title="Importar extracto bancario" size="lg">
        <PdfImportModal
          clients={clients}
          onClose={() => setShowImportModal(false)}
          onImported={loadPayments}
        />
      </Modal>
    </div>
  )
}
