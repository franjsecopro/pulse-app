import { api } from './api'
import type { AccountingSummaryEntry, StatementImportRecord } from '../types'

export const accountingService = {
  getMonthlySummary: (month: number, year: number) =>
    api.get<AccountingSummaryEntry[]>(`/accounting/summary?month=${month}&year=${year}`),

  getClientBalance: (clientId: number) =>
    api.get<{ client_id: number; client_name: string; total_expected: number; total_paid: number; balance: number }>(
      `/accounting/client/${clientId}`
    ),

  getStatementHistory: () =>
    api.get<StatementImportRecord[]>('/imports/history'),
}
