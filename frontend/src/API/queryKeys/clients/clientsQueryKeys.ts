import { hasValidFilters } from '../hasValidFilters'
import { clientsKeys } from './clientsKeys'

export interface ClientsListFilters {
  search?: string
  isActive?: boolean
  deletedFilter?: 'exclude' | 'include' | 'only'
}

export const getClientsAllQueryKeys = () => {
  const { all } = clientsKeys
  return [...all]
}

export const getClientsListQueryKeys = (filters?: ClientsListFilters) => {
  const { list } = clientsKeys
  const query: unknown[] = [...list]
  if (hasValidFilters(filters)) query.push(filters)
  return query
}

export const getClientsDropdownQueryKeys = () => {
  const { dropdown } = clientsKeys
  return [...dropdown]
}
