import { useState, useRef, type ChangeEvent } from 'react'
import { api } from '../../services/api'
import { MONTHS } from '../../utils/constants'
import type { Client } from '../../types'

interface ParsedTransaction {
  date: string
  concept: string
  amount: number
  suggested_client_id: number | null
  suggested_client_name: string | null
  match_type: string
  confidence: number
  already_imported: boolean
}

interface ParseResponse {
  transactions: ParsedTransaction[]
  file_hash: string
  file_already_imported_at: string | null
  duplicate_count: number
}

interface ParsedRow extends ParsedTransaction {
  selected_client_id: number | null
  skip: boolean
}

interface DetectedPeriod {
  month: number | null
  year: number | null
  spansMultiple: boolean
}

/**
 * Detect the statement's period as the year/month that holds the MOST rows
 * (the dominant period), so a stray transaction from an adjacent month does not
 * mislabel the import. Dates are ISO 'YYYY-MM-DD'.
 */
function detectPeriod(rows: ParsedRow[]): DetectedPeriod {
  const countByMonth = new Map<string, number>()
  for (const row of rows) {
    if (!row.date) continue
    const key = row.date.slice(0, 7) // 'YYYY-MM'
    countByMonth.set(key, (countByMonth.get(key) ?? 0) + 1)
  }
  if (countByMonth.size === 0) return { month: null, year: null, spansMultiple: false }

  let dominantKey = ''
  let dominantCount = -1
  for (const [key, count] of countByMonth) {
    if (count > dominantCount) {
      dominantCount = count
      dominantKey = key
    }
  }
  const [year, month] = dominantKey.split('-').map(Number)
  return { month, year, spansMultiple: countByMonth.size > 1 }
}

interface ImportStatementModalProps {
  clients: Client[]
  onClose: () => void
  onImported: (month: number | null, year: number | null) => void
}

