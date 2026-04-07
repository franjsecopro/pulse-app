import { api } from './api'
import type { AppNotification, NotificationSettings } from '../types'

export const notificationsService = {
  getPending(): Promise<AppNotification[]> {
    return api.get<AppNotification[]>('/notifications/pending')
  },

  generate(): Promise<AppNotification[]> {
    return api.post<AppNotification[]>('/notifications/generate', {})
  },

  markSent(id: number): Promise<{ id: number; status: string; sent_at: string }> {
    return api.post(`/notifications/${id}/mark-sent`, {})
  },

  getLog(): Promise<AppNotification[]> {
    return api.get<AppNotification[]>('/notifications/log')
  },

  getSettings(): Promise<NotificationSettings> {
    return api.get<NotificationSettings>('/notifications/settings')
  },

  updateSettings(data: Partial<NotificationSettings>): Promise<NotificationSettings> {
    return api.put<NotificationSettings>('/notifications/settings', data)
  },
}
