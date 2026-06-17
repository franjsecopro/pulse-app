import type { ReactNode } from 'react'
import { useTranslation } from '../../i18n'
import type { Client } from '../../types'

interface FinanceFiltersProps {
  clients: Client[]
  month?: number | ''
  year?: number
  client: number | ''
  onMonthChange?: (month: number | '') => void
  onYearChange?: (year: number) => void
  onClientChange: (client: number | '') => void
  status?: string
  onStatusChange?: (status: string) => void
  /** Status dropdown options. Defaults to the payment statuses when omitted. */
  statusOptions?: { value: string; label: string }[]
  allowAllMonths?: boolean
  /** Show the year selector even when no month is chosen (for year-level filtering). */
  alwaysShowYear?: boolean
  /** Hide the month/year selectors — used when the period is controlled upstream (shared period). */
  hidePeriod?: boolean
  trailing?: ReactNode
}

export const FINANCE_SELECT_CLASS =
  'border border-slate-200 rounded-lg py-2 pl-3 pr-8 text-sm text-slate-600 bg-white focus:ring-primary focus:border-primary'

export function FinanceFilters({
  clients,
  month = '',
  year,
  client,
  onMonthChange,
  onYearChange,
  onClientChange,
  status,
  onStatusChange,
  statusOptions,
  allowAllMonths = true,
  alwaysShowYear = false,
  hidePeriod = false,
  trailing,
}: FinanceFiltersProps) {
  const { t } = useTranslation()
  const months = t('common.months.full', { returnObjects: true }) as string[]
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1, currentYear - 2]
  const showStatus = onStatusChange !== undefined
  const resolvedStatusOptions = statusOptions ?? [
    { value: 'confirmed', label: t('filters.statusConfirmed') },
    { value: 'pending', label: t('filters.statusPending') },
    { value: 'unmatched', label: t('filters.statusUnmatched') },
  ]

  return (
    <div className='bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3'>
      {!hidePeriod && (
        <select
          value={month}
          onChange={(e) => onMonthChange?.(parseInt(e.target.value, 10) || '')}
          className={FINANCE_SELECT_CLASS}
        >
          {allowAllMonths && <option value=''>{t('filters.allMonths')}</option>}
          {months.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
      )}

      {!hidePeriod && (month !== '' || alwaysShowYear) && (
        <select
          value={year}
          onChange={(e) => onYearChange?.(parseInt(e.target.value, 10))}
          className={FINANCE_SELECT_CLASS}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      )}

      <select
        value={client}
        onChange={(e) => onClientChange(parseInt(e.target.value, 10) || '')}
        className={FINANCE_SELECT_CLASS}
      >
        <option value=''>{t('filters.allClients')}</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>

      {showStatus && (
        <select
          value={status}
          onChange={(e) => onStatusChange?.(e.target.value)}
          className={FINANCE_SELECT_CLASS}
        >
          <option value=''>{t('filters.allStatuses')}</option>
          {resolvedStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {trailing && <div className='ml-auto'>{trailing}</div>}
    </div>
  )
}