export function ImportStatementModal({ clients, onClose, onImported }: ImportStatementModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileHash, setFileHash] = useState<string | null>(null)
  const [fileAlreadyImportedAt, setFileAlreadyImportedAt] = useState<string | null>(null)
  const [duplicateCount, setDuplicateCount] = useState(0)

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    setIsParsing(true)
    setRows([])
    setFileAlreadyImportedAt(null)
    setDuplicateCount(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const data = await api.postForm<ParseResponse>('/imports/statement', formData)

      setFileHash(data.file_hash)
      setFileAlreadyImportedAt(data.file_already_imported_at)
      setDuplicateCount(data.duplicate_count)
      setRows(data.transactions.map(r => ({
        ...r,
        selected_client_id: r.suggested_client_id,
        // Pre-check only matched rows that are NOT already imported.
        skip: r.match_type === 'none' || r.already_imported,
      })))
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsParsing(false)
    }
  }

  const handleConfirm = async () => {
    const toImport = rows.filter(r => !r.skip)
    if (toImport.length === 0) return

    const { month, year } = detectPeriod(toImport)

    setIsConfirming(true)
    try {
      await api.post('/imports/statement/confirm', {
        payments: toImport.map(r => ({
          date: r.date,
          concept: r.concept,
          amount: r.amount,
          client_id: r.selected_client_id,
        })),
        filename: fileName ?? 'extracto.csv',
        month,
        year,
        file_hash: fileHash,
      })
      onImported(month, year)
      onClose()
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Error al importar')
    } finally {
      setIsConfirming(false)
    }
  }

  const resetFile = () => {
    setRows([])
    setFileName(null)
    setParseError(null)
    setFileHash(null)
    setFileAlreadyImportedAt(null)
    setDuplicateCount(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  const toImportCount = rows.filter(r => !r.skip).length
  const totalAmount = rows.filter(r => !r.skip).reduce((s, r) => s + r.amount, 0)
  const period = detectPeriod(rows)

  const allSelected = rows.length > 0 && rows.every(r => !r.skip)
  const someSelected = rows.some(r => !r.skip)

  const toggleAll = () => {
    const selectAll = !allSelected
    setRows(prev => prev.map(r => ({ ...r, skip: !selectAll })))
  }

  return (
    <div className="space-y-5">
      {rows.length === 0 && (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">upload_file</span>
          <p className="text-slate-600 font-semibold text-sm">
            {isParsing ? 'Procesando extracto...' : 'Haz clic para seleccionar el CSV'}
          </p>
          <p className="text-slate-400 text-xs mt-1">Extracto de cuenta Hello Bank / BNP Paribas (.csv)</p>
          {fileName && <p className="text-primary text-xs mt-2 font-medium">{fileName}</p>}
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {isParsing && (
        <div className="flex items-center justify-center gap-2 py-6">
          <span className="material-symbols-outlined animate-spin text-primary">sync</span>
          <span className="text-sm text-slate-500">Analizando extracto...</span>
        </div>
      )}

      {parseError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {parseError}
          <button onClick={resetFile} className="ml-2 text-red-500 underline text-xs">
            Intentar de nuevo
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              <strong>{rows.length}</strong> transacciones encontradas en{' '}
              <span className="text-primary">{fileName}</span>
            </p>
            <button onClick={resetFile} className="text-xs text-slate-400 hover:text-slate-600 underline">
              Cambiar archivo
            </button>
          </div>

          {period.month && (
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15 text-sm">
              <span className="material-symbols-outlined text-primary text-base">calendar_month</span>
              <span className="text-slate-700">
                Movimientos de <strong>{MONTHS[period.month - 1]} {period.year}</strong>
                {' · '}{rows.length} transacciones
              </span>
              {period.spansMultiple && (
                <span className="text-amber-600 text-xs">
                  · El extracto abarca varios meses; se registrará en {MONTHS[period.month - 1]}
                </span>
              )}
            </div>
          )}

          {fileAlreadyImportedAt && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <span className="material-symbols-outlined text-base">warning</span>
              Este archivo ya fue importado el {new Date(fileAlreadyImportedAt).toLocaleDateString('es-ES')}.
            </div>
          )}

          {duplicateCount > 0 && (
            <p className="text-xs text-slate-500">
              <strong>{duplicateCount}</strong> de {rows.length} transacciones ya estaban
              importadas y quedaron desmarcadas.
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Concepto banco</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Importe</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase min-w-[260px]">Cliente</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">
                    <div className="flex flex-col items-center gap-1">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                        onChange={toggleAll}
                        className="w-4 h-4 accent-primary cursor-pointer"
                        title={allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                      />
                      <span>Importar</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <tr key={i} className={row.skip ? 'opacity-40' : ''}>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.date}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[280px]">
                      <span className="truncate block" title={row.concept}>{row.concept}</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {row.match_type !== 'none' && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${row.match_type === 'exact' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {row.match_type === 'exact' ? 'Exacto' : `Parcial ${Math.round(row.confidence * 100)}%`}
                          </span>
                        )}
                        {row.already_imported && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                            Ya importado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">€{row.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={row.selected_client_id ?? ''}
                        onChange={e => setRows(prev => prev.map((r, j) =>
                          j === i ? { ...r, selected_client_id: parseInt(e.target.value) || null } : r
                        ))}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-primary outline-none w-full min-w-[240px]"
                        disabled={row.skip}
                      >
                        <option value="">Sin asignar</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={!row.skip}
                        onChange={e => setRows(prev => prev.map((r, j) =>
                          j === i ? { ...r, skip: !e.target.checked } : r
                        ))}
                        className="w-4 h-4 accent-primary"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-slate-600">
              <span className="font-bold text-primary">{toImportCount}</span> pagos ·{' '}
              <span className="font-bold">€{totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={isConfirming || toImportCount === 0}
                className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {isConfirming && <span className="material-symbols-outlined text-base animate-spin">sync</span>}
                Confirmar importación ({toImportCount})
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
