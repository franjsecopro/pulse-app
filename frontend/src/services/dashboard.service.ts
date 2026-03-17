import { api } from './api'
import type { DashboardSummary, Alert } from '../types'

export const dashboardService = {
  getSummary: () => api.get<DashboardSummary>('/dashboard/summary'),
  getAlerts: () => api.get<Alert[]>('/dashboard/alerts'),
}
