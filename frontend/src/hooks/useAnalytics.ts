import {
  getAnalyticsClientContributionQueryKeys,
  getAnalyticsOverviewQueryKeys,
  getAnalyticsProjectionQueryKeys,
  getAnalyticsReceivablesQueryKeys,
  getAnalyticsRevenueSeriesQueryKeys,
} from '../API/queryKeys/analytics/analyticsQueryKeys'
import { analyticsService } from '../services/analytics.service'
import type {
  AnalyticsOverview,
  ClientContributionItem,
  ProjectionResponse,
  ReceivableItem,
  RevenueTimeseriesPoint,
} from '../types'
import { useQueryRequest } from './reactQuery'

export function useAnalyticsRevenueSeries(from: string, to: string) {
  return useQueryRequest<RevenueTimeseriesPoint[]>({
    queryKey: getAnalyticsRevenueSeriesQueryKeys({ from, to }),
    queryFn: () => analyticsService.revenueSeries(from, to),
    enabled: Boolean(from && to),
  })
}

export function useAnalyticsOverview(from: string, to: string) {
  return useQueryRequest<AnalyticsOverview>({
    queryKey: getAnalyticsOverviewQueryKeys({ from, to }),
    queryFn: () => analyticsService.overview(from, to),
    enabled: Boolean(from && to),
  })
}

export function useAnalyticsReceivables() {
  return useQueryRequest<ReceivableItem[]>({
    queryKey: getAnalyticsReceivablesQueryKeys(),
    queryFn: () => analyticsService.receivables(),
  })
}

export function useAnalyticsProjection(horizon: string) {
  return useQueryRequest<ProjectionResponse>({
    queryKey: getAnalyticsProjectionQueryKeys(horizon),
    queryFn: () => analyticsService.projection(horizon),
    enabled: Boolean(horizon),
  })
}

export function useAnalyticsClientContribution(from: string, to: string) {
  return useQueryRequest<ClientContributionItem[]>({
    queryKey: getAnalyticsClientContributionQueryKeys({ from, to }),
    queryFn: () => analyticsService.clientContribution(from, to),
    enabled: Boolean(from && to),
  })
}
