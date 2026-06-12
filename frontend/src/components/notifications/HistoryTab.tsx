import { useMemo, useState } from 'react'
import { useNotificationLog } from '../../hooks/useNotifications'
import { useTranslation } from '../../i18n'
import type { NotificationLogFilters } from '../../types'
import { todayISO } from '../../utils/formatters'
import { Pagination } from '../ui/Pagination'
import { DateRangeMode, type DateRangeModeValue } from './DateRangeMode'
import { NotificationFilters, type NotificationFilterValues } from './NotificationFilters'
import { StatusBadge } from './StatusBadge'
import { formatDateEs, formatTime } from './utils'

const DEFAULT_FILTERS: NotificationFilterValues = {
  status: 'all',
  clientId: 'all',
  channel: 'all',
}

const HISTORY_PAGE_SIZE = 50

export function HistoryTab() {
  const { t } = useTranslation()
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
      pageSize: HISTORY_PAGE_SIZE,
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
                    <StatusBadge status={notification.status} />
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
