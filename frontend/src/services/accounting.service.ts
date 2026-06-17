import type { AccountingSummaryEntry, StatementImportRecord } from '../types'
import { api } from './api'
import { ENDPOINTS } from './endpoints'
import { buildQuery } from './query'

export const accountingService = {
  getMonthlySummary: (month: number, year: number) =>
    api.get<AccountingSummaryEntry[]>(
      `${ENDPOINTS.accounting.summary}${buildQuery({ month, year })}`,
    ),

  getClientBalance: (clientId: number) =>
    api.get<{
      clientId: number
      clientName: string
      totalExpected: number
      totalPaid: number
      balance: number
    }>(ENDPOINTS.accounting.client(clientId)),

  getStatementHistory: () => api.get<StatementImportRecord[]>(ENDPOINTS.imports.history),

  deleteStatementImport: (id: number) =>
    api.delete<{ deleted: number; paymentsDeleted: number }>(ENDPOINTS.imports.byId(id)),

  getReport: (month: number, year: number, clientId?: number | '') =>
    api.getBlob(
      `${ENDPOINTS.accounting.report}${buildQuery({
        month,
        year,
        clientId: clientId || undefined,
      })}`,
    ),
}
