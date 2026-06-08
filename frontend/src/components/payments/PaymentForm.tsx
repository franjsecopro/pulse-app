import { type FormEvent, useState } from 'react'
import { useTranslation } from '../../i18n'
import type { Client, Payment } from '../../types'
import { Button } from '../ui/Button'

interface PaymentFormProps {
  initial?: Partial<Payment>
  clients: Client[]
  onSave: (data: Partial<Payment>) => Promise<void>
  onCancel: () => void
}

export function PaymentForm({ initial, clients, onSave, onCancel }: PaymentFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    clientId: initial?.clientId ?? (null as number | null),
    amount: initial?.amount ?? 0,
    paymentDate: initial?.paymentDate ?? new Date().toISOString().split('T')[0],
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
      await onSave({
        ...form,
        concept: form.concept || null,
        notes: form.notes || null,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.save'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {error && (
        <div className='p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm'>
          {error}
        </div>
      )}
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        <div className='sm:col-span-2'>
          <label
            htmlFor='payment-client'
            className='block text-sm font-semibold text-slate-700 mb-1'
          >
            {t('payments.form.client')}
          </label>
          <select
            id='payment-client'
            value={form.clientId ?? ''}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                clientId: parseInt(e.target.value, 10) || null,
              }))
            }
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white'
          >
            <option value=''>{t('payments.form.noClient')}</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor='payment-amount'
            className='block text-sm font-semibold text-slate-700 mb-1'
          >
            {t('payments.form.amount')} *
          </label>
          <div className='relative'>
            <span className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium'>
              €
            </span>
            <input
              required
              id='payment-amount'
              type='number'
              step='0.01'
              min='0.01'
              value={form.amount || ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  amount: parseFloat(e.target.value) || 0,
                }))
              }
              className='w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
            />
          </div>
        </div>
        <div>
          <label htmlFor='payment-date' className='block text-sm font-semibold text-slate-700 mb-1'>
            {t('payments.form.date')} *
          </label>
          <input
            required
            type='date'
            id='payment-date'
            value={form.paymentDate}
            onChange={(e) => setForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
        <div>
          <label
            htmlFor='payment-concept'
            className='block text-sm font-semibold text-slate-700 mb-1'
          >
            {t('payments.form.concept')}
          </label>
          <input
            id='payment-concept'
            value={form.concept}
            onChange={(e) => setForm((prev) => ({ ...prev, concept: e.target.value }))}
            placeholder={t('payments.form.conceptPlaceholder')}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
        <div>
          <label
            htmlFor='payment-status'
            className='block text-sm font-semibold text-slate-700 mb-1'
          >
            {t('payments.form.status')}
          </label>
          <select
            id='payment-status'
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white'
          >
            <option value='confirmed'>{t('payments.status.confirmed')}</option>
            <option value='pending'>{t('payments.status.pending')}</option>
            <option value='unmatched'>{t('payments.status.unmatched')}</option>
          </select>
        </div>
        <div className='sm:col-span-2'>
          <label
            htmlFor='payment-notes'
            className='block text-sm font-semibold text-slate-700 mb-1'
          >
            {t('payments.form.notes')}
          </label>
          <input
            id='payment-notes'
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
      </div>
      <div className='flex justify-end gap-3 pt-2'>
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
          {t('payments.create')}
        </Button>
      </div>
    </form>
  )
}
