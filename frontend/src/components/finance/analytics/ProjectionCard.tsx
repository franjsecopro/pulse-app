import { useTranslation } from '../../../i18n'
import type { ProjectionResponse } from '../../../types'
import { formatCurrency } from '../../../utils/formatters'
import { FINANCE_SELECT_CLASS } from '../FinanceFilters'

const HORIZONS = [
  'this_month',
  'this_year',
  'rest_of_year',
  'next_month',
  'next_quarter',
  'next_year',
] as const

interface ProjectionCardProps {
  projection?: ProjectionResponse
  horizon: string
  onHorizonChange: (horizon: string) => void
}

/** Human label for the covered period: full month → "Julio 2026", full year → "2026",
 * otherwise a "dd/mm – dd/mm/yyyy" range. */
function formatPeriod(start: string, end: string, months: string[]): string {
  const [startYear, startMonth, startDay] = start.split('-').map(Number)
  const [endYear, endMonth, endDay] = end.split('-').map(Number)
  const lastDay = new Date(endYear, endMonth, 0).getDate()

  if (startYear === endYear && startMonth === endMonth && startDay === 1 && endDay === lastDay) {
    return `${months[startMonth - 1]} ${startYear}`
  }
  if (
    startYear === endYear &&
    startMonth === 1 &&
    startDay === 1 &&
    endMonth === 12 &&
    endDay === 31
  ) {
    return `${startYear}`
  }
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(startDay)}/${pad(startMonth)} – ${pad(endDay)}/${pad(endMonth)}/${endYear}`
}

/** Scheduled revenue + net for the chosen calendar period. */
export function ProjectionCard({ projection, horizon, onHorizonChange }: ProjectionCardProps) {
  const { t } = useTranslation()
  const months = t('common.months.full', { returnObjects: true }) as string[]
  const revenue = projection?.projectedRevenue ?? 0
  const net = projection?.projectedNet ?? null

  return (
    <div className='bg-white rounded-xl border border-slate-200 shadow-sm p-5'>
      <div className='flex items-center justify-between mb-1'>
        <h3 className='text-sm font-bold text-slate-800'>{t('analytics.projection.title')}</h3>
        <select
          value={horizon}
          onChange={(e) => onHorizonChange(e.target.value)}
          className={FINANCE_SELECT_CLASS}
        >
          {HORIZONS.map((h) => (
            <option key={h} value={h}>
              {t(`analytics.projection.horizon.${h}`)}
            </option>
          ))}
        </select>
      </div>

      {projection && (
        <p className='text-xs text-slate-400 mb-3'>
          {formatPeriod(projection.periodStart, projection.periodEnd, months)}
        </p>
      )}

      {revenue === 0 ? (
        <div className='py-6 text-center text-sm text-slate-400'>
          {t('analytics.projection.empty')}
        </div>
      ) : (
        <div className='space-y-3'>
          <div>
            <p className='text-xs text-slate-500 uppercase tracking-wide'>
              {t('analytics.projection.revenue')}
            </p>
            <p className='text-2xl font-black text-slate-900'>{formatCurrency(revenue)}</p>
          </div>
          <div>
            <p className='text-xs text-slate-500 uppercase tracking-wide'>
              {t('analytics.projection.net')}
            </p>
            <p className='text-lg font-bold text-indigo-600'>
              {net === null ? t('analytics.projection.netNotConfigured') : formatCurrency(net)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
