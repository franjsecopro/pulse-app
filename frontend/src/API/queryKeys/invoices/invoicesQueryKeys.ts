import { hasValidFilters } from '../hasValidFilters'
import { invoicesKeys } from './invoicesKeys'

export interface InvoicesListFilters {
  page: number
  clientId?: number
  status?: string
  month?: number
  year?: number
}

export const getInvoicesAllQueryKeys = () => {
  const { all } = invoicesKeys
  return [...all]
}

export const getInvoicesListQueryKeys = (filters: InvoicesListFilters) => {
  const { list } = invoicesKeys
  const query: unknown[] = [...list]
  if (hasValidFilters(filters)) query.push(filters)
  return query
}
