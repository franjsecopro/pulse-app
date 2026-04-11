import { api } from './api'
import type { DashboardSummary, Alert, UpcomingClasses } from '../types'

function buildQuery(params: Record<string, number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${k}=${v}`).join('&')
}

export const dashboardService = {
  getSummary: (month?: number, year?: number) =>
    api.get<DashboardSummary>(`/dashboard/summary${buildQuery({ month, year })}`),

  getAlerts: (month?: number, year?: number) =>
    api.get<Alert[]>(`/dashboard/alerts${buildQuery({ month, year })}`),

  getUpcoming: () =>
    api.get<UpcomingClasses>('/dashboard/upcoming'),
}
