// biome-ignore-all lint/style/useNamingConvention: backend wire format uses snake_case
import type {
  AppNotification,
  NotificationLogFilters,
  NotificationLogPage,
  NotificationSettings,
} from '../types'
import { api } from './api'
import { buildQuery } from './query'

/** Backend response uses snake_case; the public TS shape uses camelCase. */
type NotificationSettingsWire = {
  default_channel: NotificationSettings['defaultChannel']
  message_template: NotificationSettings['messageTemplate']
}

function fromWire(wire: NotificationSettingsWire): NotificationSettings {
  return {
    defaultChannel: wire.default_channel,
    messageTemplate: wire.message_template,
  }
}

function toWire(data: Partial<NotificationSettings>): Partial<NotificationSettingsWire> {
  const wire: Partial<NotificationSettingsWire> = {}
  if (data.defaultChannel !== undefined) wire.default_channel = data.defaultChannel
  if (data.messageTemplate !== undefined) wire.message_template = data.messageTemplate
  return wire
}

export const notificationsService = {
  getPending(date?: string): Promise<AppNotification[]> {
    return api.get<AppNotification[]>(`/notifications/pending${buildQuery({ date })}`)
  },

  generate(targetDate?: string): Promise<AppNotification[]> {
    return api.post<AppNotification[]>(
      `/notifications/generate${buildQuery({ target_date: targetDate })}`,
      {},
    )
  },

  markSent(id: number): Promise<{ id: number; status: string; sent_at: string }> {
    return api.post(`/notifications/${id}/mark-sent`, {})
  },

  getLog(filters: NotificationLogFilters): Promise<NotificationLogPage> {
    return api.get<NotificationLogPage>(`/notifications/log${buildQuery(filters)}`)
  },

  getSettings(): Promise<NotificationSettings> {
    return api.get<NotificationSettingsWire>('/notifications/settings').then(fromWire)
  },

  updateSettings(data: Partial<NotificationSettings>): Promise<NotificationSettings> {
    return api.put<NotificationSettingsWire>('/notifications/settings', toWire(data)).then(fromWire)
  },
}
