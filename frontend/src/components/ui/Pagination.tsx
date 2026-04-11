interface PaginationProps {
  page: number
  pageCount: number
  totalCount: number
  onPage: (n: number) => void
}

export function Pagination({ page, pageCount, totalCount, onPage }: PaginationProps) {
  if (pageCount <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-white">
      <p className="text-xs text-slate-500">
        Página <span className="font-semibold text-slate-700">{page}</span> de{' '}
        <span className="font-semibold text-slate-700">{pageCount}</span>
        <span className="ml-1 text-slate-400">({totalCount} registros)</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-base">chevron_left</span>
          Anterior
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Siguiente
          <span className="material-symbols-outlined text-base">chevron_right</span>
        </button>
      </div>
    </div>
  )
}
