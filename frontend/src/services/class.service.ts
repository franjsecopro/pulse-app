import type { ClassSession, ClassStats } from '../types'
import { api } from './api'
import { ENDPOINTS } from './endpoints'
import { buildQuery } from './query'

export const classService = {
  getAll: (params?: {
    clientId?: number
    month?: number
    year?: number
    limit?: number
    offset?: number
  }) =>
    api.getPageable<ClassSession[]>(
      `${ENDPOINTS.classes.base}${buildQuery({
        clientId: params?.clientId,
        month: params?.month,
        year: params?.year,
        limit: params?.limit,
        offset: params?.offset,
      })}`,
    ),

  getStats: (params: { month: number; year: number; clientId?: number | '' }) =>
    api.get<ClassStats>(
      `${ENDPOINTS.classes.stats}${buildQuery({
        month: params.month,
        year: params.year,
        clientId: params.clientId || undefined,
      })}`,
    ),

  create: (data: {
    clientId: number
    contractId?: number | null
    classDate: string
    classTime?: string | null
    durationHours: number
    hourlyRate: number
    notes?: string | null
  }) => api.post<ClassSession>(ENDPOINTS.classes.base, data),

  update: (id: number, data: Partial<ClassSession>) =>
    api.put<ClassSession>(ENDPOINTS.classes.byId(id), data),

  delete: (id: number) => api.delete(ENDPOINTS.classes.byId(id)),

  syncGCal: () => api.post<{ scheduled: number }>(ENDPOINTS.classes.syncGCal, {}),

  /** Manually retry the Google Calendar sync for a single class (202 Accepted). */
  syncCalendar: (id: number) =>
    api.post<{ status: string }>(ENDPOINTS.classes.syncCalendar(id), {}),
}
