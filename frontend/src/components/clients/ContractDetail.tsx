import { useState } from 'react'
import { useTranslation } from '../../i18n'
import { clientService } from '../../services/client.service'
import type { Contract } from '../../types'
import { calcDuration, formatDate, formatHours } from '../../utils/formatters'
import { ContractForm } from './ContractForm'

interface ContractDetailProps {
  contract: Contract
  clientId: number
  isEditMode: boolean
  onStartEdit: () => void
  onSaveEdit: (data: Partial<Contract>) => Promise<void>
  onCancelEdit: () => void
  onClose: () => void
}

export function ContractDetail({
  contract,
  clientId,
  isEditMode,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: ContractDetailProps) {
  const { t } = useTranslation()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<number | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const [pendingDeleteFuture, setPendingDeleteFuture] = useState(false)
  const [isDeletingFuture, setIsDeletingFuture] = useState(false)
  const [deleteResult, setDeleteResult] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const hasSchedule = !!(contract.schedule_days && Object.keys(contract.schedule_days).length > 0)
  const weeklyHours = hasSchedule
    ? Object.values(contract.schedule_days ?? {}).reduce(
        (s, d) => s + calcDuration(d.start, d.end),
        0,
      )
    : 0

  const weekdays = (t('common.weekdays.short', { returnObjects: true }) as string[]).map(
    (label, i) => ({
      index: String(i),
      label,
    }),
  )

  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerateResult(null)
    setGenerateError(null)
    try {
      const { created } = await clientService.generateContractClasses(clientId, contract.id)
      setGenerateResult(created)
    } catch {
      setGenerateError(t('contracts.errors.generate'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleConfirmDeleteFuture = async () => {
    setPendingDeleteFuture(false)
    setIsDeletingFuture(true)
    setDeleteResult(null)
    setDeleteError(null)
    try {
      const { deleted } = await clientService.deleteFutureContractClasses(clientId, contract.id)
      setDeleteResult(deleted)
    } catch {
      setDeleteError(t('contracts.errors.deleteFuture'))
    } finally {
      setIsDeletingFuture(false)
    }
  }

  const actionDisabledTitle = isEditMode ? t('contracts.disabledTooltip') : undefined

  return (
    <div className='space-y-4'>
      {!isEditMode && (
        <div className='space-y-3'>
          <div>
            <p className='text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5'>
              {t('contracts.detail.description')}
            </p>
            <p className='text-sm font-semibold text-slate-900'>{contract.description}</p>
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <p className='text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5'>
                {t('contracts.detail.startDate')}
              </p>
              <p className='text-sm text-slate-700'>{formatDate(contract.start_date)}</p>
            </div>
            <div>
              <p className='text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5'>
                {t('contracts.detail.endDate')}
              </p>
              <p className='text-sm text-slate-700'>{formatDate(contract.end_date)}</p>
            </div>
            <div>
              <p className='text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5'>
                {t('contracts.detail.rate')}
              </p>
              <p className='text-sm text-slate-700'>€{contract.hourly_rate}/h</p>
            </div>
            <div>
              <p className='text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5'>
                {t('contracts.detail.status')}
              </p>
              {contract.is_active ? (
                <span className='text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full'>
                  {t('contracts.status.active')}
                </span>
              ) : (
                <span className='text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full'>
                  {t('contracts.status.inactive')}
                </span>
              )}
            </div>
          </div>
          {hasSchedule && (
            <div>
              <p className='text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1'>
                {t('contracts.detail.schedule')}
              </p>
              <div className='flex gap-1.5 flex-wrap mb-1'>
                {weekdays
                  .filter((d) => d.index in (contract.schedule_days ?? {}))
                  .map(({ index, label }) => {
                    const day = contract.schedule_days?.[index]
                    const duration = calcDuration(day.start, day.end)
                    return (
                      <span
                        key={index}
                        className='text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-md'
                      >
                        {label} · {day.start}–{day.end}{' '}
                        <span className='font-normal opacity-70'>({formatHours(duration)})</span>
                      </span>
                    )
                  })}
              </div>
              <p className='text-xs text-slate-500'>
                {t('contracts.detail.total')}{' '}
                <span className='font-bold text-slate-700'>
                  {formatHours(weeklyHours)}
                  {t('contracts.detail.perWeek')}
                </span>
                {contract.hourly_rate > 0 && (
                  <>
                    {' '}
                    ·{' '}
                    <span className='font-bold text-primary'>
                      €{(weeklyHours * contract.hourly_rate).toFixed(2)}
                      {t('contracts.detail.perWeek')}
                    </span>
                  </>
                )}
              </p>
            </div>
          )}
          {contract.phone && (
            <div>
              <p className='text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5'>
                {t('contracts.detail.studentPhone')}
              </p>
              <p className='text-sm text-slate-700'>{contract.phone}</p>
            </div>
          )}
          <div>
            <p className='text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5'>
              {t('contracts.detail.notifications')}
            </p>
            {contract.notify ? (
              <span className='text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full'>
                {t('contracts.notifications.enabled')}
              </span>
            ) : (
              <span className='text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full'>
                {t('contracts.notifications.disabled')}
              </span>
            )}
          </div>
          {contract.notes && (
            <div>
              <p className='text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5'>
                {t('contracts.detail.notes')}
              </p>
              <p className='text-sm text-slate-600'>{contract.notes}</p>
            </div>
          )}
        </div>
      )}

      {isEditMode && (
        <ContractForm initial={contract} onSave={onSaveEdit} onCancel={onCancelEdit} />
      )}

      <div className='border-t border-slate-100 pt-4 space-y-2'>
        <p className='text-xs font-bold text-slate-400 uppercase tracking-wider'>
          {t('contracts.detail.calendarActions')}
        </p>
        <div className='flex flex-wrap gap-2'>
          {hasSchedule && (
            <button
              type='button'
              onClick={handleGenerate}
              disabled={isEditMode || isGenerating}
              title={actionDisabledTitle}
              className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
            >
              {isGenerating ? (
                <span className='material-symbols-outlined text-sm animate-spin'>sync</span>
              ) : (
                <span className='material-symbols-outlined text-sm'>calendar_add_on</span>
              )}
              {t('contracts.generateClasses')}
            </button>
          )}
          <button
            type='button'
            onClick={() => {
              setPendingDeleteFuture(true)
              setDeleteResult(null)
              setDeleteError(null)
            }}
            disabled={isEditMode || isDeletingFuture}
            title={actionDisabledTitle}
            className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
          >
            {isDeletingFuture ? (
              <span className='material-symbols-outlined text-sm animate-spin'>sync</span>
            ) : (
              <span className='material-symbols-outlined text-sm'>event_busy</span>
            )}
            {t('contracts.deleteFutureClasses')}
          </button>
        </div>

        {pendingDeleteFuture && (
          <div className='flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2'>
            <span className='material-symbols-outlined text-red-400 text-sm'>warning</span>
            <p className='text-xs text-red-700 font-semibold flex-1'>
              {t('contracts.deleteFutureConfirm')}
            </p>
            <button
              type='button'
              onClick={() => setPendingDeleteFuture(false)}
              className='text-xs text-slate-500 hover:text-slate-700 font-semibold px-2 py-1 rounded hover:bg-slate-100 transition-colors'
            >
              {t('actions.cancel')}
            </button>
            <button
              type='button'
              onClick={handleConfirmDeleteFuture}
              className='text-xs text-white font-bold bg-red-500 hover:bg-red-600 px-2 py-1 rounded transition-colors'
            >
              {t('actions.delete')}
            </button>
          </div>
        )}

        {generateResult !== null && (
          <p className='text-xs text-emerald-600 font-semibold flex items-center gap-1'>
            <span className='material-symbols-outlined text-sm'>check_circle</span>
            {generateResult === 0
              ? t('contracts.generateNone')
              : t('contracts.generateResult', { count: generateResult })}
          </p>
        )}
        {generateError && (
          <p className='text-xs text-red-500 flex items-center gap-1'>
            <span className='material-symbols-outlined text-sm'>error</span>
            {generateError}
          </p>
        )}
        {deleteResult !== null && (
          <p className='text-xs text-slate-600 font-semibold flex items-center gap-1'>
            <span className='material-symbols-outlined text-sm'>check_circle</span>
            {deleteResult === 0
              ? t('contracts.deleteNone')
              : t('contracts.deleteResult', { count: deleteResult })}
          </p>
        )}
        {deleteError && (
          <p className='text-xs text-red-500 flex items-center gap-1'>
            <span className='material-symbols-outlined text-sm'>error</span>
            {deleteError}
          </p>
        )}
        {isEditMode && (
          <p className='text-xs text-slate-400 italic'>{t('contracts.saveToUseActions')}</p>
        )}
      </div>

      {!isEditMode && (
        <div className='pt-2 border-t border-slate-100'>
          <button
            type='button'
            onClick={onStartEdit}
            className='flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-primary hover:bg-primary/5 transition-colors'
          >
            <span className='material-symbols-outlined text-base'>edit</span>
            {t('contracts.edit')}
          </button>
        </div>
      )}
    </div>
  )
}
