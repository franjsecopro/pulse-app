import type { GoogleCalendarStatus } from '../types'
import { api } from './api'
import { ENDPOINTS } from './endpoints'

export const googleCalendarService = {
  getStatus: () => api.get<GoogleCalendarStatus>(ENDPOINTS.googleCalendar.status),

  getConnectUrl: () => api.get<{ url: string }>(ENDPOINTS.googleCalendar.connect),

  disconnect: () => api.delete(ENDPOINTS.googleCalendar.disconnect),
}
