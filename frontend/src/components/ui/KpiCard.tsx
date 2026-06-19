import type { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: string
  /** Optional period-over-period change as a percentage (e.g. 12.5 → "+12.5%"). */
  changePct?: number | null
  /** Whether a positive change is good (green) — false inverts the colors (e.g. debt). */
  positiveIsGood?: boolean
  /** Optional small caption under the value. */
  caption?: ReactNode
}

function formatDelta(pct: number): string {
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export function KpiCard({
  label,
  value,
  changePct = null,
  positiveIsGood = true,
  caption,
}: KpiCardProps) {
  const hasDelta = changePct !== null && changePct !== undefined
  const isUp = hasDelta && (changePct as number) > 0
  const isFlat = hasDelta && (changePct as number) === 0
  const good = isUp === positiveIsGood
  const deltaColor = isFlat ? 'text-slate-400' : good ? 'text-emerald-600' : 'text-red-500'

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5 shadow-sm'>
      <p className='text-xs font-medium text-slate-500 uppercase tracking-wide'>{label}</p>
      <p className='text-2xl font-black text-slate-900 mt-1'>{value}</p>
      {hasDelta && (
        <p className={`text-xs font-semibold mt-1 flex items-center gap-0.5 ${deltaColor}`}>
          <span className='material-symbols-outlined text-sm leading-none'>
            {isFlat ? 'remove' : isUp ? 'trending_up' : 'trending_down'}
          </span>
          {formatDelta(changePct as number)}
        </p>
      )}
      {caption && <p className='text-xs text-slate-400 mt-1'>{caption}</p>}
    </div>
  )
}
