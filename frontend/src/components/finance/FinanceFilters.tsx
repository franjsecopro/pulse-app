import type { ReactNode } from 'react'
import { MONTHS } from '../../utils/constants'
import type { Client } from '../../types'

interface FinanceFiltersProps {
  clients: Client[]
  month: number | ''
  year: number
  client: number | ''
  onMonthChange: (month: number | '') => void
  onYearChange: (year: number) => void
  onClientChange: (client: number | '') => void
  /** Status filter is rendered only when these are provided (Pagos only). */
  status?: string
  onStatusChange?: (status: string) => void
  /** When false, the month is required (no "Todos los meses" option) — e.g. Contabilidad. */
  allowAllMonths?: boolean
  /** Optional right-aligned slot (e.g. a total chip). */
  trailing?: ReactNode
}

const SELECT_CLASS =
  'border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary'

/**
 * Shared filter bar for the finance pages (Pagos / Contabilidad).
 *
 * Month, year and client are common to both pages. The status filter is opt-in
 * via props (Pagos passes it, Contabilidad does not). The year selector appears
 * only once a concrete month is chosen.
 */
export function FinanceFilters({
  clients,
  month,
  year,
  client,
  onMonthChange,
  onYearChange,
  onClientChange,
  status,
  onStatusChange,
  allowAllMonths = true,
  trailing,
}: FinanceFiltersProps) {
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1, currentYear - 2]
  const showStatus = onStatusChange !== undefined

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
      <select
        value={month}
        onChange={e => onMonthChange(parseInt(e.target.value) || '')}
        className={SELECT_CLASS}
      >
        {allowAllMonths && <option value="">Todos los meses</option>}
        {MONTHS.map((name, i) => (
          <option key={i} value={i + 1}>{name}</option>
        ))}
      </select>

      {month !== '' && (
        <select
          value={year}
          onChange={e => onYearChange(parseInt(e.target.value))}
          className={SELECT_CLASS}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      )}

      <select
        value={client}
        onChange={e => onClientChange(parseInt(e.target.value) || '')}
        className={SELECT_CLASS}
      >
        <option value="">Todos los clientes</option>
        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {showStatus && (
        <select
          value={status}
          onChange={e => onStatusChange!(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Todos los estados</option>
          <option value="confirmed">Confirmados</option>
          <option value="pending">Pendientes</option>
          <option value="unmatched">Sin identificar</option>
        </select>
      )}

      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  )
}
