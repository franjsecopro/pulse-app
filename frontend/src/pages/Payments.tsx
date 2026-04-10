import { useState, useEffect } from 'react'
import { Modal } from '../components/ui/Modal'
import { PaymentForm } from '../components/payments/PaymentForm'
import { PdfImportModal } from '../components/payments/PdfImportModal'
import { PdfHistoryView } from '../components/payments/PdfHistoryView'
import { PAYMENT_STATUS_CONFIG } from '../components/payments/constants'
import { MONTHS } from '../utils/constants'
import { usePayments } from '../hooks/usePayments'
import type { Payment } from '../types'

export function Payments() {
  const now = new Date()

  const [activeTab, setActiveTab] = useState<'payments' | 'pdf-history'>('payments')
  const [filterMonth, setFilterMonth] = useState<number | ''>('')
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [filterClient, setFilterClient] = useState<number | ''>('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)

  const {
    payments, clients, pdfHistory, isLoading, isPdfHistoryLoading, totalAmount,
    loadPdfHistory, createPayment, updatePayment, deletePayment, handleImported,
  } = usePayments({ filterMonth, filterYear, filterClient, filterStatus })

  useEffect(() => {
    if (activeTab === 'pdf-history') loadPdfHistory()
  }, [activeTab, loadPdfHistory])

  const handleCreate = async (data: Partial<Payment>) => {
    await createPayment(data as Parameters<typeof createPayment>[0])
    setShowCreateModal(false)
  }

  const handleUpdate = async (data: Partial<Payment>) => {
    if (!editingPayment) return
    await updatePayment(editingPayment.id, data)
    setEditingPayment(null)
  }

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Pagos</h1>
          <p className="text-slate-500 text-sm mt-1">Gestión y seguimiento de cobros.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border border-slate-200"
          >
            <span className="material-symbols-outlined text-base">upload_file</span>
            Importar PDF
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 transition-all"
          >
            <span className="material-symbols-outlined">add</span>
            Nuevo pago
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(['payments', 'pdf-history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'payments' ? 'Pagos' : 'PDFs importados'}
          </button>
        ))}
      </div>

      {activeTab === 'pdf-history' && (
        <PdfHistoryView records={pdfHistory} isLoading={isPdfHistoryLoading} />
      )}

      {activeTab === 'payments' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(parseInt(e.target.value) || '')}
              className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary"
            >
              <option value="">Todos los meses</option>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            {filterMonth !== '' && (
              <select
                value={filterYear}
                onChange={e => setFilterYear(parseInt(e.target.value))}
                className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            <select
              value={filterClient}
              onChange={e => setFilterClient(parseInt(e.target.value) || '')}
              className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary"
            >
              <option value="">Todos los clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary"
            >
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
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-primary text-sm font-semibold hover:underline"
              >
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
                      const status = PAYMENT_STATUS_CONFIG[p.status] ?? PAYMENT_STATUS_CONFIG.pending
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
                              <button
                                onClick={() => setEditingPayment(p)}
                                className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                              >
                                <span className="material-symbols-outlined text-base">edit</span>
                              </button>
                              <button
                                onClick={() => deletePayment(p.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
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
        </>
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
          onImported={handleImported}
        />
      </Modal>
    </div>
  )
}
