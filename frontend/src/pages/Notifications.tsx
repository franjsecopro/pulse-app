import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import i18n, { useTranslation } from '../i18n'
import { notificationsService } from '../services/notifications.service'
import type { AppNotification, NotificationSettings } from '../types'

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({
  status,
  t,
}: {
  status: AppNotification['status']
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  if (status === 'sent')
    return (
      <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700'>
        <span className='material-symbols-outlined text-[12px]'>check_circle</span>{' '}
        {t('notifications.status.sent')}
      </span>
    )
  return (
    <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700'>
      <span className='material-symbols-outlined text-[12px]'>schedule</span>{' '}
      {t('notifications.status.pending')}
    </span>
  )
}

function InfoNote({
  n,
  t,
}: {
  n: AppNotification
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  if (n.status === 'skipped')
    return <span className='text-xs text-slate-400 italic'>{t('notifications.skippedHint')}</span>
  return null
}

function PendingTab({ t }: { t: (key: string, options?: Record<string, unknown>) => string }) {
  const days: string[] = t('common.weekdays.full', { returnObjects: true }) as unknown as string[]
  const monthsLower: string[] = t('common.months.lowercase', {
    returnObjects: true,
  }) as unknown as string[]

  function formatDateEs(dateStr: string): string {
    const d = new Date(`${dateStr}T00:00:00`)
    return `${days[d.getDay()]} ${d.getDate()} de ${monthsLower[d.getMonth()]}`
  }

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<Set<number>>(new Set())

  const loadPending = useCallback(async () => {
    setIsLoading(true)
    try {
      const pending = await notificationsService.getPending()
      if (pending.length === 0) {
        const generated = await notificationsService.generate()
        setNotifications(generated)
      } else {
        setNotifications(pending)
      }
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : t('notifications.errors.load'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadPending()
  }, [loadPending])

  async function handleGenerate() {
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const result = await notificationsService.generate()
      setNotifications(result)
    } catch (err: unknown) {
      setGenerateError(err instanceof Error ? err.message : t('notifications.errors.generate'))
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSend(n: AppNotification) {
    if (!n.whatsapp_url) return
    window.open(n.whatsapp_url, '_blank', 'noopener,noreferrer')
    await notificationsService.markSent(n.id)
    setSentIds((prev) => new Set(prev).add(n.id))
    setNotifications((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, status: 'sent' } : item)),
    )
  }

  const pending = notifications.filter((n) => n.status === 'pending')
  const skipped = notifications.filter((n) => n.status === 'skipped')
  const sent = notifications.filter((n) => n.status === 'sent')

  const tomorrowDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })()

  return (
    <div className='space-y-4'>
      {generateError && (
        <div className='p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm'>
          {generateError}
        </div>
      )}
      <div className='flex items-center justify-between'>
        <p className='text-sm text-slate-500'>
          {t('notifications.classesForDate', { date: formatDateEs(tomorrowDate) })}
        </p>
        <button
          type='button'
          onClick={handleGenerate}
          disabled={isGenerating}
          className='inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors'
        >
          <span className='material-symbols-outlined text-[16px]'>
            {isGenerating ? 'hourglass_empty' : 'refresh'}
          </span>
          {isGenerating ? t('notifications.updating') : t('notifications.update')}
        </button>
      </div>

      {isLoading ? (
        <div className='flex items-center justify-center py-16 text-slate-400'>
          <span className='material-symbols-outlined animate-spin mr-2'>refresh</span>{' '}
          {t('common.loading')}
        </div>
      ) : notifications.length === 0 ? (
        <div className='bg-white rounded-xl border border-slate-200 py-16 text-center'>
          <span className='material-symbols-outlined text-4xl text-slate-300'>
            notifications_none
          </span>
          <p className='mt-2 font-medium text-slate-600'>{t('notifications.empty.title')}</p>
          <p className='text-sm text-slate-400 mt-1'>{t('notifications.empty.hint')}</p>
        </div>
      ) : (
        <div className='bg-white rounded-xl border border-slate-200 overflow-hidden'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-slate-100 bg-slate-50'>
                <th className='text-left px-4 py-3 font-medium text-slate-500'>
                  {t('notifications.table.client')}
                </th>
                <th className='text-left px-4 py-3 font-medium text-slate-500'>
                  {t('notifications.table.time')}
                </th>
                <th className='text-left px-4 py-3 font-medium text-slate-500'>
                  {t('notifications.table.status')}
                </th>
                <th className='text-left px-4 py-3 font-medium text-slate-500 hidden md:table-cell'>
                  {t('notifications.table.info')}
                </th>
                <th className='px-4 py-3'></th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100'>
              {notifications.map((n) => {
                const isSent = sentIds.has(n.id) || n.status === 'sent'
                return (
                  <tr key={n.id} className={isSent ? 'bg-emerald-50' : ''}>
                    <td className='px-4 py-3 font-medium'>
                      <Link to='/clients' className='text-indigo-600 hover:underline'>
                        {n.client_name}
                      </Link>
                    </td>
                    <td className='px-4 py-3 text-slate-600'>{n.class_time ?? '—'}</td>
                    <td className='px-4 py-3'>
                      <StatusBadge status={isSent ? 'sent' : n.status} t={t} />
                    </td>
                    <td className='px-4 py-3 hidden md:table-cell'>
                      <InfoNote n={isSent ? { ...n, status: 'sent' } : n} t={t} />
                    </td>
                    <td className='px-4 py-3 text-right'>
                      {!isSent && n.status === 'pending' && n.whatsapp_url && (
                        <button
                          type='button'
                          onClick={() => handleSend(n)}
                          className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors'
                        >
                          <span className='material-symbols-outlined text-[14px]'>send</span>{' '}
                          {t('notifications.send')}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {notifications.length > 0 && (
            <div className='px-4 py-3 border-t border-slate-100 bg-slate-50 flex gap-4 text-xs text-slate-500'>
              {pending.length > 0 && (
                <span className='text-amber-600 font-medium'>
                  {t('notifications.footer.pending', { count: pending.length })}
                </span>
              )}
              {sent.length > 0 && (
                <span className='text-emerald-600 font-medium'>
                  {t('notifications.footer.sent', { count: sent.length })}
                </span>
              )}
              {skipped.length > 0 && (
                <span className='text-slate-400'>
                  {t('notifications.footer.skipped', { count: skipped.length })}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HistoryTab({
  filter,
  t,
}: {
  filter: 'sent' | 'all'
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const days: string[] = t('common.weekdays.full', { returnObjects: true }) as unknown as string[]
  const monthsLower: string[] = t('common.months.lowercase', {
    returnObjects: true,
  }) as unknown as string[]

  function formatDateEs(dateStr: string): string {
    const d = new Date(`${dateStr}T00:00:00`)
    return `${days[d.getDay()]} ${d.getDate()} de ${monthsLower[d.getMonth()]}`
  }

  const [log, setLog] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    notificationsService
      .getLog()
      .then((all) => setLog(filter === 'sent' ? all.filter((n) => n.status === 'sent') : all))
      .finally(() => setIsLoading(false))
  }, [filter])

  const emptyLabel =
    filter === 'sent' ? t('notifications.history.empty') : t('notifications.all.empty')

  return (
    <div>
      {isLoading ? (
        <div className='flex items-center justify-center py-16 text-slate-400'>
          <span className='material-symbols-outlined animate-spin mr-2'>refresh</span>{' '}
          {t('common.loading')}
        </div>
      ) : log.length === 0 ? (
        <div className='bg-white rounded-xl border border-slate-200 py-16 text-center'>
          <span className='material-symbols-outlined text-4xl text-slate-300'>history</span>
          <p className='mt-2 font-medium text-slate-600'>{emptyLabel}</p>
        </div>
      ) : (
        <div className='bg-white rounded-xl border border-slate-200 overflow-hidden'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-slate-100 bg-slate-50'>
                <th className='text-left px-4 py-3 font-medium text-slate-500'>
                  {t('notifications.historyTable.client')}
                </th>
                <th className='text-left px-4 py-3 font-medium text-slate-500'>
                  {t('notifications.historyTable.class')}
                </th>
                <th className='text-left px-4 py-3 font-medium text-slate-500'>
                  {t('notifications.historyTable.time')}
                </th>
                <th className='text-left px-4 py-3 font-medium text-slate-500'>
                  {t('notifications.historyTable.status')}
                </th>
                <th className='text-left px-4 py-3 font-medium text-slate-500 hidden md:table-cell'>
                  {t('notifications.historyTable.sentAt')}
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100'>
              {log.map((n) => (
                <tr key={n.id}>
                  <td className='px-4 py-3 font-medium text-slate-800'>{n.client_name}</td>
                  <td className='px-4 py-3 text-slate-600'>{formatDateEs(n.class_date)}</td>
                  <td className='px-4 py-3 text-slate-600'>{n.class_time ?? '—'}</td>
                  <td className='px-4 py-3'>
                    <StatusBadge status={n.status} t={t} />
                  </td>
                  <td className='px-4 py-3 text-slate-500 hidden md:table-cell'>
                    {n.sent_at ? formatTime(n.sent_at) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const SAMPLE_VARS = { nombre: 'Sofia', hora: '10:00', dia: 'martes 14 de abril', materia: 'Ingles' }

function renderPreview(template: string): string {
  return template
    .replace('{nombre}', SAMPLE_VARS.nombre)
    .replace('{hora}', SAMPLE_VARS.hora)
    .replace('{dia}', SAMPLE_VARS.dia)
    .replace('{materia}', SAMPLE_VARS.materia)
}

function SettingsTab({ t }: { t: (key: string, options?: Record<string, unknown>) => string }) {
  const [settings, setSettings] = useState<NotificationSettings>({
    default_channel: 'whatsapp',
    message_template: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    notificationsService
      .getSettings()
      .then(setSettings)
      .finally(() => setIsLoading(false))
  }, [])

  async function handleSave() {
    setIsSaving(true)
    setSaved(false)
    try {
      const updated = await notificationsService.updateSettings(settings)
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading)
    return (
      <div className='flex items-center justify-center py-16 text-slate-400'>
        <span className='material-symbols-outlined animate-spin mr-2'>refresh</span>{' '}
        {t('common.loading')}
      </div>
    )

  return (
    <div className='max-w-xl space-y-6'>
      <div className='bg-white rounded-xl border border-slate-200 p-5 space-y-3'>
        <h3 className='font-semibold text-slate-800'>
          {t('notifications.settings.defaultChannel')}
        </h3>
        <div className='flex gap-4'>
          {(['whatsapp', 'email'] as const).map((channel) => (
            <label key={channel} className='flex items-center gap-2 cursor-pointer'>
              <input
                type='radio'
                name='channel'
                value={channel}
                checked={settings.default_channel === channel}
                onChange={() => setSettings((s) => ({ ...s, default_channel: channel }))}
                className='accent-indigo-600'
              />
              <span className='text-sm font-medium text-slate-700'>
                {channel === 'whatsapp'
                  ? t('notifications.settings.whatsapp')
                  : t('notifications.settings.email')}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className='bg-white rounded-xl border border-slate-200 p-5 space-y-3'>
        <h3 className='font-semibold text-slate-800'>
          {t('notifications.settings.templateLabel')}
        </h3>
        <p className='text-xs text-slate-500'>
          {t('notifications.settings.variablesHint')}{' '}
          <code className='bg-slate-100 px-1 rounded'>{'{nombre}'}</code>{' '}
          <code className='bg-slate-100 px-1 rounded'>{'{hora}'}</code>{' '}
          <code className='bg-slate-100 px-1 rounded'>{'{dia}'}</code>{' '}
          <code className='bg-slate-100 px-1 rounded'>{'{materia}'}</code>
        </p>
        <textarea
          rows={4}
          value={settings.message_template}
          onChange={(e) => setSettings((s) => ({ ...s, message_template: e.target.value }))}
          className='w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none'
        />
        {settings.message_template && (
          <div className='bg-slate-50 border border-slate-200 rounded-lg p-3'>
            <p className='text-xs font-medium text-slate-500 mb-1'>
              {t('notifications.settings.preview')}
            </p>
            <p className='text-sm text-slate-700'>{renderPreview(settings.message_template)}</p>
          </div>
        )}
      </div>

      <button
        type='button'
        onClick={handleSave}
        disabled={isSaving}
        className='inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors'
      >
        <span className='material-symbols-outlined text-[16px]'>{saved ? 'check' : 'save'}</span>
        {saved
          ? t('notifications.settings.saved')
          : isSaving
            ? t('notifications.settings.saving')
            : t('actions.save')}
      </button>
    </div>
  )
}

type Tab = 'notifications' | 'history' | 'all' | 'settings'

export function Notifications() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('notifications')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'notifications', label: t('notifications.tab.notifications'), icon: 'notifications' },
    { id: 'history', label: t('notifications.tab.history'), icon: 'history' },
    { id: 'all', label: t('notifications.tab.all'), icon: 'list' },
    { id: 'settings', label: t('notifications.tab.settings'), icon: 'settings' },
  ]

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-black text-slate-900'>{t('notifications.title')}</h1>
        <p className='text-slate-500 text-sm mt-1'>{t('notifications.subtitle')}</p>
      </div>

      <div className='flex gap-1 bg-slate-100 p-1 rounded-lg w-fit'>
        {tabs.map((tab) => (
          <button
            type='button'
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <span className='material-symbols-outlined text-[16px]'>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'notifications' && <PendingTab t={t} />}
      {activeTab === 'history' && <HistoryTab filter='sent' t={t} />}
      {activeTab === 'all' && <HistoryTab filter='all' t={t} />}
      {activeTab === 'settings' && <SettingsTab t={t} />}
    </div>
  )
}
