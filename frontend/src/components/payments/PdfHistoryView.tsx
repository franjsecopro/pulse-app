import { MONTHS } from '../../utils/constants'
import type { PDFImportRecord } from '../../types'

interface PdfHistoryViewProps {
  records: PDFImportRecord[]
  isLoading: boolean
}

export function PdfHistoryView({ records, isLoading }: PdfHistoryViewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <span className="material-symbols-outlined text-primary text-3xl animate-spin">sync</span>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
        <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">upload_file</span>
        <p className="text-slate-500 font-medium">No hay PDFs importados</p>
        <p className="text-slate-400 text-sm mt-1">Los extractos bancarios importados aparecerán aquí.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-5 py-3 font-semibold text-slate-600">Archivo</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Mes</th>
            <th className="text-left px-4 py-3 font-semibold text-slate-600">Fecha de importación</th>
            <th className="text-right px-4 py-3 font-semibold text-slate-600">Transacciones</th>
            <th className="text-right px-5 py-3 font-semibold text-slate-600">Total importado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map(record => (
            <tr key={record.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-5 py-4">
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="material-symbols-outlined text-slate-400 text-base">picture_as_pdf</span>
                  <span className="font-medium truncate max-w-[200px]" title={record.filename}>{record.filename}</span>
                </div>
              </td>
              <td className="px-4 py-4 text-slate-600">
                {record.month && record.year ? `${MONTHS[record.month - 1]} ${record.year}` : '—'}
              </td>
              <td className="px-4 py-4 text-slate-500">
                {new Date(record.imported_at).toLocaleDateString('es-ES', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </td>
              <td className="px-4 py-4 text-right text-slate-700 font-medium">{record.transaction_count}</td>
              <td className="px-5 py-4 text-right font-bold text-slate-900">€{record.total_amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
