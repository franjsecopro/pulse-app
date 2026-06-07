import type { Alert, AlertType } from '../types'
import { api } from './api'
import { buildQuery } from './query'

export const alertsService = {
  getAlerts: (params: { month?: number; year?: number; types?: AlertType[] } = {}) =>
    api.get<Alert[]>(
      `/alerts${buildQuery({ month: params.month, year: params.year, types: params.types })}`,
    ),
}
