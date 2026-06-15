import { useEffect, useState } from 'react'
import { useToast } from '../../context/ToastContext'
import { useTranslation } from '../../i18n'
import { businessProfileService } from '../../services/business_profile.service'
import type { BusinessProfile } from '../../types'
import { Button } from '../ui/Button'

const EMPTY_PROFILE: BusinessProfile = {
  businessName: null,
  taxId: null,
  fiscalAddress: null,
  siret: null,
  phone: null,
  email: null,
  iban: null,
  bic: null,
  rcsDispense: false,
  vatExempt: true,
  paymentConditions: null,
  invoiceNumberFormat: 'YYYY-MM-NN',
  invoiceSequenceScope: 'monthly',
}

const INPUT_CLASS =
  'w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'

export function FiscalDataForm() {
  const { t } = useTranslation()
  const { addToast } = useToast()
  const [profile, setProfile] = useState<BusinessProfile>(EMPTY_PROFILE)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    businessProfileService
      .get()
      .then((data) => setProfile({ ...EMPTY_PROFILE, ...data }))
      .catch(() => undefined)
  }, [])

  function setField<K extends keyof BusinessProfile>(key: K, value: BusinessProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }))
  }

  function textField(key: keyof BusinessProfile, label: string, placeholder?: string) {
    return (
      <div>
        <label
          htmlFor={`fiscal-${key}`}
          className='block text-sm font-semibold text-slate-700 mb-1'
        >
          {label}
        </label>
        <input
          id={`fiscal-${key}`}
          placeholder={placeholder}
          value={(profile[key] as string | null) ?? ''}
          onChange={(e) => setField(key, (e.target.value || null) as BusinessProfile[typeof key])}
          className={INPUT_CLASS}
        />
      </div>
    )
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      await businessProfileService.update(profile)
      addToast('settings.toast.fiscalSaved', 'success')
    } catch (err) {
      addToast(
        'settings.toast.fiscalSaveError',
        'error',
        undefined,
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='space-y-4'>
      {textField('businessName', t('settings.fiscal.businessName'))}
      {textField('siret', t('settings.fiscal.siret'), t('settings.fiscal.siretPlaceholder'))}
      {textField('fiscalAddress', t('settings.fiscal.address'))}

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        {textField('phone', t('settings.fiscal.phone'))}
        {textField('email', t('settings.fiscal.email'))}
        {textField('iban', t('settings.fiscal.iban'))}
        {textField('bic', t('settings.fiscal.bic'))}
      </div>

      <div>
        <label
          htmlFor='fiscal-payment-conditions'
          className='block text-sm font-semibold text-slate-700 mb-1'
        >
          {t('settings.fiscal.paymentConditions')}
        </label>
        <textarea
          id='fiscal-payment-conditions'
          rows={2}
          value={profile.paymentConditions ?? ''}
          onChange={(e) => setField('paymentConditions', e.target.value || null)}
          className={INPUT_CLASS}
        />
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
        {textField('invoiceNumberFormat', t('settings.fiscal.numberFormat'))}
        <div>
          <label htmlFor='fiscal-scope' className='block text-sm font-semibold text-slate-700 mb-1'>
            {t('settings.fiscal.sequenceScope')}
          </label>
          <select
            id='fiscal-scope'
            value={profile.invoiceSequenceScope}
            onChange={(e) => setField('invoiceSequenceScope', e.target.value)}
            className={INPUT_CLASS}
          >
            <option value='monthly'>{t('settings.fiscal.scopeMonthly')}</option>
            <option value='annual'>{t('settings.fiscal.scopeAnnual')}</option>
          </select>
        </div>
      </div>

      <div className='space-y-2'>
        <label className='flex items-center gap-2 text-sm text-slate-700'>
          <input
            type='checkbox'
            checked={profile.vatExempt}
            onChange={(e) => setField('vatExempt', e.target.checked)}
            className='rounded border-slate-300 text-primary focus:ring-primary/30'
          />
          {t('settings.fiscal.vatExempt')}
        </label>
        <label className='flex items-center gap-2 text-sm text-slate-700'>
          <input
            type='checkbox'
            checked={profile.rcsDispense}
            onChange={(e) => setField('rcsDispense', e.target.checked)}
            className='rounded border-slate-300 text-primary focus:ring-primary/30'
          />
          {t('settings.fiscal.rcsDispense')}
        </label>
      </div>

      <Button
        type='button'
        onClick={handleSave}
        loading={isSaving}
        className='flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-md shadow-primary/20'
      >
        {isSaving ? (
          <span className='material-symbols-outlined text-base animate-spin'>sync</span>
        ) : (
          <span className='material-symbols-outlined text-base'>save</span>
        )}
        {t('settings.fiscal.save')}
      </Button>
    </div>
  )
}
