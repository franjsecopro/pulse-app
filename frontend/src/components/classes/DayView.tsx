import { useTranslation } from '../../i18n'
import type { ClassSession } from '../../types'
import { Button } from '../ui/Button'
import { chipClassFor, STATUS_OVERLAY } from './constants'

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

const HOUR_HEIGHT = 64
const DEFAULT_START = 7
const DEFAULT_END = 21

interface ColumnedClass {
  class: ClassSession
  columnIndex: number
  totalColumns: number
  startFrac: number
  endFrac: number
}

function assignColumns(classes: ClassSession[]): ColumnedClass[] {
  const sorted = [...classes].sort((classA, classB) => {
    const toFrac = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h + m / 60
    }
    return toFrac(classA.classTime ?? '') - toFrac(classB.classTime ?? '')
  })

  const result: ColumnedClass[] = []
  const columnEnds: number[] = []

  for (const classItem of sorted) {
    const [h, m] = (classItem.classTime ?? '').split(':').map(Number)
    const start = h + m / 60
    const end = start + classItem.durationHours

    let col = columnEnds.findIndex((endTime) => endTime <= start)
    if (col === -1) {
      col = columnEnds.length
    }
    columnEnds[col] = end

    result.push({
      class: classItem,
      columnIndex: col,
      totalColumns: 0,
      startFrac: start,
      endFrac: end,
    })
  }

  for (const item of result) {
    const overlapping = result.filter(
      (other) => other.startFrac < item.endFrac && other.endFrac > item.startFrac,
    )
    item.totalColumns = overlapping.reduce((max, o) => Math.max(max, o.columnIndex + 1), 1)
  }

  return result
}

interface DayViewProps {
  date: string
  classes: ClassSession[]
  onEdit: (c: ClassSession) => void
  onNewClass: (date: string) => void
  onDelete: (id: number) => Promise<void>
}

