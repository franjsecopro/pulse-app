import { api } from './api'
import type { ClassSession } from '../types'

export const classService = {
  getAll: (params?: { client_id?: number; month?: number; year?: number; limit?: number; offset?: number }) => {
    const query = new URLSearchParams()
    if (params?.client_id) query.set('client_id', String(params.client_id))
    if (params?.month) query.set('month', String(params.month))
    if (params?.year) query.set('year', String(params.year))
    if (params?.limit != null) query.set('limit', String(params.limit))
    if (params?.offset != null) query.set('offset', String(params.offset))
    const qs = query.toString()
    return api.getPageable<ClassSession[]>(`/classes${qs ? `?${qs}` : ''}`)
  },

  create: (data: {
    client_id: number
    contract_id?: number | null
    class_date: string
    class_time?: string | null
    duration_hours: number
    hourly_rate: number
    notes?: string | null
  }) => api.post<ClassSession>('/classes', data),

  update: (id: number, data: Partial<ClassSession>) =>
    api.put<ClassSession>(`/classes/${id}`, data),

  delete: (id: number) => api.delete(`/classes/${id}`),

  syncGCal: (userId: number) =>
    api.post<{ scheduled: number }>(`/admin/users/${userId}/sync-gcal`, {}),
}
