import type { DashboardSummary, UpcomingClasses } from '../types'
import { api } from './api'

function buildQuery(params: Record<string, number | string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return ''
  return `?${entries.map(([k, v]) => `${k}=${v}`).join('&')}`
}

export const dashboardService = {
  getSummary: (month?: number, year?: number) =>
    api.get<DashboardSummary>(`/dashboard/summary${buildQuery({ month, year })}`),

  getUpcoming: () => api.get<UpcomingClasses>('/dashboard/upcoming'),
}
