import { useState, useRef, type ChangeEvent } from 'react'
import { api } from '../../services/api'
import type { Client } from '../../types'

interface ParsedRow {
  date: string
  concept: string
  amount: number
  suggested_client_id: number | null
  suggested_client_name: string | null
  match_type: string
  confidence: number
  selected_client_id: number | null
  skip: boolean
}

interface PdfImportModalProps {
  clients: Client[]
  onClose: () => void
  onImported: () => void
}

export function PdfImportModal({ clients, onClose, onImported }: PdfImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    setIsParsing(true)
    setRows([])

    try {
      const formData = new FormData()
      formData.append('file', file)

      const { accessToken } = api.getStoredTokens()
      const response = await fetch('/api/imports/pdf', {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data?.detail ?? 'Error al parsear el PDF')

      setRows((data as ParsedRow[]).map(r => ({
        ...r,
        selected_client_id: r.suggested_client_id,
        skip: false,
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

    let month: number | null = null
    let year: number | null = null
    if (toImport[0]?.date) {
      const [y, m] = toImport[0].date.split('-').map(Number)
      month = m ?? null
      year = y ?? null
    }

    setIsConfirming(true)
    try {
      await api.post('/imports/pdf/confirm', {
        payments: toImport.map(r => ({
          date: r.date,
          concept: r.concept,
          amount: r.amount,
          client_id: r.selected_client_id,
        })),
        filename: fileName ?? 'extracto.pdf',
        month,
        year,
      })
      onImported()
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
    if (fileRef.current) fileRef.current.value = ''
  }

  const toImportCount = rows.filter(r => !r.skip).length
  const totalAmount = rows.filter(r => !r.skip).reduce((s, r) => s + r.amount, 0)

  return (
    <div className="space-y-5">
      {rows.length === 0 && (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">upload_file</span>
          <p className="text-slate-600 font-semibold text-sm">
            {isParsing ? 'Procesando PDF...' : 'Haz clic para seleccionar el PDF'}
          </p>
          <p className="text-slate-400 text-xs mt-1">Extracto de cuenta Hello Bank / BNP Paribas</p>
          {fileName && <p className="text-primary text-xs mt-2 font-medium">{fileName}</p>}
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {isParsing && (
        <div className="flex items-center justify-center gap-2 py-6">
          <span className="material-symbols-outlined animate-spin text-primary">sync</span>
          <span className="text-sm text-slate-500">Analizando PDF...</span>
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

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Concepto banco</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Importe</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">Importar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <tr key={i} className={row.skip ? 'opacity-40' : ''}>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{row.date}</td>
                    <td className="px-4 py-3 text-slate-700 max-w-[220px]">
                      <span className="truncate block" title={row.concept}>{row.concept}</span>
                      {row.match_type !== 'none' && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${row.match_type === 'exact' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {row.match_type === 'exact' ? 'Exacto' : `Parcial ${Math.round(row.confidence * 100)}%`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">€{row.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={row.selected_client_id ?? ''}
                        onChange={e => setRows(prev => prev.map((r, j) =>
                          j === i ? { ...r, selected_client_id: parseInt(e.target.value) || null } : r
                        ))}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:border-primary outline-none w-full"
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
