import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DateRangeMode, type DateRangeModeValue } from '../components/notifications/DateRangeMode'
import {
  NotificationFilters,
  type NotificationFilterValues,
} from '../components/notifications/NotificationFilters'
import { Button } from '../components/ui/Button'
import { Pagination } from '../components/ui/Pagination'
import { useNotificationLog, usePendingNotifications } from '../hooks/useNotifications'
import i18n, { useTranslation } from '../i18n'
import { notificationsService } from '../services/notifications.service'
import type {
  AppNotification,
  NotificationLogFilters,
  NotificationSettings,
  NotificationStatus,
} from '../types'

function todayISO(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const monthPadded = String(now.getMonth() + 1).padStart(2, '0')
  const dayPadded = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${monthPadded}-${dayPadded}`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface FormatDateArgs {
  t: (key: string, options?: Record<string, unknown>) => string
  dateStr: string
}

function formatDateEs({ t, dateStr }: FormatDateArgs): string {
  const days: string[] = t('common.weekdays.full', {
    returnObjects: true,
  }) as unknown as string[]
  const monthsLower: string[] = t('common.months.lowercase', {
    returnObjects: true,
  }) as unknown as string[]
  const d = new Date(`${dateStr}T00:00:00`)
  return `${days[d.getDay()]} ${d.getDate()} de ${monthsLower[d.getMonth()]}`
}

function StatusBadge({
  status,
  t,
}: {
  status: NotificationStatus
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  if (status === 'sent') {
    return (
      <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700'>
        <span className='material-symbols-outlined text-[12px]'>check_circle</span>{' '}
        {t('notifications.status.sent')}
      </span>
    )
  }
  if (status === 'skipped') {
    return (
      <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500'>
        <span className='material-symbols-outlined text-[12px]'>block</span>{' '}
        {t('notifications.status.skipped')}
      </span>
    )
  }
  return (
    <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700'>
      <span className='material-symbols-outlined text-[12px]'>schedule</span>{' '}
      {t('notifications.status.pending')}
    </span>
  )
}

function matchesStatusFilter(
  notification: AppNotification,
  filter: NotificationFilterValues['status'],
): boolean {
  if (filter === 'all') return true
  return notification.status === filter
}

function matchesClientFilter(
  notification: AppNotification,
  clientId: NotificationFilterValues['clientId'],
): boolean {
  if (clientId === 'all') return true
  return notification.clientId === clientId
}

function matchesChannelFilter(
  notification: AppNotification,
  channel: NotificationFilterValues['channel'],
): boolean {
  if (channel === 'all') return true
  return notification.channel === channel
}

const DEFAULT_FILTERS: NotificationFilterValues = {
  status: 'all',
  clientId: 'all',
  channel: 'all',
}

const PENDING_FILTERS: NotificationFilterValues = {
  status: 'pending',
  clientId: 'all',
  channel: 'all',
}

const DefaultHistoryPageSize = 50

function PendingTab({ t }: { t: (key: string, options?: Record<string, unknown>) => string }) {
  const [notificationDay, setNotificationDay] = useState(todayISO())
  const [filters, setFilters] = useState<NotificationFilterValues>(PENDING_FILTERS)

  const {
    notifications,
    isLoading,
    isGenerating,
    generateError,
    sentIds,
    handleGenerate,
    handleSend,
  } = usePendingNotifications({ date: notificationDay })

  const visible = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          matchesStatusFilter(notification, filters.status) &&
          matchesClientFilter(notification, filters.clientId) &&
          matchesChannelFilter(notification, filters.channel),
      ),
    [notifications, filters],
  )

  const pending = visible.filter((notification) => notification.status === 'pending')
  const skipped = visible.filter((notification) => notification.status === 'skipped')

  return (
    <div className='space-y-4'>
      {generateError && (
        <div className='p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm'>
          {generateError}
        </div>
      )}

      <DateRangeMode
        mode='day'
        date={notificationDay}
        onDateChange={setNotificationDay}
        modeLocked
      />

      <NotificationFilters
        values={filters}
        onChange={setFilters}
        showStatus
        showClient
        showChannel
        statusLocked
      />

      <div className='flex justify-end'>
        <Button
          type='button'
          onClick={handleGenerate}
          loading={isGenerating}
          title={t('notifications.generateTooltip', {
            date: formatDateEs({ t, dateStr: notificationDay }),
          })}
          className='inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors min-h-[44px]'
        >
          <span className='material-symbols-outlined text-[16px]'>
            {isGenerating ? 'hourglass_empty' : 'refresh'}
          </span>
          {isGenerating ? t('notifications.generating') : t('notifications.generate')}
        </Button>
      </div>

      {isLoading ? (
        <div className='flex items-center justify-center py-16 text-slate-400'>
          <span className='material-symbols-outlined animate-spin mr-2'>refresh</span>{' '}
          {t('common.loading')}
        </div>
      ) : visible.length === 0 ? (
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
              {visible.map((notification) => {
                const isSent = sentIds.has(notification.id) || notification.status === 'sent'
                return (
                  <tr key={notification.id} className={isSent ? 'bg-emerald-50' : ''}>
                    <td className='px-4 py-3 font-medium'>
                      <Link to='/clients' className='text-indigo-600 hover:underline'>
                        {notification.clientName}
                      </Link>
                    </td>
                    <td className='px-4 py-3 text-slate-600'>{notification.classTime ?? '—'}</td>
                    <td className='px-4 py-3'>
                      <StatusBadge status={isSent ? 'sent' : notification.status} t={t} />
                    </td>
                    <td className='px-4 py-3 hidden md:table-cell'>
                      {notification.status === 'skipped' && !isSent ? (
                        <span className='text-xs text-slate-400 italic'>
                          {t('notifications.skippedHint')}
                        </span>
                      ) : null}
                    </td>
                    <td className='px-4 py-3 text-right'>
                      {!isSent && notification.status === 'pending' && notification.whatsappUrl && (
                        <Button
                          type='button'
                          onClick={() => handleSend(notification)}
                          className='inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors'
                        >
                          <span className='material-symbols-outlined text-[14px]'>send</span>{' '}
                          {t('notifications.send')}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {visible.length > 0 && (
            <div className='px-4 py-3 border-t border-slate-100 bg-slate-50 flex gap-4 text-xs text-slate-500'>
              {pending.length > 0 && (
                <span className='text-amber-600 font-medium'>
                  {t('notifications.footer.pending', { count: pending.length })}
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

function HistoryTab({ t }: { t: (key: string, options?: Record<string, unknown>) => string }) {
  const [mode, setMode] = useState<DateRangeModeValue>('month')
  const [date, setDate] = useState(todayISO())
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<NotificationFilterValues>(DEFAULT_FILTERS)

  const logFilters: NotificationLogFilters = useMemo(
    () => ({
      mode,
      date,
      status: filters.status === 'all' ? undefined : filters.status,
      clientId: filters.clientId === 'all' ? undefined : filters.clientId,
      channel: filters.channel === 'all' ? undefined : filters.channel,
      page,
      pageSize: DefaultHistoryPageSize,
    }),
    [mode, date, filters, page],
  )

  const { items, total, pageCount, isLoading } = useNotificationLog(logFilters)

  function onModeChange(next: DateRangeModeValue) {
    setMode(next)
    setPage(1)
  }
  function onDateChange(next: string) {
    setDate(next)
    setPage(1)
  }
  function onFiltersChange(next: NotificationFilterValues) {
    setFilters(next)
    setPage(1)
  }

  return (
    <div className='space-y-4'>
      <DateRangeMode
        mode={mode}
        date={date}
        onDateChange={onDateChange}
        onModeChange={onModeChange}
      />
      <NotificationFilters
        values={filters}
        onChange={onFiltersChange}
        showStatus
        showClient
        showChannel
      />

      {isLoading ? (
        <div className='flex items-center justify-center py-16 text-slate-400'>
          <span className='material-symbols-outlined animate-spin mr-2'>refresh</span>{' '}
          {t('common.loading')}
        </div>
      ) : items.length === 0 ? (
        <div className='bg-white rounded-xl border border-slate-200 py-16 text-center'>
          <span className='material-symbols-outlined text-4xl text-slate-300'>history</span>
          <p className='mt-2 font-medium text-slate-600'>{t('notifications.history.empty')}</p>
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
              {items.map((notification) => (
                <tr key={notification.id}>
                  <td className='px-4 py-3 font-medium text-slate-800'>
                    {notification.clientName}
                  </td>
                  <td className='px-4 py-3 text-slate-600'>
                    {formatDateEs({ t, dateStr: notification.classDate })}
                  </td>
                  <td className='px-4 py-3 text-slate-600'>{notification.classTime ?? '—'}</td>
                  <td className='px-4 py-3'>
                    <StatusBadge status={notification.status} t={t} />
                  </td>
                  <td className='px-4 py-3 text-slate-500 hidden md:table-cell'>
                    {notification.sentAt ? formatTime(notification.sentAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pageCount={pageCount} totalCount={total} onPage={setPage} />
        </div>
      )}
    </div>
  )
}

const SAMPLE_VARS = {
  nombre: 'Sofia',
  hora: '10:00',
  dia: 'martes 14 de abril',
  materia: 'Ingles',
}

function renderPreview(template: string): string {
  return template
    .replace('{nombre}', SAMPLE_VARS.nombre)
    .replace('{hora}', SAMPLE_VARS.hora)
    .replace('{dia}', SAMPLE_VARS.dia)
    .replace('{materia}', SAMPLE_VARS.materia)
}

function SettingsTab({ t }: { t: (key: string, options?: Record<string, unknown>) => string }) {
  const [settings, setSettings] = useState<NotificationSettings>({
    defaultChannel: 'whatsapp',
    messageTemplate: '',
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
            <label
              htmlFor={`channel-${channel}`}
              key={channel}
              className='flex items-center gap-2 cursor-pointer'
            >
              <input
                type='radio'
                id={`channel-${channel}`}
                name='channel'
                value={channel}
                checked={settings.defaultChannel === channel}
                onChange={() => setSettings((prev) => ({ ...prev, defaultChannel: channel }))}
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
          value={settings.messageTemplate}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              messageTemplate: e.target.value,
            }))
          }
          className='w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none'
        />
        {settings.messageTemplate && (
          <div className='bg-slate-50 border border-slate-200 rounded-lg p-3'>
            <p className='text-xs font-medium text-slate-500 mb-1'>
              {t('notifications.settings.preview')}
            </p>
            <p className='text-sm text-slate-700'>{renderPreview(settings.messageTemplate)}</p>
          </div>
        )}
      </div>

      <Button
        type='button'
        onClick={handleSave}
        loading={isSaving}
        className='inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors'
      >
        <span className='material-symbols-outlined text-[16px]'>{saved ? 'check' : 'save'}</span>
        {saved
          ? t('notifications.settings.saved')
          : isSaving
            ? t('notifications.settings.saving')
            : t('actions.save')}
      </Button>
    </div>
  )
}

type Tab = 'pending' | 'history' | 'settings'

export function Notifications() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('pending')

  const tabs: { id: Tab; label: string; icon: string }[] = [
    {
      id: 'pending',
      label: t('notifications.tab.pending'),
      icon: 'notifications',
    },
    { id: 'history', label: t('notifications.tab.history'), icon: 'history' },
    {
      id: 'settings',
      label: t('notifications.tab.settings'),
      icon: 'settings',
    },
  ]

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-black text-slate-900'>{t('notifications.title')}</h1>
        <p className='text-slate-500 text-sm mt-1'>{t('notifications.subtitle')}</p>
      </div>

      <div className='flex gap-1 bg-slate-100 p-1 rounded-lg w-fit'>
        {tabs.map((tab) => (
          <Button
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
          </Button>
        ))}
      </div>

      {activeTab === 'pending' && <PendingTab t={t} />}
      {activeTab === 'history' && <HistoryTab t={t} />}
      {activeTab === 'settings' && <SettingsTab t={t} />}
    </div>
  )
}
