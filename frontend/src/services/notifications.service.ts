import type {
  AppNotification,
  NotificationLogFilters,
  NotificationLogPage,
  NotificationSettings,
} from '../types'
import { api } from './api'
import { buildQuery } from './query'

export const notificationsService = {
  getPending(date?: string): Promise<AppNotification[]> {
    return api.get<AppNotification[]>(`/notifications/pending${buildQuery({ date })}`)
  },

  generate(targetDate?: string): Promise<AppNotification[]> {
    return api.post<AppNotification[]>(`/notifications/generate${buildQuery({ targetDate })}`, {})
  },

  markSent(id: number): Promise<{ id: number; status: string; sentAt: string }> {
    return api.post(`/notifications/${id}/mark-sent`, {})
  },

  getLog(filters: NotificationLogFilters): Promise<NotificationLogPage> {
    // Spread into an object literal so the named interface gains an implicit
    // index signature compatible with buildQuery's Record param.
    return api.get<NotificationLogPage>(`/notifications/log${buildQuery({ ...filters })}`)
  },

  getSettings(): Promise<NotificationSettings> {
    return api.get<NotificationSettings>('/notifications/settings')
  },

  updateSettings(data: Partial<NotificationSettings>): Promise<NotificationSettings> {
    return api.put<NotificationSettings>('/notifications/settings', data)
  },
}
