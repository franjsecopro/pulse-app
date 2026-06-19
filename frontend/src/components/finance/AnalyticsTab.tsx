import { useState } from 'react'
import { useQueryRequest } from '../../hooks/reactQuery'
import {
  useAnalyticsClientContribution,
  useAnalyticsOverview,
  useAnalyticsProjection,
  useAnalyticsReceivables,
  useAnalyticsRevenueSeries,
} from '../../hooks/useAnalytics'
import { useTranslation } from '../../i18n'
import { businessProfileService } from '../../services/business_profile.service'
import { ClientContributionCard } from './analytics/ClientContributionCard'
import { GoalCard } from './analytics/GoalCard'
import { OverviewCards } from './analytics/OverviewCards'
import { ProjectionCard } from './analytics/ProjectionCard'
import { ReceivablesCard } from './analytics/ReceivablesCard'
import { RevenueTrendCard } from './analytics/RevenueTrendCard'

interface AnalyticsTabProps {
  /** Shared filters — controlled by the Finances container. */
  month: number | ''
  year: number
}

/** Number of months shown in the trend / overview window, ending at the selected month. */
const WINDOW_MONTHS = 6

function toPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function shiftPeriod(year: number, month: number, deltaMonths: number): [number, number] {
  const total = year * 12 + (month - 1) + deltaMonths
  return [Math.floor(total / 12), (total % 12) + 1]
}

export function AnalyticsTab({ month, year }: AnalyticsTabProps) {
  const { t } = useTranslation()
  const [horizon, setHorizon] = useState('next_month')

  const now = new Date()
  const endMonth = typeof month === 'number' ? month : now.getMonth() + 1
  const periodTo = toPeriod(year, endMonth)
  const [fromYear, fromMonth] = shiftPeriod(year, endMonth, -(WINDOW_MONTHS - 1))
  const periodFrom = toPeriod(fromYear, fromMonth)

  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(periodFrom, periodTo)
  const { data: series = [] } = useAnalyticsRevenueSeries(periodFrom, periodTo)
  const { data: receivables = [] } = useAnalyticsReceivables()
  const { data: projection } = useAnalyticsProjection(horizon)
  const { data: clientContribution = [] } = useAnalyticsClientContribution(periodFrom, periodTo)
  const { data: profile } = useQueryRequest({
    queryKey: ['businessProfile'],
    queryFn: () => businessProfileService.get(),
  })

  // Goal compares the configured monthly target against the latest month's collection.
  const latestPoint = series.find((p) => p.period === periodTo)
  const collectedThisMonth = latestPoint?.paid ?? 0

  if (overviewLoading) {
    return (
      <div className='flex items-center justify-center h-40'>
        <span className='material-symbols-outlined text-primary text-3xl animate-spin'>sync</span>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <p className='text-xs text-slate-400'>
        {t('analytics.rangeHint', { from: periodFrom, to: periodTo })}
      </p>

      <OverviewCards overview={overview} />

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <GoalCard goal={profile?.monthlyIncomeGoal ?? null} collected={collectedThisMonth} />
        <ProjectionCard projection={projection} horizon={horizon} onHorizonChange={setHorizon} />
      </div>

      <RevenueTrendCard data={series} />

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
        <ReceivablesCard items={receivables} />
        <ClientContributionCard items={clientContribution} />
      </div>
    </div>
  )
}
