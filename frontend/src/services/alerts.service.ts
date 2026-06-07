import type { Alert, AlertType } from '../types'
import { api } from './api'

function buildQuery(params: Record<string, number | string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return ''
  return `?${entries.map(([k, v]) => `${k}=${v}`).join('&')}`
}

export const alertsService = {
  getAlerts: (params: { month?: number; year?: number; types?: AlertType[] } = {}) =>
    api.get<Alert[]>(`/alerts${buildQuery(params as Record<string, number | string | undefined>)}`),
}
