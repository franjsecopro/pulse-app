import { useTranslation } from '../../i18n'

interface MonthYearSelectProps {
  month: number
  year: number
  onMonthChange: (month: number) => void
  onYearChange: (year: number) => void
  /**
   * Years to show in the year dropdown. Defaults to the previous and current
   * calendar year (matches the historical Alerts.tsx behaviour).
   */
  years?: number[]
  labels?: {
    month?: string
    year?: string
  }
}

export function MonthYearSelect({
  month,
  year,
  onMonthChange,
  onYearChange,
  years,
  labels,
}: MonthYearSelectProps) {
  const { t } = useTranslation()
  const months: string[] = t('common.months.full', { returnObjects: true }) as unknown as string[]
  const now = new Date()
  const yearOptions = years ?? [now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className='flex items-end gap-2'>
      <div className='flex flex-col gap-1'>
        <label htmlFor='month-year-month' className='text-xs font-medium text-slate-500'>
          {labels?.month ?? t('notifications.filters.month')}
        </label>
        <select
          id='month-year-month'
          value={month}
          onChange={(e) => onMonthChange(parseInt(e.target.value, 10))}
          className='border border-slate-200 rounded-lg px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
        >
          {months.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className='flex flex-col gap-1'>
        <label htmlFor='month-year-year' className='text-xs font-medium text-slate-500'>
          {labels?.year ?? t('notifications.filters.year')}
        </label>
        <select
          id='month-year-year'
          value={year}
          onChange={(e) => onYearChange(parseInt(e.target.value, 10))}
          className='border border-slate-200 rounded-lg px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
        >
          {yearOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
