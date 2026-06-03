import { useState } from 'react'
import { useTranslation } from '../../i18n'
import type { ClassSession } from '../../types'
import { formatTimeRange } from '../../utils/formatters'

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

  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()

  const startOffset = (firstDay.getDay() + 6) % 7

  const byDate = classes.reduce<Record<string, ClassSession[]>>((acc, c) => {
    const key = c.class_date
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const dateStr = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const isToday = (day: number) => dateStr(day) === todayStr

  const handleChipEnter = (e: React.MouseEvent<HTMLButtonElement>, c: ClassSession) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ x: rect.left, y: rect.top, class: c })
  }

  const weekdays: string[] = t('common.weekdays.short', { returnObjects: true }) as string[]

  return (
    <div className='bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden'>
      <div className='grid grid-cols-7 border-b border-slate-200 bg-slate-50'>
        {weekdays.map((d) => (
          <div
            key={d}
            className='py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider'
          >
            {d}
          </div>
        ))}
      </div>

      <div className='grid grid-cols-7 divide-x divide-y divide-slate-100'>
        {cells.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className='h-[110px] bg-slate-50/40' />
          }
          const key = dateStr(day)
          const dayClasses = byDate[key] ?? []
          const visibleClasses = dayClasses.slice(0, MAX_VISIBLE)
          const hiddenCount = dayClasses.length - MAX_VISIBLE
          const total = dayClasses.reduce((s, c) => s + (c.total_amount ?? 0), 0)

          return (
            <div
              key={key}
              className='h-[110px] p-1.5 flex flex-col gap-1 hover:bg-slate-50/60 transition-colors group relative'
            >
              <div className='flex items-center justify-between'>
                <button
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
                </button>
                {total > 0 && (
                  <span className='text-[10px] font-bold text-primary'>€{total.toFixed(0)}</span>
                )}
              </div>

              <div className='flex flex-col gap-0.5'>
                {visibleClasses.map((c) => (
                  <button
                    type='button'
                    key={c.id}
                    onClick={() => onEdit(c)}
                    onMouseEnter={(e) => handleChipEnter(e, c)}
                    onMouseLeave={() => setTooltip(null)}
                    className={`w-full text-left text-[10px] font-semibold px-1.5 py-0.5 rounded border truncate
                      hover:opacity-80 transition-opacity ${clientColor(c.client_id)}`}
                  >
                    {c.contract_description ?? c.client_name ?? '?'}
                  </button>
                ))}

                {hiddenCount > 0 && (
                  <button
                    type='button'
                    onClick={() => onDayDetail(key)}
                    className='text-[10px] font-semibold text-slate-400 hover:text-primary cursor-pointer pl-1.5 border-0 bg-transparent'
                  >
                    {t('calendar.moreClasses', { count: hiddenCount })}
                  </button>
                )}
              </div>

              <button
                type='button'
                onClick={() => onNewClass(key)}
                className='absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-primary'
                title={t('classes.addOnDay')}
              >
                <span className='material-symbols-outlined text-sm'>add</span>
              </button>
            </div>
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
          <p className='font-bold text-slate-200 truncate'>{tooltip.class.client_name}</p>
          {tooltip.class.contract_description && (
            <p className='text-slate-400 truncate'>{tooltip.class.contract_description}</p>
          )}
          {tooltip.class.class_time ? (
            <p className='mt-0.5 flex items-center gap-1 font-semibold text-slate-100'>
              <span className='material-symbols-outlined text-[12px]'>schedule</span>
              {formatTimeRange(tooltip.class.class_time, tooltip.class.duration_hours)}
            </p>
          ) : (
            <p className='mt-0.5 flex items-center gap-1 font-semibold text-amber-400'>
              <span className='material-symbols-outlined text-[12px]'>warning</span>
              Sin hora
            </p>
          )}
          <div className='mt-1 pt-1 border-t border-slate-700 flex justify-between gap-2'>
            <span>{tooltip.class.duration_hours}h</span>
            <span>€{tooltip.class.hourly_rate}/h</span>
            <span className='font-bold text-emerald-400'>
              €{(tooltip.class.total_amount ?? 0).toFixed(0)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
