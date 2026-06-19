import i18n, { useTranslation } from '../../i18n'
import type { NotificationLogFilters } from '../../types'

export type DateRangeModeValue = NotificationLogFilters['mode']

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAY_INDEX_FROM_MONDAY = [6, 0, 1, 2, 3, 4, 5]

function addDaysISO(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setTime(d.getTime() + days * DAY_MS)
  const yyyy = d.getFullYear()
  const monthPadded = String(d.getMonth() + 1).padStart(2, '0')
  const dayPadded = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${monthPadded}-${dayPadded}`
}

function mondayOf(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const isoWeekday = d.getDay()
  const offsetFromMonday = WEEKDAY_INDEX_FROM_MONDAY[isoWeekday]
  return addDaysISO(isoDate, -offsetFromMonday)
}

function sundayOf(isoDate: string): string {
  return addDaysISO(mondayOf(isoDate), 6)
}

function formatLongDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const weekday = d.toLocaleDateString(i18n.language, { weekday: 'long' })
  const dayAndMonth = d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' })
  return `${weekday} ${dayAndMonth}`
}

function formatMonthYear(isoDate: string): string {
  const [year, month] = isoDate.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
}

interface DateRangeModeProps {
  mode: DateRangeModeValue
  date: string
  onDateChange: (date: string) => void
  /**
   * When provided, a segmented control is rendered so the user can switch
   * between day / week / month. When omitted, the control is hidden.
   * To render the control but block user interaction, omit this and set
   * ``modeLocked`` to true.
   */
  onModeChange?: (mode: DateRangeModeValue) => void
  /**
   * When true, the segmented control is rendered but disabled (the user
   * sees the mode is set to a specific value but cannot change it). Used by
   * the pending tab to communicate that only the day mode is available.
   */
  modeLocked?: boolean
  /**
   * When true, the component renders its fields as bare siblings (a Fragment)
   * instead of wrapping them in its own row, so a parent can lay them out in a
   * single shared filter row. The range context text is pushed to its own line.
   */
  inline?: boolean
}

export function DateRangeMode({
  mode,
  date,
  onDateChange,
  onModeChange,
  modeLocked = false,
  inline = false,
}: DateRangeModeProps) {
  const { t } = useTranslation()

  const contextText =
    mode === 'day'
      ? t('notifications.range.day', { date: formatLongDate(date) })
      : mode === 'week'
        ? t('notifications.range.week', {
            start: formatLongDate(mondayOf(date)),
            end: formatLongDate(sundayOf(date)),
          })
        : t('notifications.range.month', { month: formatMonthYear(date) })

  const showModeControl = onModeChange !== undefined || modeLocked

  const modeControl = showModeControl && (
    <div className='flex flex-col gap-1'>
      <span className='text-xs font-medium text-slate-500'>{t('notifications.mode.label')}</span>
      <div
        className={`flex gap-1 bg-slate-100 p-1 rounded-lg ${modeLocked ? 'opacity-60' : ''}`}
        role='radiogroup'
        aria-label={t('notifications.mode.label')}
        aria-disabled={modeLocked}
      >
        {(['day', 'week', 'month'] as const).map((m) => {
          const isSelected = mode === m
          return (
            <label
              key={m}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              } ${modeLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <input
                type='radio'
                name='date-range-mode'
                value={m}
                checked={isSelected}
                disabled={modeLocked}
                onChange={() => onModeChange?.(m)}
                className='sr-only'
              />
              {t(`notifications.mode.${m}`)}
            </label>
          )
        })}
      </div>
    </div>
  )

  const dateField = (
    <div className='flex flex-col gap-1'>
      <label htmlFor='date-range-date' className='text-xs font-medium text-slate-500'>
        {t('notifications.dateLabel')}
      </label>
      <input
        id='date-range-date'
        type='date'
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        className='border border-slate-200 rounded-lg px-3 py-2.5 text-sm min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
      />
    </div>
  )

  // In inline mode the context spans the full row so it drops to its own line
  // below the shared filter row instead of sitting between the controls.
  const contextParagraph = (
    <p className={`text-sm text-slate-500${inline ? ' w-full order-last' : ''}`}>{contextText}</p>
  )

  if (inline) {
    return (
      <>
        {modeControl}
        {dateField}
        {contextParagraph}
      </>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-end gap-3'>
        {modeControl}
        {dateField}
      </div>
      {contextParagraph}
    </div>
  )
}
