import { useTranslation } from '../../../i18n'
import type { AnalyticsOverview } from '../../../types'
import { formatCurrency } from '../../../utils/formatters'
import { KpiCard } from '../../ui/KpiCard'

interface OverviewCardsProps {
  overview?: AnalyticsOverview
}

/** Headline KPIs for the selected range: collected, collection rate, net, pending. */
export function OverviewCards({ overview }: OverviewCardsProps) {
  const { t } = useTranslation()

  const paid = overview?.paid ?? 0
  const pending = overview?.pending ?? 0
  const collectionRate = overview?.collectionRate ?? null
  const net = overview?.net ?? null

  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
      <KpiCard
        label={t('analytics.kpi.collected')}
        value={formatCurrency(paid)}
        changePct={overview?.paidChangePct}
      />
      <KpiCard
        label={t('analytics.kpi.collectionRate')}
        value={collectionRate === null ? '—' : `${collectionRate.toFixed(0)}%`}
      />
      <KpiCard
        label={t('analytics.kpi.netEstimate')}
        value={net === null ? '—' : formatCurrency(net)}
        caption={net === null ? t('analytics.kpi.netNotConfigured') : undefined}
      />
      <KpiCard
        label={t('analytics.kpi.pending')}
        value={formatCurrency(pending)}
        positiveIsGood={false}
      />
    </div>
  )
}
