import { useTranslation } from '../../i18n'

interface PaginationProps {
  page: number
  pageCount: number
  totalCount: number
  onPage: (n: number) => void
}

export function Pagination({ page, pageCount, totalCount, onPage }: PaginationProps) {
  const { t } = useTranslation()

  if (pageCount <= 1) return null

  return (
    <div className='flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-white'>
      <p className='text-xs text-slate-500'>
        {t('pagination.page')} <span className='font-semibold text-slate-700'>{page}</span>{' '}
        {t('pagination.of')} <span className='font-semibold text-slate-700'>{pageCount}</span>
        <span className='ml-1 text-slate-400'>
          ({t('pagination.records', { count: totalCount })})
        </span>
      </p>
      <div className='flex items-center gap-1'>
        <button
          type='button'
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className='flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
        >
          <span className='material-symbols-outlined text-base'>chevron_left</span>
          {t('pagination.previous')}
        </button>
        <button
          type='button'
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          className='flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
        >
          {t('pagination.next')}
          <span className='material-symbols-outlined text-base'>chevron_right</span>
        </button>
      </div>
    </div>
  )
}
