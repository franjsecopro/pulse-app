import { useCallback, useEffect, useState } from 'react'
import { LanguageSelector } from '../components/settings/LanguageSelector'
import { useTranslation } from '../i18n'
import { businessProfileService } from '../services/business_profile.service'
import { googleCalendarService } from '../services/google_calendar.service'
import type { GoogleCalendarStatus } from '../types'

export function Settings() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [fiscal, setFiscal] = useState({ business_name: '', tax_id: '', fiscal_address: '' })
  const [isSavingFiscal, setIsSavingFiscal] = useState(false)

  const handleSaveFiscal = async () => {
    setIsSavingFiscal(true)
    try {
      await businessProfileService.update({
        business_name: fiscal.business_name || null,
        tax_id: fiscal.tax_id || null,
        fiscal_address: fiscal.fiscal_address || null,
      })
      setToast({ type: 'success', message: t('settings.toast.fiscalSaved') })
    } catch {
      setToast({ type: 'error', message: t('settings.toast.fiscalSaveError') })
    } finally {
      setIsSavingFiscal(false)
    }
  }

  const loadStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await googleCalendarService.getStatus()
      setStatus(data)
    } catch {
      setStatus({ connected: false })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const { url } = await googleCalendarService.getConnectUrl()
      window.location.href = url
    } catch {
      setToast({ type: 'error', message: t('settings.errors.connectUrl') })
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      await googleCalendarService.disconnect()
      setStatus({ connected: false })
      setToast({ type: 'success', message: t('settings.toast.gcalDisconnected') })
    } catch {
      setToast({ type: 'error', message: t('settings.toast.gcalDisconnectError') })
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <div className='max-w-2xl mx-auto px-4 py-8 space-y-6'>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold transition-all ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          <span className='material-symbols-outlined text-base'>
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.message}
        </div>
      )}

      <div>
        <h1 className='text-2xl font-bold text-slate-900'>{t('settings.title')}</h1>
        <p className='text-slate-500 text-sm mt-1'>{t('settings.subtitle')}</p>
      </div>

      {/* Language section */}
      <div className='bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden'>
        <div className='flex items-center gap-3 px-6 py-4 border-b border-slate-100'>
          <div className='w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0'>
            <span className='material-symbols-outlined text-violet-500 text-xl'>language</span>
          </div>
          <div>
            <p className='font-semibold text-slate-900 text-sm'>
              {t('settings.sections.language')}
            </p>
            <p className='text-xs text-slate-500'>{t('settings.sections.languageHint')}</p>
          </div>
        </div>
        <div className='px-6 py-5'>
          <LanguageSelector />
        </div>
      </div>

      {/* Google Calendar section */}
      <div className='bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden'>
        <div className='flex items-center gap-3 px-6 py-4 border-b border-slate-100'>
          <div className='w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0'>
            <span className='material-symbols-outlined text-blue-500 text-xl'>calendar_month</span>
          </div>
          <div>
            <p className='font-semibold text-slate-900 text-sm'>
              {t('settings.sections.googleCalendar')}
            </p>
            <p className='text-xs text-slate-500'>{t('settings.sections.gcalHint')}</p>
          </div>
        </div>

        <div className='px-6 py-5 space-y-4'>
          {isLoading ? (
            <p className='text-sm text-slate-400'>{t('settings.gcal.loadingStatus')}</p>
          ) : status?.connected ? (
            <>
              <div className='flex items-center gap-2'>
                <span className='w-2 h-2 rounded-full bg-emerald-500 shrink-0' />
                <p className='text-sm text-slate-700'>
                  {t('settings.gcal.connectedAs', { email: status.email })}
                </p>
              </div>
              <ul className='text-xs text-slate-500 space-y-1 pl-4 list-disc'>
                {(
                  t('settings.gcal.featuresConnected', {
                    returnObjects: true,
                  }) as unknown as string[]
                ).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <button
                type='button'
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className='flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50'
              >
                {isDisconnecting ? (
                  <span className='material-symbols-outlined text-base animate-spin'>sync</span>
                ) : (
                  <span className='material-symbols-outlined text-base'>link_off</span>
                )}
                {t('settings.gcal.disconnect')}
              </button>
            </>
          ) : (
            <>
              <div className='flex items-center gap-2'>
                <span className='w-2 h-2 rounded-full bg-slate-300 shrink-0' />
                <p className='text-sm text-slate-500'>{t('settings.gcal.notConnected')}</p>
              </div>
              <ul className='text-xs text-slate-500 space-y-1 pl-4 list-disc'>
                {(
                  t('settings.gcal.featuresNotConnected', {
                    returnObjects: true,
                  }) as unknown as string[]
                ).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <button
                type='button'
                onClick={handleConnect}
                disabled={isConnecting}
                className='flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-md shadow-primary/20'
              >
                {isConnecting ? (
                  <span className='material-symbols-outlined text-base animate-spin'>sync</span>
                ) : (
                  <span className='material-symbols-outlined text-base'>add_link</span>
                )}
                {t('settings.gcal.connect')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Fiscal data section */}
      <div className='bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden'>
        <div className='flex items-center gap-3 px-6 py-4 border-b border-slate-100'>
          <div className='w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0'>
            <span className='material-symbols-outlined text-amber-500 text-xl'>receipt_long</span>
          </div>
          <div>
            <p className='font-semibold text-slate-900 text-sm'>{t('settings.sections.fiscal')}</p>
            <p className='text-xs text-slate-500'>{t('settings.sections.fiscalHint')}</p>
          </div>
        </div>

        <div className='px-6 py-5 space-y-4'>
          <div>
            <label className='block text-sm font-semibold text-slate-700 mb-1'>
              {t('settings.fiscal.businessName')}
            </label>
            <input
              value={fiscal.business_name}
              onChange={(e) => setFiscal((f) => ({ ...f, business_name: e.target.value }))}
              className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
            />
          </div>
          <div>
            <label className='block text-sm font-semibold text-slate-700 mb-1'>
              {t('settings.fiscal.taxId')}
            </label>
            <input
              placeholder={t('settings.fiscal.taxIdPlaceholder')}
              value={fiscal.tax_id}
              onChange={(e) => setFiscal((f) => ({ ...f, tax_id: e.target.value }))}
              className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
            />
          </div>
          <div>
            <label className='block text-sm font-semibold text-slate-700 mb-1'>
              {t('settings.fiscal.address')}
            </label>
            <input
              value={fiscal.fiscal_address}
              onChange={(e) => setFiscal((f) => ({ ...f, fiscal_address: e.target.value }))}
              className='w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm'
            />
          </div>
          <button
            type='button'
            onClick={handleSaveFiscal}
            disabled={isSavingFiscal}
            className='flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 shadow-md shadow-primary/20'
          >
            {isSavingFiscal ? (
              <span className='material-symbols-outlined text-base animate-spin'>sync</span>
            ) : (
              <span className='material-symbols-outlined text-base'>save</span>
            )}
            {t('settings.fiscal.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
