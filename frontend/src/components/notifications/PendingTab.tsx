import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePendingNotifications } from '../../hooks/useNotifications'
import { useTranslation } from '../../i18n'
import { todayISO } from '../../utils/formatters'
import { Button } from '../ui/Button'
import { DateRangeMode } from './DateRangeMode'
import { NotificationFilters, type NotificationFilterValues } from './NotificationFilters'
import { StatusBadge } from './StatusBadge'
import {
  formatDateEs,
  matchesChannelFilter,
  matchesClientFilter,
  matchesStatusFilter,
} from './utils'

const PENDING_FILTERS: NotificationFilterValues = {
  status: 'pending',
  clientId: 'all',
  channel: 'all',
}

export function PendingTab() {
  const { t } = useTranslation()
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
                      <StatusBadge status={isSent ? 'sent' : notification.status} />
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
