import type { NotificationLogFilters } from '../../../types'
import { hasValidFilters } from '../hasValidFilters'
import { notificationsKeys } from './notificationsKeys'

export const getNotificationsPendingQueryKeys = (date: string) => {
  const { pending } = notificationsKeys
  const query: unknown[] = [...pending]
  if (hasValidFilters(date)) query.push(date)
  return query
}

export const getNotificationsLogQueryKeys = (filters: NotificationLogFilters) => {
  const { log } = notificationsKeys
  const query: unknown[] = [...log]
  if (hasValidFilters(filters)) query.push(filters)
  return query
}
