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

const HOUR_HEIGHT = 64 // px por hora
const DEFAULT_START = 7
const DEFAULT_END = 21

interface ColumnedClass {
  class: ClassSession
  columnIndex: number
  totalColumns: number
  startFrac: number // hora decimal de inicio
  endFrac: number   // hora decimal de fin
}

/**
 * Asigna columnas a clases con solapamiento.
 * Algoritmo greedy: para cada clase, asigna la primera columna libre.
 */
function assignColumns(classes: ClassSession[]): ColumnedClass[] {
  const sorted = [...classes].sort((a, b) => {
    const toFrac = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h + m / 60
    }
    return toFrac(a.class_time!) - toFrac(b.class_time!)
  })

  const result: ColumnedClass[] = []
  // Cada entrada: fin de la clase que ocupa esa columna
  const columnEnds: number[] = []

  for (const c of sorted) {
    const [h, m] = c.class_time!.split(':').map(Number)
    const start = h + m / 60
    const end = start + c.duration_hours

    // Buscar la primera columna libre
    let col = columnEnds.findIndex(endTime => endTime <= start)
    if (col === -1) {
      col = columnEnds.length
    }
    columnEnds[col] = end

    result.push({
      class: c,
      columnIndex: col,
      totalColumns: 0, // se calcula al final
      startFrac: start,
      endFrac: end,
    })
  }

  // Calcular totalColumns para cada clase: máximo de columnas activas en su rango
  for (const item of result) {
    const overlapping = result.filter(
      other => other.startFrac < item.endFrac && other.endFrac > item.startFrac
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

/**
 * Vista día con timeline horario.
 * Muestra las clases posicionadas según su hora y duración.
 * El rango por defecto es 7:00-21:00 pero se expande si hay clases fuera de ese rango.
 */
export function DayView({ date, classes, onEdit, onNewClass, onDelete }: DayViewProps) {
  const timedClasses = classes.filter(c => c.class_time)
  const untimedClasses = classes.filter(c => !c.class_time)

  // Rango dinámico
  const startHours = timedClasses.map(c => parseInt(c.class_time!.split(':')[0]))
  const endHours = timedClasses.map(c => {
    const [h, m] = c.class_time!.split(':').map(Number)
    return Math.ceil(h + m / 60 + c.duration_hours)
  })

  const START_HOUR = timedClasses.length > 0
    ? Math.min(DEFAULT_START, ...startHours)
    : DEFAULT_START
  const END_HOUR = timedClasses.length > 0
    ? Math.max(DEFAULT_END, ...endHours)
    : DEFAULT_END

  const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR)
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT

  function getTop(classTime: string): number {
    const [h, m] = classTime.split(':').map(Number)
    return (h + m / 60 - START_HOUR) * HOUR_HEIGHT
  }

  function getHeight(durationHours: number): number {
    return Math.max(durationHours * HOUR_HEIGHT, 28)
  }

  const columnedClasses = assignColumns(timedClasses)

  return (
    <div className="flex flex-col gap-4">
      {/* Clases sin hora */}
      {untimedClasses.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sin hora asignada</p>
          {untimedClasses.map(c => (
            <div
              key={c.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${clientColor(c.client_id)}`}
            >
              <div>
                <span className="font-semibold">{c.contract_description ?? c.client_name}</span>
                <span className="ml-2 opacity-60 text-xs">{c.duration_hours}h · €{(c.total_amount ?? 0).toFixed(0)}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(c)}
                  className="p-1 rounded hover:bg-black/10 transition-colors text-slate-500 hover:text-slate-800"
                  title="Editar clase"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
                <button
                  onClick={() => onDelete(c.id)}
                  className="p-1 rounded hover:bg-black/10 transition-colors text-red-400 hover:text-red-600"
                  title="Eliminar clase"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="flex gap-2">
        {/* Columna de horas */}
        <div className="flex flex-col shrink-0 w-12" style={{ height: totalHeight }}>
          {HOURS.map(h => (
            <div
              key={h}
              className="shrink-0 flex items-start justify-end pr-2"
              style={{ height: HOUR_HEIGHT }}
            >
              <span className="text-[10px] font-medium text-slate-400 -mt-2">
                {String(h).padStart(2, '0')}:00
              </span>
            </div>
          ))}
        </div>

        {/* Área del timeline */}
        <div className="relative flex-1 border-l border-slate-200" style={{ height: totalHeight }}>
          {/* Líneas de hora */}
          {HOURS.map(h => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-slate-100"
              style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
            />
          ))}

          {/* Bloques de clases */}
          {columnedClasses.map(({ class: c, columnIndex, totalColumns }) => {
            const top = getTop(c.class_time!)
            const height = getHeight(c.duration_hours)
            const widthPct = 100 / totalColumns
            const leftPct = columnIndex * widthPct

            return (
              <div
                key={c.id}
                className={`absolute rounded-lg border px-2 py-1 overflow-hidden group/block ${clientColor(c.client_id)}`}
                style={{
                  top,
                  height,
                  left: `${leftPct}%`,
                  width: `calc(${widthPct}% - 4px)`,
                }}
              >
                {/* Contenido — clickable para editar */}
                <div
                  onClick={() => onEdit(c)}
                  className="cursor-pointer h-full pr-10"
                >
                  <p className="text-[11px] font-bold truncate leading-tight">
                    {c.contract_description ?? c.client_name}
                  </p>
                  {height >= 40 && (
                    <p className="text-[10px] opacity-70 truncate">
                      {c.class_time?.slice(0, 5)} · {c.duration_hours}h · €{(c.total_amount ?? 0).toFixed(0)}
                    </p>
                  )}
                </div>

                {/* Acciones — visibles al hover */}
                <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(c)}
                    title="Editar clase"
                    className="p-0.5 rounded text-slate-500 hover:text-slate-800 hover:bg-black/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[13px]">edit</span>
                  </button>
                  <button
                    onClick={() => onDelete(c.id)}
                    title="Eliminar clase"
                    className="p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-black/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[13px]">delete</span>
                  </button>
                </div>
              </div>
            )
          })}

          {/* Estado vacío del timeline */}
          {timedClasses.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-slate-400">No hay clases con hora asignada</p>
            </div>
          )}
        </div>
      </div>

      {/* Botón nueva clase */}
      <button
        onClick={() => onNewClass(date)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-primary/30 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors"
      >
        <span className="material-symbols-outlined text-base">add</span>
        Nueva clase este día
      </button>
    </div>
  )
}
