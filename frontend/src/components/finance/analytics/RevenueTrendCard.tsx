import { useTranslation } from '../../../i18n'
import type { RevenueTimeseriesPoint } from '../../../types'
import { formatCompactCurrency, formatCurrency } from '../../../utils/formatters'
import { TrendChart, type TrendSeries } from '../../ui/charts/TrendChart'

interface RevenueTrendCardProps {
  data: RevenueTimeseriesPoint[]
}

/** Monthly expected / collected / net trend over the selected range. */
export function RevenueTrendCard({ data }: RevenueTrendCardProps) {
  const { t } = useTranslation()

  const series: TrendSeries[] = [
    { key: 'expected', label: t('analytics.trend.expected'), color: '#94a3b8' },
    { key: 'paid', label: t('analytics.trend.collected'), color: '#10b981' },
    { key: 'net', label: t('analytics.trend.net'), color: '#6366f1' },
  ]

  const hasData = data.some((p) => p.expected > 0 || p.paid > 0)

  return (
    <div className='bg-white rounded-xl border border-slate-200 shadow-sm p-5'>
      <h3 className='text-sm font-bold text-slate-800 mb-4'>{t('analytics.trend.title')}</h3>
      {hasData ? (
        <TrendChart
          data={data}
          xKey='period'
          series={series}
          formatValue={formatCurrency}
          formatTick={formatCompactCurrency}
        />
      ) : (
        <div className='text-center py-16 text-slate-400 text-sm'>{t('analytics.trend.empty')}</div>
      )}
    </div>
  )
}
