import type {
  AnalyticsOverview,
  ClientContributionItem,
  ProjectionResponse,
  ReceivableItem,
  RevenueTimeseriesPoint,
} from '../types'
import { api } from './api'
import { ENDPOINTS } from './endpoints'
import { buildQuery } from './query'

export const analyticsService = {
  revenueSeries: (from: string, to: string) =>
    api.get<RevenueTimeseriesPoint[]>(
      `${ENDPOINTS.analytics.revenueSeries}${buildQuery({ from, to })}`,
    ),

  overview: (from: string, to: string) =>
    api.get<AnalyticsOverview>(`${ENDPOINTS.analytics.overview}${buildQuery({ from, to })}`),

  receivables: () => api.get<ReceivableItem[]>(ENDPOINTS.analytics.receivables),

  projection: (horizon: string) =>
    api.get<ProjectionResponse>(`${ENDPOINTS.analytics.projection}${buildQuery({ horizon })}`),

  clientContribution: (from: string, to: string) =>
    api.get<ClientContributionItem[]>(
      `${ENDPOINTS.analytics.clientContribution}${buildQuery({ from, to })}`,
    ),
}
