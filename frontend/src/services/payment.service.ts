import type { Payment } from '../types'
import { api } from './api'

export const paymentService = {
  getAll: (params?: {
    clientId?: number
    month?: number
    year?: number
    status?: string
    limit?: number
    offset?: number
  }) => {
    const query = new URLSearchParams()
    if (params?.clientId) query.set('clientId', String(params.clientId))
    if (params?.month) query.set('month', String(params.month))
    if (params?.year) query.set('year', String(params.year))
    if (params?.status) query.set('status', params.status)
    if (params?.limit != null) query.set('limit', String(params.limit))
    if (params?.offset != null) query.set('offset', String(params.offset))
    const qs = query.toString()
    return api.getPageable<Payment[]>(`/payments${qs ? `?${qs}` : ''}`)
  },

  create: (data: {
    clientId?: number | null
    amount: number
    paymentDate: string
    concept?: string | null
    source?: string
    status?: string
    notes?: string | null
  }) => api.post<Payment>('/payments', data),

  update: (id: number, data: Partial<Payment>) => api.put<Payment>(`/payments/${id}`, data),

  delete: (id: number) => api.delete(`/payments/${id}`),
}
