import { useCallback, useState } from 'react'
import { useTranslation } from '../../i18n'
import { clientService } from '../../services/client.service'
import type { Client, Contract } from '../../types'
import { calcDuration, formatDate, formatHours } from '../../utils/formatters'
import { Button } from '../ui/Button'
import { ConfirmationModal } from '../ui/ConfirmationModal'
import { ContractDetail } from './ContractDetail'
import { ContractForm } from './ContractForm'

interface ContractsManagerProps {
  client: Client
  onContractsChanged: (clientId: number, contracts: Contract[]) => void
  onClose: () => void
}

export function ContractsManager({ client, onContractsChanged, onClose }: ContractsManagerProps) {
  const { t } = useTranslation()
  const [contracts, setContracts] = useState<Contract[]>(client.contracts ?? [])
  const [showNewForm, setShowNewForm] = useState(false)
  const [viewingContractId, setViewingContractId] = useState<number | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [pendingDeleteContractId, setPendingDeleteContractId] = useState<number | null>(null)

  const viewingContract = contracts.find((contract) => contract.id === viewingContractId) ?? null

  const weekdays = (t('common.weekdays.short', { returnObjects: true }) as string[]).map(
    (label, i) => ({
      index: String(i),
      label,
    }),
  )

  const reload = useCallback(async () => {
    const updated = await clientService.getContracts(client.id)
    setContracts(updated)
    onContractsChanged(client.id, updated)
  }, [client.id, onContractsChanged]) // eslint-disable-line react-hooks/exhaustive-deps

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
      data as Omit<Contract, 'id' | 'clientId' | 'createdAt'>,
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
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <p className='text-slate-500 text-sm'>
          {t('contracts.manager.title', { name: client.name })}
        </p>
        <Button
          type='button'
          onClick={() => {
            setShowNewForm(true)
            closeDetail()
          }}
          className='flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-hover transition-colors'
        >
          <span className='material-symbols-outlined text-base'>add</span> {t('actions.new')}
        </Button>
      </div>

      {showNewForm && (
        <div className='bg-slate-50 rounded-xl border border-slate-200 p-4'>
          <p className='text-xs font-bold text-slate-500 uppercase tracking-wide mb-3'>
            {t('contracts.new')}
          </p>
          <ContractForm onSave={handleCreate} onCancel={() => setShowNewForm(false)} />
        </div>
      )}

      {contracts.length === 0 && !showNewForm ? (
        <div className='text-center py-8 text-slate-400'>
          <span className='material-symbols-outlined text-3xl block mb-2'>description</span>
          {t('contracts.manager.empty')}
        </div>
      ) : (
        <div className='space-y-2'>
          {contracts.map((contract) => (
            <div key={contract.id}>
              <div
                className={`flex items-center justify-between gap-4 p-4 border transition-colors ${
                  viewingContractId === contract.id
                    ? 'rounded-t-xl border-primary/30 bg-primary/5'
                    : contract.isActive
                      ? 'rounded-xl border-slate-200 bg-white'
                      : 'rounded-xl border-slate-100 bg-slate-50 opacity-60'
                }`}
              >
                <div className='min-w-0 flex-1'>
                  <p className='font-semibold text-slate-900 text-sm'>{contract.description}</p>
                  <p className='text-xs text-slate-500'>
                    €{contract.hourlyRate}/h ·{' '}
                    {t('contracts.manager.since', {
                      date: formatDate(contract.startDate),
                    })}
                    {contract.endDate
                      ? ` ${t('contracts.manager.until', { date: formatDate(contract.endDate) })}`
                      : ''}
                  </p>
                  {contract.scheduleDays && Object.keys(contract.scheduleDays).length > 0 && (
                    <p className='text-xs text-primary/70 mt-0.5'>
                      {weekdays
                        .filter((d) => d.index in (contract.scheduleDays ?? {}))
                        .map((d) => d.label)
                        .join(', ')}
                      {' · '}
                      {formatHours(
                        Object.values(contract.scheduleDays).reduce(
                          (sum, d) => sum + calcDuration(d.start, d.end),
                          0,
                        ),
                      )}
                      /semana
                    </p>
                  )}
                </div>
                <div className='flex items-center gap-2 shrink-0'>
                  {contract.isActive ? (
                    <span className='text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full'>
                      {t('contracts.status.active')}
                    </span>
                  ) : (
                    <span className='text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full'>
                      {t('contracts.status.inactive')}
                    </span>
                  )}
                  <Button
                    type='button'
                    onClick={() =>
                      viewingContractId === contract.id ? closeDetail() : openDetail(contract.id)
                    }
                    className={`p-1.5 rounded-lg transition-colors ${
                      viewingContractId === contract.id
                        ? 'text-primary bg-primary/10'
                        : 'text-slate-400 hover:text-primary hover:bg-primary/5'
                    }`}
                    title={t('contracts.viewDetail')}
                  >
                    <span className='material-symbols-outlined text-base'>
                      {viewingContractId === contract.id ? 'expand_less' : 'expand_more'}
                    </span>
                  </Button>
                  <Button
                    type='button'
                    onClick={() => setPendingDeleteContractId(contract.id)}
                    className='p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                    title={t('contracts.deleteTooltip')}
                  >
                    <span className='material-symbols-outlined text-base'>delete</span>
                  </Button>
                </div>
              </div>

              {viewingContractId === contract.id && viewingContract && (
                <div className='bg-slate-50 rounded-b-xl border-x border-b border-primary/30 p-4'>
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

      <div className='flex justify-end pt-2'>
        <Button
          type='button'
          onClick={onClose}
          className='px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors'
        >
          {t('actions.close')}
        </Button>
      </div>

      <ConfirmationModal
        isOpen={pendingDeleteContractId !== null}
        variant='danger'
        message={t('contracts.deleteConfirmMessage')}
        onConfirm={confirmDeleteContract}
        onCancel={() => setPendingDeleteContractId(null)}
      />
    </div>
  )
}
