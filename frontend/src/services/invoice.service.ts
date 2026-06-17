import type { Invoice, SendInvoiceResult } from '../types'
import { api } from './api'
import { ENDPOINTS } from './endpoints'
import { buildQuery } from './query'

export const invoiceService = {
  getAll: (params?: {
    clientId?: number
    status?: string
    month?: number
    year?: number
    limit?: number
    offset?: number
  }) =>
    api.getPageable<Invoice[]>(
      `${ENDPOINTS.invoices.base}${buildQuery({
        clientId: params?.clientId,
        status: params?.status,
        month: params?.month,
        year: params?.year,
        limit: params?.limit,
        offset: params?.offset,
      })}`,
    ),

  getById: (id: number) => api.get<Invoice>(ENDPOINTS.invoices.byId(id)),

  getByClass: (classId: number) =>
    api.get<Invoice[]>(ENDPOINTS.invoices.byClass(classId)),

  createFromClass: (classId: number) =>
    api.post<Invoice>(ENDPOINTS.invoices.fromClass(classId), {}),

  createFromPeriod: (data: {
    clientId: number
    month?: number
    year?: number
    endMonth?: number
    endYear?: number
    periodStart?: string
    periodEnd?: string
  }) => api.post<Invoice>(ENDPOINTS.invoices.fromPeriod, data),

  issue: (id: number) => api.post<Invoice>(ENDPOINTS.invoices.issue(id), {}),

  share: (id: number) => api.post<{ url: string }>(ENDPOINTS.invoices.share(id), {}),

  send: (id: number, data: { email?: string; phone?: string }) =>
    api.post<SendInvoiceResult>(ENDPOINTS.invoices.send(id), data),

  downloadPdf: (id: number) => api.getBlob(ENDPOINTS.invoices.pdf(id)),
}