export function DayView({ date, classes, onEdit, onNewClass, onDelete }: DayViewProps) {
  const { t } = useTranslation()
  const timedClasses = classes.filter((classSession) => classSession.classTime)
  const untimedClasses = classes.filter((classSession) => !classSession.classTime)

  const startHours = timedClasses.map((classSession) =>
    parseInt((classSession.classTime ?? '').split(':')[0], 10),
  )
  const endHours = timedClasses.map((classSession) => {
    const [h, m] = (classSession.classTime ?? '').split(':').map(Number)
    return Math.ceil(h + m / 60 + classSession.durationHours)
  })

  const StartHour = timedClasses.length > 0 ? Math.min(DEFAULT_START, ...startHours) : DEFAULT_START
  const EndHour = timedClasses.length > 0 ? Math.max(DEFAULT_END, ...endHours) : DEFAULT_END

  const Hours = Array.from({ length: EndHour - StartHour + 1 }, (_, i) => i + StartHour)
  const totalHeight = (EndHour - StartHour) * HOUR_HEIGHT

  function getTop(classTime: string): number {
    const [h, m] = classTime.split(':').map(Number)
    return (h + m / 60 - StartHour) * HOUR_HEIGHT
  }

  function getHeight(durationHours: number): number {
    return Math.max(durationHours * HOUR_HEIGHT, 28)
  }

  const columnedClasses = assignColumns(timedClasses)

  return (
    <div className='flex flex-col gap-4'>
      {untimedClasses.length > 0 && (
        <div className='space-y-1.5'>
          <p className='text-xs font-bold text-slate-400 uppercase tracking-wider'>
            {t('dayView.untimed')}
          </p>
          {untimedClasses.map((classSession) => {
            const overlay = STATUS_OVERLAY[classSession.status]
            return (
              <div
                key={classSession.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${chipClassFor(clientColor(classSession.clientId), classSession.status)}`}
              >
                <div className='flex items-center gap-2 min-w-0'>
                  {overlay.icon && (
                    <span
                      className={`material-symbols-outlined text-base shrink-0 ${overlay.iconClass}`}
                      title={t(overlay.labelKey)}
                    >
                      {overlay.icon}
                    </span>
                  )}
                  <div className='min-w-0'>
                    <span className={`font-semibold ${overlay.strike ? 'line-through' : ''}`}>
                      {classSession.contractDescription ?? classSession.clientName}
                    </span>
                    <span className='ml-2 opacity-60 text-xs'>
                      {classSession.durationHours}h · €{(classSession.totalAmount ?? 0).toFixed(0)}
                    </span>
                  </div>
                </div>
                <div className='flex items-center gap-1'>
                  <Button
                    type='button'
                    onClick={() => onEdit(classSession)}
                    className='p-1 rounded hover:bg-black/10 transition-colors text-slate-500 hover:text-slate-800'
                    title={t('classes.edit')}
                  >
                    <span className='material-symbols-outlined text-sm'>edit</span>
                  </Button>
                  <Button
                    type='button'
                    onClick={() => onDelete(classSession.id)}
                    className='p-1 rounded hover:bg-black/10 transition-colors text-red-400 hover:text-red-600'
                    title={t('classes.delete')}
                  >
                    <span className='material-symbols-outlined text-sm'>delete</span>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className='flex gap-2'>
        <div className='flex flex-col shrink-0 w-12' style={{ height: totalHeight }}>
          {Hours.map((h) => (
            <div
              key={h}
              className='shrink-0 flex items-start justify-end pr-2'
              style={{ height: HOUR_HEIGHT }}
            >
              <span className='text-[10px] font-medium text-slate-400 -mt-2'>
                {String(h).padStart(2, '0')}:00
              </span>
            </div>
          ))}
        </div>

        <div className='relative flex-1 border-l border-slate-200' style={{ height: totalHeight }}>
          {Hours.map((h) => (
            <div
              key={h}
              className='absolute left-0 right-0 border-t border-slate-100'
              style={{ top: (h - StartHour) * HOUR_HEIGHT }}
            />
          ))}

          {columnedClasses.map(({ class: classItem, columnIndex, totalColumns }) => {
            const top = getTop(classItem.classTime ?? '')
            const height = getHeight(classItem.durationHours)
            const widthPct = 100 / totalColumns
            const leftPct = columnIndex * widthPct
            const overlay = STATUS_OVERLAY[classItem.status]

            return (
              <div
                key={classItem.id}
                className={`absolute rounded-lg border px-2 py-1 overflow-hidden group/block ${chipClassFor(clientColor(classItem.clientId), classItem.status)}`}
                style={{
                  top,
                  height,
                  left: `${leftPct}%`,
                  width: `calc(${widthPct}% - 4px)`,
                }}
              >
                <Button
                  type='button'
                  onClick={() => onEdit(classItem)}
                  className='cursor-pointer h-full pr-10 border-0 bg-transparent w-full text-left'
                >
                  {overlay.icon && (
                    <span
                      className={`material-symbols-outlined text-[12px] ${overlay.iconClass}`}
                      title={t(overlay.labelKey)}
                    >
                      {overlay.icon}
                    </span>
                  )}{' '}
                  <p
                    className={`text-[11px] font-bold truncate leading-tight inline ${overlay.strike ? 'line-through' : ''}`}
                  >
                    {classItem.contractDescription ?? classItem.clientName}
                  </p>
                  {height >= 40 && (
                    <p className='text-[10px] opacity-70 truncate'>
                      {classItem.classTime?.slice(0, 5)} · {classItem.durationHours}h · €
                      {(classItem.totalAmount ?? 0).toFixed(0)}
                    </p>
                  )}
                </Button>

                <div className='absolute top-0.5 right-0.5 flex items-center gap-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity'>
                  <Button
                    type='button'
                    onClick={() => onEdit(classItem)}
                    title={t('classes.edit')}
                    className='p-0.5 rounded text-slate-500 hover:text-slate-800 hover:bg-black/10 transition-colors'
                  >
                    <span className='material-symbols-outlined text-[13px]'>edit</span>
                  </Button>
                  <Button
                    type='button'
                    onClick={() => onDelete(classItem.id)}
                    title={t('classes.delete')}
                    className='p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-black/10 transition-colors'
                  >
                    <span className='material-symbols-outlined text-[13px]'>delete</span>
                  </Button>
                </div>
              </div>
            )
          })}

          {timedClasses.length === 0 && (
            <div className='absolute inset-0 flex items-center justify-center'>
              <p className='text-sm text-slate-400'>{t('dayView.emptyTimed')}</p>
            </div>
          )}
        </div>
      </div>

      <Button
        type='button'
        onClick={() => onNewClass(date)}
        className='w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors'
      >
        <span className='material-symbols-outlined text-base'>add</span>
        {t('classes.newOnDay')}
      </Button>
    </div>
  )
}
