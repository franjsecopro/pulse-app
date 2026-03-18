import type { ClassSession } from '../../types'

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

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

interface Props {
  classes: ClassSession[]
  year: number
  month: number
  onEdit: (c: ClassSession) => void
  onNewClass: (date: string) => void
}

export function CalendarView({ classes, year, month, onEdit, onNewClass }: Props) {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const daysInMonth = lastDay.getDate()

  // Monday-based: 0=Mon … 6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7

  // Group classes by date
  const byDate = classes.reduce<Record<string, ClassSession[]>>((acc, c) => {
    const key = c.class_date
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  // Build flat array of cells (null = empty padding)
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null)

  const dateStr = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const isToday = (day: number) => dateStr(day) === todayStr

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {WEEKDAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
        {cells.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="min-h-[100px] bg-slate-50/40" />
          }
          const key = dateStr(day)
          const dayClasses = byDate[key] ?? []
          const total = dayClasses.reduce((s, c) => s + (c.total_amount ?? 0), 0)

          return (
            <div
              key={key}
              className="min-h-[100px] p-1.5 flex flex-col gap-1 hover:bg-slate-50/60 transition-colors group"
            >
              {/* Day number */}
              <div className="flex items-center justify-between">
                <span
                  className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full
                    ${isToday(day)
                      ? 'bg-primary text-white'
                      : 'text-slate-600 group-hover:bg-slate-100'}`}
                >
                  {day}
                </span>
                {total > 0 && (
                  <span className="text-[10px] font-bold text-primary">€{total.toFixed(0)}</span>
                )}
              </div>

              {/* Class chips */}
              <div className="flex flex-col gap-0.5 flex-1">
                {dayClasses.map(c => (
                  <button
                    key={c.id}
                    onClick={() => onEdit(c)}
                    className={`w-full text-left text-[10px] font-semibold px-1.5 py-0.5 rounded border truncate
                      hover:opacity-80 transition-opacity ${clientColor(c.client_id)}`}
                    title={`${c.client_name} — ${c.duration_hours}h — €${(c.total_amount ?? 0).toFixed(2)}`}
                  >
                    {c.client_name ?? '?'}
                  </button>
                ))}
              </div>

              {/* Add button on hover */}
              <button
                onClick={() => onNewClass(key)}
                className="opacity-0 group-hover:opacity-100 transition-opacity self-end p-0.5 rounded text-slate-400 hover:text-primary hover:bg-primary/10"
                title="Añadir clase este día"
              >
                <span className="material-symbols-outlined text-sm">add</span>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
