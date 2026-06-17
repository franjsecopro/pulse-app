import type { Payment } from '../types'
import { api } from './api'
import { ENDPOINTS } from './endpoints'
import { buildQuery } from './query'

export const paymentService = {
  getAll: (params?: {
    clientId?: number
    month?: number
    year?: number
    status?: string
    limit?: number
    offset?: number
  }) =>
    api.getPageable<Payment[]>(
      `${ENDPOINTS.payments.base}${buildQuery({
        clientId: params?.clientId,
        month: params?.month,
        year: params?.year,
        status: params?.status,
        limit: params?.limit,
        offset: params?.offset,
      })}`,
    ),

  create: (data: {
    clientId?: number | null
    amount: number
    paymentDate: string
    concept?: string | null
    source?: string
    status?: string
    notes?: string | null
  }) => api.post<Payment>(ENDPOINTS.payments.base, data),

  update: (id: number, data: Partial<Payment>) =>
    api.put<Payment>(ENDPOINTS.payments.byId(id), data),

  delete: (id: number) => api.delete(ENDPOINTS.payments.byId(id)),
}
