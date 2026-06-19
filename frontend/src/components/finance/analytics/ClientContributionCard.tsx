import { useTranslation } from '../../../i18n'
import type { ClientContributionItem } from '../../../types'
import { formatCurrency } from '../../../utils/formatters'

interface ClientContributionCardProps {
  items: ClientContributionItem[]
}

/** Per-student contribution to income + reliability (held vs cancelled). */
export function ClientContributionCard({ items }: ClientContributionCardProps) {
  const { t } = useTranslation()

  return (
    <div className='bg-white rounded-xl border border-slate-200 shadow-sm p-5'>
      <h3 className='text-sm font-bold text-slate-800 mb-4'>{t('analytics.contribution.title')}</h3>
      {items.length === 0 ? (
        <div className='text-center py-10 text-slate-400 text-sm'>
          {t('analytics.contribution.empty')}
        </div>
      ) : (
        <ul className='space-y-3'>
          {items.map((item) => {
            const cancelledTotal = item.cancelledPaidCount + item.cancelledUnpaidCount
            return (
              <li key={item.clientId} className='space-y-1'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='font-medium text-slate-700'>{item.clientName}</span>
                  <span className='font-bold text-slate-900'>
                    {formatCurrency(item.billed)}
                    {item.sharePct !== null && (
                      <span className='text-xs font-medium text-slate-400'>
                        {' '}
                        · {item.sharePct.toFixed(0)}%
                      </span>
                    )}
                  </span>
                </div>
                {/* Share bar */}
                <div className='h-1.5 w-full rounded-full bg-slate-100 overflow-hidden'>
                  <div
                    className='h-full rounded-full bg-primary'
                    style={{ width: `${item.sharePct ?? 0}%` }}
                  />
                </div>
                {/* Reliability sub-line */}
                <div className='flex items-center gap-3 text-xs text-slate-400'>
                  <span>{t('analytics.contribution.held', { count: item.heldCount })}</span>
                  {cancelledTotal > 0 && (
                    <span>{t('analytics.contribution.cancelled', { count: cancelledTotal })}</span>
                  )}
                  {item.lostRevenue > 0 && (
                    <span className='text-red-400'>
                      {t('analytics.contribution.lost', {
                        amount: formatCurrency(item.lostRevenue),
                      })}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
