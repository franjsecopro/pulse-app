import { api } from './api'
import type { Payment } from '../types'

export const paymentService = {
  getAll: (params?: { client_id?: number; month?: number; year?: number; status?: string }) => {
    const query = new URLSearchParams()
    if (params?.client_id) query.set('client_id', String(params.client_id))
    if (params?.month) query.set('month', String(params.month))
    if (params?.year) query.set('year', String(params.year))
    if (params?.status) query.set('status', params.status)
    const qs = query.toString()
    return api.get<Payment[]>(`/payments${qs ? `?${qs}` : ''}`)
  },

  create: (data: {
    client_id?: number | null
    amount: number
    payment_date: string
    concept?: string | null
    source?: string
    status?: string
    notes?: string | null
  }) => api.post<Payment>('/payments', data),

  update: (id: number, data: Partial<Payment>) =>
    api.put<Payment>(`/payments/${id}`, data),

  delete: (id: number) => api.delete(`/payments/${id}`),
}
