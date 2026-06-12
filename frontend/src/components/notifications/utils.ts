import i18n from '../../i18n'
import type { AppNotification } from '../../types'
import type { NotificationFilterValues } from './NotificationFilters'

export function matchesStatusFilter(
  notification: AppNotification,
  filter: NotificationFilterValues['status'],
): boolean {
  if (filter === 'all') return true
  return notification.status === filter
}

export function matchesClientFilter(
  notification: AppNotification,
  clientId: NotificationFilterValues['clientId'],
): boolean {
  if (clientId === 'all') return true
  return notification.clientId === clientId
}

export function matchesChannelFilter(
  notification: AppNotification,
  channel: NotificationFilterValues['channel'],
): boolean {
  if (channel === 'all') return true
  return notification.channel === channel
}

/** Formats an ISO timestamp as a localized HH:MM. */
export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface FormatDateArgs {
  t: (key: string, options?: Record<string, unknown>) => string
  dateStr: string
}

/** Formats an ISO date as "martes 14 de abril" using the active locale's word lists. */
export function formatDateEs({ t, dateStr }: FormatDateArgs): string {
  const days: string[] = t('common.weekdays.full', {
    returnObjects: true,
  }) as unknown as string[]
  const monthsLower: string[] = t('common.months.lowercase', {
    returnObjects: true,
  }) as unknown as string[]
  const d = new Date(`${dateStr}T00:00:00`)
  return `${days[d.getDay()]} ${d.getDate()} de ${monthsLower[d.getMonth()]}`
}
