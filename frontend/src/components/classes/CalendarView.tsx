import { Fragment, type ReactNode, useState } from 'react'
import { useTranslation } from '../../i18n'
import type { ClassSession } from '../../types'
import { formatTimeRange } from '../../utils/formatters'
import { Button } from '../ui/Button'
import { Tooltip } from '../ui/Tooltip'
import {
  chipClassFor,
  STATUS_OVERLAY,
  sumEffectiveRevenue,
  sumPlannedHours,
  sumWorkedHours,
} from './constants'

const CLIENT_COLORS = [
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  'bg-orange-100 text-orange-700 border-orange-200',
]

function clientColor(clientId: number) {
  return CLIENT_COLORS[clientId % CLIENT_COLORS.length]
}

const MAX_VISIBLE = 2

interface TooltipData {
  x: number
  y: number
  class: ClassSession
}

interface DayHoursTooltip {
  x: number
  y: number
  workedHours: number
  plannedHours: number
  cancelledHours: number
}

interface Props {
  classes: ClassSession[]
  year: number
  month: number
  onEdit: (c: ClassSession) => void
  onNewClass: (date: string) => void
  onDayDetail: (date: string) => void
}

export function CalendarView({ classes, year, month, onEdit, onNewClass, onDayDetail }: Props) {
  const { t } = useTranslation()
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [dayTooltip, setDayTooltip] = useState<DayHoursTooltip | null>(null)

  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()

  const startOffset = (firstDay.getDay() + 6) % 7

  const byDate = classes.reduce<Record<string, ClassSession[]>>((acc, classSession) => {
    const key = classSession.classDate
    if (!acc[key]) acc[key] = []
    acc[key].push(classSession)
    return acc
  }, {})

  const cells: { key: string; day: number | null }[] = [
    ...Array(startOffset)
      .fill(null)
      .map((_, i) => ({ key: `pre-${i}`, day: null })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      key: `day-${i + 1}`,
      day: i + 1,
    })),
  ]
  while (cells.length % 7 !== 0) cells.push({ key: `post-${cells.length}`, day: null })

  const dateStr = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const isToday = (day: number) => dateStr(day) === todayStr

  const handleChipEnter = (e: React.MouseEvent<HTMLButtonElement>, c: ClassSession) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ x: rect.left, y: rect.top, class: c })
  }

  const weekdays: string[] = t('common.weekdays.short', {
    returnObjects: true,
  }) as string[]

  // Per-week summary cell (8th column). A week is the 7 cells ending at `endIndex`.
  const renderWeekSummary = (endIndex: number) => {
    const weekCells = cells.slice(endIndex - 6, endIndex + 1)
    const weekClasses = weekCells.flatMap((c) => (c.day ? (byDate[dateStr(c.day)] ?? []) : []))
    const planned = Number(sumPlannedHours(weekClasses).toFixed(2))
    const worked = Number(sumWorkedHours(weekClasses, today).toFixed(2))
    return (
      <div className='h-[110px] bg-slate-50/50 p-1.5 flex flex-col items-center justify-center text-center'>
        {planned > 0 && (
          <Tooltip content={t('classes.totalHoursTitle')} position='left'>
            <span className='flex items-center gap-0.5 text-xs font-bold text-slate-600 cursor-default'>
              <span className='material-symbols-outlined text-[12px] leading-none'>schedule</span>
              {worked} / {planned}h
            </span>
          </Tooltip>
        )}
      </div>
    )
  }

  // Each row ends on the 7th cell (index % 7 === 6); append the week summary there.
  const withWeekSummary = (index: number, key: string, content: ReactNode): ReactNode =>
    index % 7 === 6 ? (
      <Fragment key={key}>
        {content}
        {renderWeekSummary(index)}
      </Fragment>
    ) : (
      content
    )

  return (
    <div className='bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden'>
      <div className='grid grid-cols-8 border-b border-slate-200 bg-slate-50'>
        {weekdays.map((d) => (
          <div
            key={d}
            className='py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider'
          >
            {d}
          </div>
        ))}
        <div className='py-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider'>
          {t('calendar.weekTotal')}
        </div>
      </div>

      <div className='grid grid-cols-8 divide-x divide-y divide-slate-100'>
        {cells.map((cell, index) => {
          if (cell.day === null) {
            return withWeekSummary(
              index,
              cell.key,
              <div key={cell.key} className='h-[110px] bg-slate-50/40' />,
            )
          }
          const day = cell.day
          const key = dateStr(day)
          const dayClasses = byDate[key] ?? []
          const visibleClasses = dayClasses.slice(0, MAX_VISIBLE)
          const hiddenCount = dayClasses.length - MAX_VISIBLE
          const total = sumEffectiveRevenue(dayClasses)
          const plannedHours = Number(sumPlannedHours(dayClasses).toFixed(2))
          const workedHours = Number(sumWorkedHours(dayClasses, today).toFixed(2))
          const cancelledHours = Number(
            dayClasses
              .filter((c) => c.status !== 'normal')
              .reduce((sum, c) => sum + (c.durationHours ?? 0), 0)
              .toFixed(2),
          )

          return withWeekSummary(
            index,
            key,
            <div
              key={key}
              className='h-[110px] p-1.5 flex flex-col gap-1 hover:bg-slate-50/60 transition-colors group relative'
            >
              <div className='flex items-center justify-between'>
                <Button
                  type='button'
                  onClick={() => onDayDetail(key)}
                  className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full cursor-pointer transition-colors border-0
                    ${
                      isToday(day)
                        ? 'bg-primary text-white'
                        : 'text-slate-600 hover:bg-primary/10 hover:text-primary'
                    }`}
                >
                  {day}
                </Button>
                {(plannedHours > 0 || total > 0) && (
                  // biome-ignore lint/a11y/noStaticElementInteractions: hover-only breakdown; the same numbers are visible in the badge and the day detail is reachable via the keyboard-accessible day button
                  <span
                    data-testid={`day-hours-${key}`}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setDayTooltip({
                        x: rect.left,
                        y: rect.top,
                        workedHours,
                        plannedHours,
                        cancelledHours,
                      })
                    }}
                    onMouseLeave={() => setDayTooltip(null)}
                    className='flex items-center gap-1.5 text-[10px] font-bold cursor-default'
                  >
                    {plannedHours > 0 && (
                      <span className='flex items-center gap-0.5 text-slate-500'>
                        <span className='material-symbols-outlined text-[11px] leading-none'>
                          schedule
                        </span>
                        {plannedHours}h
                      </span>
                    )}
                    {total > 0 && <span className='text-primary'>€{total.toFixed(0)}</span>}
                  </span>
                )}
              </div>

              <div className='flex flex-col gap-0.5'>
                {visibleClasses.map((classSession) => {
                  const overlay = STATUS_OVERLAY[classSession.status]
                  return (
                    <Button
                      type='button'
                      key={classSession.id}
                      onClick={() => onEdit(classSession)}
                      onMouseEnter={(e) => handleChipEnter(e, classSession)}
                      onMouseLeave={() => setTooltip(null)}
                      className={`w-full text-left text-[10px] font-semibold px-1.5 py-0.5 rounded border truncate
                        hover:opacity-80 transition-opacity ${chipClassFor(clientColor(classSession.clientId), classSession.status)}`}
                    >
                      {overlay.strike ? (
                        <span className='line-through'>
                          {classSession.contractDescription ?? classSession.clientName ?? '?'}
                        </span>
                      ) : (
                        (classSession.contractDescription ?? classSession.clientName ?? '?')
                      )}
                    </Button>
                  )
                })}

                {hiddenCount > 0 && (
                  <Button
                    type='button'
                    onClick={() => onDayDetail(key)}
                    className='text-[10px] font-semibold text-slate-400 hover:text-primary cursor-pointer pl-1.5 border-0 bg-transparent'
                  >
                    {t('calendar.moreClasses', { count: hiddenCount })}
                  </Button>
                )}
              </div>

              <Button
                type='button'
                onClick={() => onNewClass(key)}
                className='absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-primary'
                title={t('classes.addOnDay')}
              >
                <span className='material-symbols-outlined text-sm'>add</span>
              </Button>
            </div>,
          )
        })}
      </div>

      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: 'translateY(-100%)',
            zIndex: 9999,
          }}
          className='w-48 bg-slate-800 text-white text-[10px] rounded-lg p-2 shadow-xl pointer-events-none'
        >
          {tooltip.class.status !== 'normal' &&
            (() => {
              const overlay = STATUS_OVERLAY[tooltip.class.status]
              return (
                <p
                  className={`mb-1 pb-1 border-b border-slate-700 flex items-center gap-1 font-semibold ${overlay.iconClass}`}
                >
                  <span className='material-symbols-outlined text-[12px]'>{overlay.icon}</span>
                  {t(overlay.labelKey)}
                </p>
              )
            })()}
          <p className='font-bold text-slate-200 truncate'>{tooltip.class.clientName}</p>
          {tooltip.class.contractDescription && (
            <p className='text-slate-400 truncate'>{tooltip.class.contractDescription}</p>
          )}
          {tooltip.class.classTime ? (
            <p className='mt-0.5 flex items-center gap-1 font-semibold text-slate-100'>
              <span className='material-symbols-outlined text-[12px]'>schedule</span>
              {formatTimeRange(tooltip.class.classTime, tooltip.class.durationHours)}
            </p>
          ) : (
            <p className='mt-0.5 flex items-center gap-1 font-semibold text-amber-400'>
              <span className='material-symbols-outlined text-[12px]'>warning</span>
              Sin hora
            </p>
          )}
          <div className='mt-1 pt-1 border-t border-slate-700 flex justify-between gap-2'>
            <span>{tooltip.class.durationHours}h</span>
            <span>€{tooltip.class.hourlyRate}/h</span>
            <span className='font-bold text-emerald-400'>
              €{(tooltip.class.effectiveRevenue ?? 0).toFixed(0)}
            </span>
          </div>
        </div>
      )}

      {dayTooltip && (
        <div
          style={{
            position: 'fixed',
            left: dayTooltip.x,
            top: dayTooltip.y - 8,
            transform: 'translateY(-100%)',
            zIndex: 9999,
          }}
          className='w-52 bg-slate-800 text-white text-[10px] rounded-lg p-2 shadow-xl pointer-events-none'
        >
          <p className='flex items-center gap-1 font-semibold text-slate-100'>
            <span className='material-symbols-outlined text-[12px]'>schedule</span>
            {t('calendar.workedHoursLabel', { hours: dayTooltip.workedHours })}
          </p>
          {dayTooltip.plannedHours > dayTooltip.workedHours && (
            <p className='mt-0.5 text-slate-300'>
              {t('calendar.plannedHoursLabel', { hours: dayTooltip.plannedHours })}
            </p>
          )}
          {dayTooltip.cancelledHours > 0 && (
            <p className='mt-1 pt-1 border-t border-slate-700 text-slate-400'>
              {t('calendar.cancelledHoursExcluded', { hours: dayTooltip.cancelledHours })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
