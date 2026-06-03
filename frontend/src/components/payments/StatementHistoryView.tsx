import { useTranslation } from '../../i18n'
import type { StatementImportRecord } from '../../types'

interface StatementHistoryViewProps {
  records: StatementImportRecord[]
  isLoading: boolean
  /** Only admins can delete imports; the trash column is hidden otherwise. */
  isAdmin?: boolean
  onDelete?: (id: number) => void
}

export function StatementHistoryView({
  records,
  isLoading,
  isAdmin = false,
  onDelete,
}: StatementHistoryViewProps) {
  const { t } = useTranslation()
  const months = t('common.months.full', { returnObjects: true }) as string[]

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-32'>
        <span className='material-symbols-outlined text-primary text-3xl animate-spin'>sync</span>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className='text-center py-16 bg-white rounded-xl border border-slate-200'>
        <span className='material-symbols-outlined text-5xl text-slate-300 block mb-3'>
          upload_file
        </span>
        <p className='text-slate-500 font-medium'>{t('statements.empty')}</p>
        <p className='text-slate-400 text-sm mt-1'>{t('statements.emptyHint')}</p>
      </div>
    )
  }

  return (
    <div className='bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden'>
      <table className='w-full text-sm'>
        <thead className='bg-slate-50 border-b border-slate-200'>
          <tr>
            <th className='text-left px-5 py-3 font-semibold text-slate-600'>
              {t('statements.table.file')}
            </th>
            <th className='text-left px-4 py-3 font-semibold text-slate-600'>
              {t('statements.table.month')}
            </th>
            <th className='text-left px-4 py-3 font-semibold text-slate-600'>
              {t('statements.table.importDate')}
            </th>
            <th className='text-right px-4 py-3 font-semibold text-slate-600'>
              {t('statements.table.transactions')}
            </th>
            <th className='text-right px-5 py-3 font-semibold text-slate-600'>
              {t('statements.table.total')}
            </th>
            {isAdmin && (
              <th className='px-4 py-3 w-12' aria-label={t('statements.table.actions')}></th>
            )}
          </tr>
        </thead>
        <tbody className='divide-y divide-slate-100'>
          {records.map((record) => (
            <tr key={record.id} className='hover:bg-slate-50 transition-colors'>
              <td className='px-5 py-4'>
                <div className='flex items-center gap-2 text-slate-700'>
                  <span className='material-symbols-outlined text-slate-400 text-base'>
                    description
                  </span>
                  <span className='font-medium truncate max-w-[200px]' title={record.filename}>
                    {record.filename}
                  </span>
                </div>
              </td>
              <td className='px-4 py-4 text-slate-600'>
                {record.month && record.year ? `${months[record.month - 1]} ${record.year}` : '—'}
              </td>
              <td className='px-4 py-4 text-slate-500'>
                {new Date(record.imported_at).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className='px-4 py-4 text-right text-slate-700 font-medium'>
                {record.transaction_count}
              </td>
              <td className='px-5 py-4 text-right font-bold text-slate-900'>
                €{record.total_amount.toFixed(2)}
              </td>
              {isAdmin && (
                <td className='px-4 py-4 text-right'>
                  <button
                    type='button'
                    onClick={() => onDelete?.(record.id)}
                    title={t('statements.deleteTooltip')}
                    className='p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors'
                  >
                    <span className='material-symbols-outlined text-base'>delete</span>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
