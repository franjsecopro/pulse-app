import { type FormEvent, useState } from 'react'
import { useTranslation } from '../../i18n'
import type { Client, PaymentTiming } from '../../types'
import { Button } from '../ui/Button'

interface ClientFormProps {
  initial?: Partial<Client>
  onSave: (data: Partial<Client>) => Promise<void>
  onCancel: () => void
}

export function ClientForm({ initial, onSave, onCancel }: ClientFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    whatsapp_phone: initial?.whatsapp_phone ?? '',
    address: initial?.address ?? '',
    tax_id: initial?.tax_id ?? '',
    payment_timing: (initial?.payment_timing ?? 'same_month') as PaymentTiming,
    is_active: initial?.is_active ?? true,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!initial?.id
  const isDirty =
    !isEditing ||
    form.name !== (initial?.name ?? '') ||
    form.email !== (initial?.email ?? '') ||
    form.phone !== (initial?.phone ?? '') ||
    form.whatsapp_phone !== (initial?.whatsapp_phone ?? '') ||
    form.address !== (initial?.address ?? '') ||
    form.tax_id !== (initial?.tax_id ?? '') ||
    form.payment_timing !== (initial?.payment_timing ?? 'same_month') ||
    form.is_active !== (initial?.is_active ?? true)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onSave(form)
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
          <label htmlFor='client-name' className='block text-sm font-semibold text-slate-700 mb-1'>
            {t('clients.form.name')} *
          </label>
          <input
            required
            id='client-name'
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
        <div>
          <label htmlFor='client-email' className='block text-sm font-semibold text-slate-700 mb-1'>
            {t('clients.form.email')}
          </label>
          <input
            type='email'
            id='client-email'
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
        <div>
          <label htmlFor='client-phone' className='block text-sm font-semibold text-slate-700 mb-1'>
            {t('clients.form.phone')}
          </label>
          <input
            id='client-phone'
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
        <div>
          <label
            htmlFor='client-whatsapp'
            className='block text-sm font-semibold text-slate-700 mb-1'
          >
            {t('clients.form.whatsapp')}
          </label>
          <input
            id='client-whatsapp'
            placeholder={t('clients.form.whatsappPlaceholder')}
            value={form.whatsapp_phone}
            onChange={(e) => setForm((f) => ({ ...f, whatsapp_phone: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
          <p className='text-xs text-slate-400 mt-1'>{t('clients.form.whatsappHint')}</p>
        </div>
        <div>
          <label
            htmlFor='client-address'
            className='block text-sm font-semibold text-slate-700 mb-1'
          >
            {t('clients.form.address')}
          </label>
          <input
            id='client-address'
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
        </div>
        <div>
          <label
            htmlFor='client-tax-id'
            className='block text-sm font-semibold text-slate-700 mb-1'
          >
            {t('clients.form.taxId')}
          </label>
          <input
            id='client-tax-id'
            placeholder={t('clients.form.taxIdPlaceholder')}
            value={form.tax_id}
            onChange={(e) => setForm((f) => ({ ...f, tax_id: e.target.value }))}
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
          />
          <p className='text-xs text-slate-400 mt-1'>{t('clients.form.taxIdHint')}</p>
        </div>
        <div className='sm:col-span-2'>
          <label
            htmlFor='client-payment-timing'
            className='block text-sm font-semibold text-slate-700 mb-1'
          >
            {t('clients.form.paymentTimingLabel')}
          </label>
          <select
            id='client-payment-timing'
            value={form.payment_timing}
            onChange={(e) =>
              setForm((f) => ({ ...f, payment_timing: e.target.value as PaymentTiming }))
            }
            className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white'
          >
            <option value='same_month'>{t('clients.paymentTiming.sameMonth')}</option>
            <option value='next_month'>{t('clients.paymentTiming.nextMonth')}</option>
          </select>
          <p className='text-xs text-slate-400 mt-1'>{t('clients.paymentTiming.nextMonthHint')}</p>
        </div>
        <div className='flex items-center gap-3 mt-2'>
          <input
            type='checkbox'
            id='is_active'
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            className='w-4 h-4 accent-primary'
          />
          <label htmlFor='is_active' className='text-sm font-medium text-slate-700'>
            {t('clients.form.isActive')}
          </label>
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
          disabled={!isDirty}
          className='px-6 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-primary/20 flex items-center gap-2'
        >
          {isSubmitting && (
            <span className='material-symbols-outlined text-base animate-spin'>sync</span>
          )}
          {isEditing && !isDirty ? t('actions.noChanges') : t('actions.save')}
        </Button>
      </div>
    </form>
  )
}
