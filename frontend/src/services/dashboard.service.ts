import type { DashboardSummary, UpcomingClasses } from '../types'
import { api } from './api'
import { ENDPOINTS } from './endpoints'
import { buildQuery } from './query'

export const dashboardService = {
  getSummary: (month?: number, year?: number) =>
    api.get<DashboardSummary>(
      `${ENDPOINTS.dashboard.summary}${buildQuery({ month, year })}`,
    ),

  getUpcoming: () => api.get<UpcomingClasses>(ENDPOINTS.dashboard.upcoming),
}
