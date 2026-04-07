import { api } from './api'
import type { AccountingSummaryEntry, PDFImportRecord } from '../types'

export const accountingService = {
  getMonthlySummary: (month: number, year: number) =>
    api.get<AccountingSummaryEntry[]>(`/accounting/summary?month=${month}&year=${year}`),

  getClientBalance: (clientId: number) =>
    api.get<{ client_id: number; client_name: string; total_expected: number; total_paid: number; balance: number }>(
      `/accounting/client/${clientId}`
    ),

  getPdfHistory: () =>
    api.get<PDFImportRecord[]>('/imports/pdf-history'),
}
