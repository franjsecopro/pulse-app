import { analyticsKeys } from './analyticsKeys'

export interface AnalyticsPeriodFilters {
  from: string
  to: string
}

export const getAnalyticsOverviewQueryKeys = ({ from, to }: AnalyticsPeriodFilters) => [
  ...analyticsKeys.overview,
  { from, to },
]

export const getAnalyticsRevenueSeriesQueryKeys = ({ from, to }: AnalyticsPeriodFilters) => [
  ...analyticsKeys.revenueSeries,
  { from, to },
]

export const getAnalyticsReceivablesQueryKeys = () => [...analyticsKeys.receivables]

export const getAnalyticsProjectionQueryKeys = (horizon: string) => [
  ...analyticsKeys.projection,
  { horizon },
]

export const getAnalyticsClientContributionQueryKeys = ({ from, to }: AnalyticsPeriodFilters) => [
  ...analyticsKeys.clientContribution,
  { from, to },
]
