import type { ReactNode } from 'react'
import { useTranslation } from '../../i18n'
import type { Client } from '../../types'

interface FinanceFiltersProps {
  clients: Client[]
  month: number | ''
  year: number
  client: number | ''
  onMonthChange: (month: number | '') => void
  onYearChange: (year: number) => void
  onClientChange: (client: number | '') => void
  status?: string
  onStatusChange?: (status: string) => void
  allowAllMonths?: boolean
  trailing?: ReactNode
}

const SELECT_CLASS =
  'border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary'

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
  const { t } = useTranslation()
  const months = t('common.months.full', { returnObjects: true }) as string[]
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1, currentYear - 2]
  const showStatus = onStatusChange !== undefined

  return (
    <div className='bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3'>
      <select
        value={month}
        onChange={(e) => onMonthChange(parseInt(e.target.value, 10) || '')}
        className={SELECT_CLASS}
      >
        {allowAllMonths && <option value=''>{t('filters.allMonths')}</option>}
        {months.map((name, i) => (
          <option key={i} value={i + 1}>
            {name}
          </option>
        ))}
      </select>

      {month !== '' && (
        <select
          value={year}
          onChange={(e) => onYearChange(parseInt(e.target.value, 10))}
          className={SELECT_CLASS}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      )}

      <select
        value={client}
        onChange={(e) => onClientChange(parseInt(e.target.value, 10) || '')}
        className={SELECT_CLASS}
      >
        <option value=''>{t('filters.allClients')}</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {showStatus && (
        <select
          value={status}
          onChange={(e) => onStatusChange?.(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value=''>{t('filters.allStatuses')}</option>
          <option value='confirmed'>{t('filters.statusConfirmed')}</option>
          <option value='pending'>{t('filters.statusPending')}</option>
          <option value='unmatched'>{t('filters.statusUnmatched')}</option>
        </select>
      )}

      {trailing && <div className='ml-auto'>{trailing}</div>}
    </div>
  )
}
