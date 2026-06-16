import type { Invoice, SendInvoiceResult } from '../types'
import { api } from './api'

export const invoiceService = {
  getAll: (params?: {
    clientId?: number
    status?: string
    month?: number
    year?: number
    limit?: number
    offset?: number
  }) => {
    const qs = new URLSearchParams()
    if (params?.clientId) qs.set('clientId', String(params.clientId))
    if (params?.status) qs.set('status', params.status)
    if (params?.month) qs.set('month', String(params.month))
    if (params?.year) qs.set('year', String(params.year))
    if (params?.limit != null) qs.set('limit', String(params.limit))
    if (params?.offset != null) qs.set('offset', String(params.offset))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return api.getPageable<Invoice[]>(`/invoices${suffix}`)
  },

  getById: (id: number) => api.get<Invoice>(`/invoices/${id}`),

  createFromClass: (classId: number) => api.post<Invoice>(`/invoices/from-class/${classId}`, {}),

  createFromPeriod: (data: {
    clientId: number
    month?: number
    year?: number
    endMonth?: number
    endYear?: number
    periodStart?: string
    periodEnd?: string
  }) => api.post<Invoice>('/invoices/from-period', data),

  issue: (id: number) => api.post<Invoice>(`/invoices/${id}/issue`, {}),

  share: (id: number) => api.post<{ url: string }>(`/invoices/${id}/share`, {}),

  send: (id: number, data: { email?: string; phone?: string }) =>
    api.post<SendInvoiceResult>(`/invoices/${id}/send`, data),

  downloadPdf: (id: number) => api.getBlob(`/invoices/${id}/pdf`),

  // Admin-only hard delete (dev/cleanup tool).
  delete: (id: number) => api.delete(`/invoices/${id}`),
}
