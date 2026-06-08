import type { ClassSession } from '../types'
import { api } from './api'

export const classService = {
  getAll: (params?: {
    clientId?: number
    month?: number
    year?: number
    limit?: number
    offset?: number
  }) => {
    const query = new URLSearchParams()
    if (params?.clientId) query.set('clientId', String(params.clientId))
    if (params?.month) query.set('month', String(params.month))
    if (params?.year) query.set('year', String(params.year))
    if (params?.limit != null) query.set('limit', String(params.limit))
    if (params?.offset != null) query.set('offset', String(params.offset))
    const qs = query.toString()
    return api.getPageable<ClassSession[]>(`/classes${qs ? `?${qs}` : ''}`)
  },

  create: (data: {
    clientId: number
    contractId?: number | null
    classDate: string
    classTime?: string | null
    durationHours: number
    hourlyRate: number
    notes?: string | null
  }) => api.post<ClassSession>('/classes', data),

  update: (id: number, data: Partial<ClassSession>) =>
    api.put<ClassSession>(`/classes/${id}`, data),

  delete: (id: number) => api.delete(`/classes/${id}`),

  syncGCal: () => api.post<{ scheduled: number }>('/classes/sync-gcal', {}),
}
