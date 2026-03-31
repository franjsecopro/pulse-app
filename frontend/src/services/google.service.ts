import { api } from './api'

export interface EventPreview {
  google_event_id: string
  summary: string
  class_date: string
  class_time: string | null
  duration_hours: number
  suggested_client_id: number | null
  suggested_client_name: string | null
  match_type: 'exact' | 'partial' | 'none'
  confidence: number
  already_imported: boolean
}

export interface ConfirmEventItem {
  google_event_id: string
  class_date: string
  class_time: string | null
  duration_hours: number
  client_id: number
  hourly_rate: number
  notes?: string
}

export const googleService = {
  getStatus: () => api.get<{ connected: boolean }>('/google/status'),

  getAuthUrl: () => api.get<{ url: string }>('/google/auth-url'),

  disconnect: () => api.delete<{ disconnected: boolean }>('/google/disconnect'),

  previewSync: (month: number, year: number) =>
    api.get<EventPreview[]>(`/google/sync?month=${month}&year=${year}`),

  confirmSync: (events: ConfirmEventItem[]) =>
    api.post<{ created: number }>('/google/sync/confirm', { events }),
}
