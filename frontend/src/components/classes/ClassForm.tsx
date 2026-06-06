import { type FormEvent, useState } from 'react'
import { useTranslation } from '../../i18n'
import type { ClassSession, ClassStatus, Client, Contract } from '../../types'
import { Button } from '../ui/Button'

interface ClassFormProps {
  initial?: Partial<ClassSession>
  clients: Client[]
  onSave: (data: Partial<ClassSession>) => Promise<void>
  onCancel: () => void
  onDelete?: () => Promise<void>
}

export function ClassForm({ initial, clients, onSave, onCancel, onDelete }: ClassFormProps) {
  const { t } = useTranslation()
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
    const cid = parseInt(clientId, 10) || ''
    setSelectedClientId(cid)
    const client = clients.find((c) => c.id === cid)
    const contracts = client?.contracts?.filter((c) => c.is_active) ?? []
    if (contracts.length === 1) {
      setForm((f) => ({
        ...f,
        contract_id: contracts[0].id,
        hourly_rate: contracts[0].hourly_rate,
      }))
    } else {
      setForm((f) => ({ ...f, contract_id: null }))
    }
  }

  const handleContractChange = (contractId: string) => {
    const cid = contractId ? parseInt(contractId, 10) : null
    setForm((f) => {
      const contract = activeContracts.find((c) => c.id === cid)
      return { ...f, contract_id: cid, hourly_rate: contract?.hourly_rate ?? f.hourly_rate }
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedClientId) {
      setError(t('classes.errors.selectClient'))
      return
    }
    if (activeContracts.length > 1 && !form.contract_id) {
      setError(t('classes.errors.multipleContracts'))
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      await onSave({
        client_id: selectedClientId as number,
        ...form,
        class_time: form.class_time || null,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.save'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalAmount = form.duration_hours * form.hourly_rate

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {error && (
        <div className='p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm'>
          {error}
        </div>
      )}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='sm:col-span-2'>
          <label htmlFor='client' className='block text-sm font-semibold text-slate-700 mb-1'>
            {t('classes.form.client')} *
          </label>
          <select
            required
            id='client'
            value={selectedClientId}
            onChange={(e) => handleClientChange(e.target.value)}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white'
          >
            <option value=''>{t('classes.form.selectClientPlaceholder')}</option>
            {clients
              .filter((c) => c.is_active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        {activeContracts.length === 1 && (
          <div className='sm:col-span-2'>
            <p className='text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2'>
              {t('classes.form.contractInfo', {
                rate: activeContracts[0].hourly_rate,
                duration: form.duration_hours,
              })}
            </p>
          </div>
        )}
        {activeContracts.length > 1 && (
          <div className='sm:col-span-2'>
            <label htmlFor='contract' className='block text-sm font-semibold text-slate-700 mb-1'>
              {t('classes.form.contract')} <span className='text-red-500'>*</span>
            </label>
            <select
              required
              id='contract'
              value={form.contract_id ?? ''}
              onChange={(e) => handleContractChange(e.target.value)}
              className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white'
            >
              <option value=''>{t('classes.form.selectContractPlaceholder')}</option>
              {activeContracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.description} — €{c.hourly_rate}/h
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor='class-date' className='block text-sm font-semibold text-slate-700 mb-1'>
            {t('classes.form.date')} *
          </label>
          <input
            required
            type='date'
            lang='es-ES'
            id='class-date'
            value={form.class_date}
            onChange={(e) => setForm((f) => ({ ...f, class_date: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
        <div>
          <label htmlFor='class-time' className='block text-sm font-semibold text-slate-700 mb-1'>
            {t('classes.form.time')}
          </label>
          <input
            type='time'
            id='class-time'
            value={form.class_time}
            onChange={(e) => setForm((f) => ({ ...f, class_time: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
        <div>
          <label htmlFor='duration' className='block text-sm font-semibold text-slate-700 mb-1'>
            {t('classes.form.duration')} *
          </label>
          <input
            required
            id='duration'
            type='number'
            step='0.5'
            min='0.5'
            value={form.duration_hours}
            onChange={(e) =>
              setForm((f) => ({ ...f, duration_hours: parseFloat(e.target.value) || 0 }))
            }
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
        <div>
          <label htmlFor='rate' className='block text-sm font-semibold text-slate-700 mb-1'>
            {t('classes.form.rate')} *
          </label>
          <input
            required
            id='rate'
            type='number'
            step='0.01'
            min='0'
            value={form.hourly_rate}
            onChange={(e) =>
              setForm((f) => ({ ...f, hourly_rate: parseFloat(e.target.value) || 0 }))
            }
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
        <div className='sm:col-span-2'>
          <label htmlFor='status' className='block text-sm font-semibold text-slate-700 mb-1'>
            {t('classes.form.statusLabel')}
          </label>
          <select
            id='status'
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ClassStatus }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white'
          >
            <option value='normal'>{t('classes.status.normalDesc')}</option>
            <option value='cancelled_with_payment'>
              {t('classes.status.cancelledPaymentDesc')}
            </option>
            <option value='cancelled_without_payment'>
              {t('classes.status.cancelledNoPaymentDesc')}
            </option>
          </select>
        </div>
        <div className='sm:col-span-2'>
          <label htmlFor='notes' className='block text-sm font-semibold text-slate-700 mb-1'>
            {t('classes.form.notes')}
          </label>
          <input
            id='notes'
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
      </div>
      {form.duration_hours > 0 && form.hourly_rate > 0 && (
        <div className='bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between'>
          <span className='text-sm text-slate-600 font-medium'>{t('classes.form.total')}</span>
          <span className='text-primary font-black text-xl'>€{totalAmount.toFixed(2)}</span>
        </div>
      )}
      <div className='flex items-center justify-between gap-3 pt-2'>
        {onDelete ? (
          <Button
            type='button'
            onClick={onDelete}
            loading={isSubmitting}
            className='px-4 py-2 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60 flex items-center gap-1.5'
          >
            <span className='material-symbols-outlined text-base'>delete</span>
            {t('classes.delete')}
          </Button>
        ) : (
          <span />
        )}
        <div className='flex gap-3'>
          <Button
            type='button'
            onClick={onCancel}
            className='px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors'
          >
            {t('actions.cancel')}
          </Button>
          <Button
            type='submit'
            loading={isSubmitting}
            className='px-6 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-md shadow-primary/20 flex items-center gap-2'
          >
            {isSubmitting && (
              <span className='material-symbols-outlined text-base animate-spin'>sync</span>
            )}
            {t('classes.save')}
          </Button>
        </div>
      </div>
    </form>
  )
}
