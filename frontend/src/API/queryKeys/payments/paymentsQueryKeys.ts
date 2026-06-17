import { hasValidFilters } from '../hasValidFilters'
import { paymentsKeys } from './paymentsKeys'

export interface PaymentsListFilters {
  month?: number
  year?: number
  clientId?: number
  status?: string
  page: number
}

export const getPaymentsAllQueryKeys = () => {
  const { all } = paymentsKeys
  return [...all]
}

export const getPaymentsListQueryKeys = (filters: PaymentsListFilters) => {
  const { list } = paymentsKeys
  const query: unknown[] = [...list]
  if (hasValidFilters(filters)) query.push(filters)
  return query
}

export const getPaymentsStatementHistoryQueryKeys = () => {
  const { statementHistory } = paymentsKeys
  return [...statementHistory]
}
