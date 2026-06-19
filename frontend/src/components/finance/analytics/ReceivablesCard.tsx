import { useTranslation } from '../../../i18n'
import type { ReceivableItem } from '../../../types'
import { formatCurrency } from '../../../utils/formatters'

interface ReceivablesCardProps {
  items: ReceivableItem[]
}

/** Who owes money, ranked by debt (most owed first). */
export function ReceivablesCard({ items }: ReceivablesCardProps) {
  const { t } = useTranslation()

  return (
    <div className='bg-white rounded-xl border border-slate-200 shadow-sm p-5'>
      <h3 className='text-sm font-bold text-slate-800 mb-4'>{t('analytics.receivables.title')}</h3>
      {items.length === 0 ? (
        <div className='text-center py-10 text-slate-400 text-sm flex flex-col items-center gap-2'>
          <span className='material-symbols-outlined text-3xl text-emerald-300'>check_circle</span>
          {t('analytics.receivables.empty')}
        </div>
      ) : (
        <ul className='divide-y divide-slate-100'>
          {items.map((item) => (
            <li key={item.clientId} className='flex items-center justify-between py-2.5'>
              <span className='text-sm font-medium text-slate-700'>{item.clientName}</span>
              <span className='text-sm font-bold text-red-500'>{formatCurrency(item.balance)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
