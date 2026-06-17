import type { AlertType } from '../../../types'
import { hasValidFilters } from '../hasValidFilters'
import { alertsKeys } from './alertsKeys'

export interface AlertsListFilters {
  month?: number
  year?: number
  types?: AlertType[]
}

export const getAlertsListQueryKeys = (filters: AlertsListFilters = {}) => {
  const { list } = alertsKeys
  const query: unknown[] = [...list]
  if (hasValidFilters(filters)) {
    // `types` is a new array ref each render — sort+join keeps the key stable.
    query.push({
      month: filters.month,
      year: filters.year,
      types: filters.types ? [...filters.types].sort().join(',') : '',
    })
  }
  return query
}
