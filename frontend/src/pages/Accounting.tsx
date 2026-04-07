import { useState, useEffect } from 'react'
import { accountingService } from '../services/accounting.service'
import type { AccountingSummaryEntry, ContractBreakdown } from '../types'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getCurrentMonthYear() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export function Accounting() {
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear()
  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)
  const [summary, setSummary] = useState<AccountingSummaryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    accountingService.getMonthlySummary(month, year)
      .then(setSummary)
      .finally(() => setIsLoading(false))
  }, [month, year])

  const totalExpected = summary.reduce((s, e) => s + e.expected, 0)
  const totalPaid = summary.reduce((s, e) => s + e.paid, 0)
  const totalBalance = summary.reduce((s, e) => s + e.balance, 0)

  function exportCSV() {
    const header = ['Cliente', 'Esperado (€)', 'Pagado (€)', 'Crédito previo (€)', 'Balance (€)']
    const rows = summary.map(e => [
      e.client_name,
      e.expected.toFixed(2),
      e.paid.toFixed(2),
      e.previous_credit.toFixed(2),
      e.balance.toFixed(2),
    ])
    const csv = [header, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contabilidad_${MONTHS[month - 1].toLowerCase()}_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Contabilidad</h1>
          <p className="text-slate-500 text-sm mt-1">
            Balance mensual por cliente con crédito acumulado aplicado.
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={summary.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">download</span>
          Exportar CSV
        </button>
      </div>

      {/* Month/Year selector */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <span className="material-symbols-outlined text-slate-400">calendar_month</span>
        <select
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          className="text-sm border-0 bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer"
        >
          {MONTHS.map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="text-sm border-0 bg-transparent font-medium text-slate-700 focus:ring-0 cursor-pointer"
        >
          {[currentYear - 1, currentYear, currentYear + 1].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin">sync</span>
        </div>
      ) : summary.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <span className="material-symbols-outlined text-5xl text-slate-300 block mb-3">account_balance</span>
          <p className="text-slate-700 font-bold text-lg">Sin datos</p>
          <p className="text-slate-500 text-sm mt-1">No hay clases ni pagos registrados para {MONTHS[month - 1]} {year}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Totals summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard label="Total esperado" value={totalExpected} color="slate" />
            <SummaryCard label="Total pagado" value={totalPaid} color="emerald" />
            <SummaryCard
              label="Balance final"
              value={totalBalance}
              color={totalBalance < 0 ? 'red' : totalBalance > 0 ? 'blue' : 'slate'}
            />
          </div>

          {/* Per-client table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Cliente</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Esperado</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Pagado</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Crédito previo</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-600">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.map(entry => (
                  <ClientRow key={entry.client_id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    slate: 'bg-white border-slate-200 text-slate-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
  }
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${colorMap[color] ?? colorMap.slate}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black mt-1">
        {value < 0 ? '-' : value > 0 ? '' : ''}€{Math.abs(value).toFixed(2)}
      </p>
    </div>
  )
}

function ClientRow({ entry }: { entry: AccountingSummaryEntry }) {
  const [expanded, setExpanded] = useState(false)
  const isDebt = entry.balance < 0
  const isCredit = entry.balance > 0
  const hasContracts = entry.contracts.length > 0

  return (
    <>
      <tr
        className={`transition-colors ${hasContracts ? 'cursor-pointer hover:bg-slate-50' : ''} ${expanded ? 'bg-slate-50' : ''}`}
        onClick={() => hasContracts && setExpanded(e => !e)}
      >
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            {hasContracts ? (
              <span className={`material-symbols-outlined text-base text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>
                chevron_right
              </span>
            ) : (
              <span className="w-5" />
            )}
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
              {entry.client_name.slice(0, 2).toUpperCase()}
            </div>
            <span className="font-medium text-slate-900">{entry.client_name}</span>
          </div>
        </td>
        <td className="px-4 py-4 text-right text-slate-700">€{entry.expected.toFixed(2)}</td>
        <td className="px-4 py-4 text-right text-slate-700">€{entry.paid.toFixed(2)}</td>
        <td className="px-4 py-4 text-right">
          {entry.previous_credit > 0 ? (
            <span className="text-blue-600 font-medium">+€{entry.previous_credit.toFixed(2)}</span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="px-5 py-4 text-right">
          <span className={`font-black text-base ${isDebt ? 'text-red-600' : isCredit ? 'text-blue-600' : 'text-emerald-600'}`}>
            {isDebt ? '-' : isCredit ? '+' : ''}€{Math.abs(entry.balance).toFixed(2)}
          </span>
        </td>
      </tr>

      {expanded && entry.contracts.map((contract, i) => (
        <ContractRow key={contract.contract_id ?? i} contract={contract} />
      ))}
    </>
  )
}

function ContractRow({ contract }: { contract: ContractBreakdown }) {
  return (
    <tr className="bg-slate-50/70 border-t border-slate-100">
      <td className="pl-16 pr-4 py-3" colSpan={1}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm text-slate-400">description</span>
          <span className="text-sm font-medium text-slate-700">{contract.contract_description}</span>
          <span className="text-xs text-slate-400">· €{contract.hourly_rate}/h</span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 pl-6 flex-wrap">
          {contract.normal_count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              {contract.normal_count} normal{contract.normal_count !== 1 ? 'es' : ''}
            </span>
          )}
          {contract.cancelled_with_payment_count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              {contract.cancelled_with_payment_count} cancelada{contract.cancelled_with_payment_count !== 1 ? 's' : ''} con pago
            </span>
          )}
          {contract.cancelled_without_payment_count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
              {contract.cancelled_without_payment_count} cancelada{contract.cancelled_without_payment_count !== 1 ? 's' : ''} sin pago
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right text-sm text-slate-600">€{contract.expected.toFixed(2)}</td>
      <td className="px-4 py-3" colSpan={3} />
    </tr>
  )
}
