import { useTranslation } from '../../../i18n'
import { formatCurrency } from '../../../utils/formatters'

interface GoalCardProps {
  /** Monthly income goal (null = not configured). */
  goal: number | null
  /** Collected amount for the latest month in the range. */
  collected: number
}

/** Progress toward the configured monthly income goal. */
export function GoalCard({ goal, collected }: GoalCardProps) {
  const { t } = useTranslation()

  if (goal === null || goal <= 0) {
    return (
      <div className='bg-white rounded-xl border border-slate-200 shadow-sm p-5'>
        <h3 className='text-sm font-bold text-slate-800 mb-2'>{t('analytics.goal.title')}</h3>
        <p className='text-sm text-slate-400'>{t('analytics.goal.notConfigured')}</p>
      </div>
    )
  }

  const pct = Math.min(100, Math.round((collected / goal) * 100))
  const reached = collected >= goal

  return (
    <div className='bg-white rounded-xl border border-slate-200 shadow-sm p-5'>
      <h3 className='text-sm font-bold text-slate-800 mb-2'>{t('analytics.goal.title')}</h3>
      <p className='text-2xl font-black text-slate-900'>
        {formatCurrency(collected)}
        <span className='text-sm font-medium text-slate-400'> / {formatCurrency(goal)}</span>
      </p>
      <div className='mt-3 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden'>
        <div
          className={`h-full rounded-full transition-all ${reached ? 'bg-emerald-500' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className='text-xs font-semibold text-slate-500 mt-1.5'>
        {t('analytics.goal.progress', { pct })}
      </p>
    </div>
  )
}
