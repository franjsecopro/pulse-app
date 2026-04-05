import { api } from './api'
import type { GoogleCalendarStatus } from '../types'

export const googleCalendarService = {
  getStatus: () => api.get<GoogleCalendarStatus>('/google-calendar/status'),

  getConnectUrl: () => api.get<{ url: string }>('/google-calendar/connect'),

  disconnect: () => api.delete('/google-calendar/disconnect'),

  syncClass: (classId: number) =>
    api.post<{ status: string }>(`/classes/${classId}/sync-calendar`, {}),
}
