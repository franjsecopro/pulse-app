import { useState, useCallback } from 'react'
import type { Client, Contract } from '../../types'
import { clientService } from '../../services/client.service'
import { formatDate, calcDuration, formatHours } from '../../utils/formatters'
import { WEEKDAYS } from './constants'
import { ContractForm } from './ContractForm'
import { ContractDetail } from './ContractDetail'
import { ConfirmModal } from '../ui/ConfirmModal'

interface ContractsManagerProps {
  client: Client
  onContractsChanged: (clientId: number, contracts: Contract[]) => void
  onClose: () => void
}

export function ContractsManager({ client, onContractsChanged, onClose }: ContractsManagerProps) {
  const [contracts, setContracts] = useState<Contract[]>(client.contracts ?? [])
  const [showNewForm, setShowNewForm] = useState(false)
  const [viewingContractId, setViewingContractId] = useState<number | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [pendingDeleteContractId, setPendingDeleteContractId] = useState<number | null>(null)

  const viewingContract = contracts.find(c => c.id === viewingContractId) ?? null

  const reload = useCallback(async () => {
    const updated = await clientService.getContracts(client.id)
    setContracts(updated)
    onContractsChanged(client.id, updated)
  }, [client.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = (contractId: number) => {
    setViewingContractId(contractId)
    setIsEditMode(false)
    setShowNewForm(false)
  }

  const closeDetail = () => {
    setViewingContractId(null)
    setIsEditMode(false)
  }

  const handleCreate = async (data: Partial<Contract>) => {
    await clientService.createContract(
      client.id,
      data as Omit<Contract, 'id' | 'client_id' | 'created_at'>,
    )
    await reload()
    setShowNewForm(false)
  }

  const handleUpdate = async (data: Partial<Contract>) => {
    if (!viewingContractId) return
    await clientService.updateContract(client.id, viewingContractId, data)
    await reload()
    setIsEditMode(false)
  }

  const confirmDeleteContract = async () => {
    if (!pendingDeleteContractId) return
    await clientService.deleteContract(client.id, pendingDeleteContractId)
    setPendingDeleteContractId(null)
    if (viewingContractId === pendingDeleteContractId) closeDetail()
    await reload()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">
          Contratos de <strong>{client.name}</strong>
        </p>
        <button
          onClick={() => { setShowNewForm(true); closeDetail() }}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover transition-colors"
        >
          <span className="material-symbols-outlined text-base">add</span> Nuevo
        </button>
      </div>

      {showNewForm && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Nuevo contrato</p>
          <ContractForm
            onSave={handleCreate}
            onCancel={() => setShowNewForm(false)}
          />
        </div>
      )}

      {contracts.length === 0 && !showNewForm ? (
        <div className="text-center py-8 text-slate-400">
          <span className="material-symbols-outlined text-3xl block mb-2">description</span>
          No hay contratos. Añade uno para empezar.
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => (
            <div key={c.id}>
              <div
                className={`flex items-center justify-between gap-4 p-4 border transition-colors ${
                  viewingContractId === c.id
                    ? 'rounded-t-xl border-primary/30 bg-primary/5'
                    : c.is_active
                      ? 'rounded-xl border-slate-200 bg-white'
                      : 'rounded-xl border-slate-100 bg-slate-50 opacity-60'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 text-sm">{c.description}</p>
                  <p className="text-xs text-slate-500">
                    €{c.hourly_rate}/h · Desde {formatDate(c.start_date)}
                    {c.end_date ? ` hasta ${formatDate(c.end_date)}` : ''}
                  </p>
                  {c.schedule_days && Object.keys(c.schedule_days).length > 0 && (
                    <p className="text-xs text-primary/70 mt-0.5">
                      {WEEKDAYS.filter(d => d.index in c.schedule_days!).map(d => d.label).join(', ')}
                      {' · '}
                      {formatHours(Object.values(c.schedule_days).reduce((s, d) => s + calcDuration(d.start, d.end), 0))}/semana
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.is_active
                    ? <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Activo</span>
                    : <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Inactivo</span>
                  }
                  <button
                    onClick={() => viewingContractId === c.id ? closeDetail() : openDetail(c.id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewingContractId === c.id
                        ? 'text-primary bg-primary/10'
                        : 'text-slate-400 hover:text-primary hover:bg-primary/5'
                    }`}
                    title="Ver detalle"
                  >
                    <span className="material-symbols-outlined text-base">
                      {viewingContractId === c.id ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  <button
                    onClick={() => setPendingDeleteContractId(c.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar contrato"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>

              {viewingContractId === c.id && viewingContract && (
                <div className="bg-slate-50 rounded-b-xl border-x border-b border-primary/30 p-4">
                  <ContractDetail
                    contract={viewingContract}
                    clientId={client.id}
                    isEditMode={isEditMode}
                    onStartEdit={() => setIsEditMode(true)}
                    onSaveEdit={handleUpdate}
                    onCancelEdit={() => setIsEditMode(false)}
                    onClose={closeDetail}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Cerrar
        </button>
      </div>

      <ConfirmModal
        isOpen={pendingDeleteContractId !== null}
        message="¿Eliminar este contrato? Esta acción no se puede deshacer."
        onConfirm={confirmDeleteContract}
        onCancel={() => setPendingDeleteContractId(null)}
      />
    </div>
  )
}
