import type { AccountingSummaryEntry, StatementImportRecord } from '../types'
import { api } from './api'

export const accountingService = {
  getMonthlySummary: (month: number, year: number) =>
    api.get<AccountingSummaryEntry[]>(`/accounting/summary?month=${month}&year=${year}`),

  getClientBalance: (clientId: number) =>
    api.get<{
      client_id: number
      client_name: string
      total_expected: number
      total_paid: number
      balance: number
    }>(`/accounting/client/${clientId}`),

  getStatementHistory: () => api.get<StatementImportRecord[]>('/imports/history'),

  deleteStatementImport: (id: number) =>
    api.delete<{ deleted: number; payments_deleted: number }>(`/imports/${id}`),

  getReport: (month: number, year: number, clientId?: number | '') => {
    const params = new URLSearchParams({ month: String(month), year: String(year) })
    if (clientId !== undefined && clientId !== '') params.set('client_id', String(clientId))
    return api.getBlob(`/accounting/report?${params.toString()}`)
  },
}
