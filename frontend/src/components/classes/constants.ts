import type { ClassSession, ClassStatus } from '../../types'

export const CLASS_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  normal: { label: 'classes.status.normal', className: 'bg-emerald-100 text-emerald-700' },
  cancelledWithPayment: {
    label: 'classes.status.cancelledWithPayment',
    className: 'bg-amber-100 text-amber-700',
  },
  cancelledWithoutPayment: {
    label: 'classes.status.cancelledWithoutPayment',
    className: 'bg-slate-100 text-slate-500',
  },
}

/**
 * Visual overlay for cancelled classes. Applied on top of the client color
 * (background identity) so the client is still recognizable while the
 * cancellation state is detectable at a glance via ring + opacity +
 * line-through + icon.
 */
export const STATUS_OVERLAY: Record<
  ClassStatus,
  {
    icon: string
    iconClass: string
    labelKey: string
    chipOverlay: string
    strike: boolean
  }
> = {
  normal: {
    icon: '',
    iconClass: '',
    labelKey: 'classes.status.normal',
    chipOverlay: '',
    strike: false,
  },
  cancelledWithPayment: {
    icon: 'payments',
    iconClass: 'text-amber-600',
    labelKey: 'classes.status.cancelledWithPayment',
    chipOverlay: 'ring-1 ring-amber-400/70 opacity-80',
    strike: false,
  },
  cancelledWithoutPayment: {
    icon: 'block',
    iconClass: 'text-slate-500',
    labelKey: 'classes.status.cancelledWithoutPayment',
    chipOverlay: 'ring-1 ring-slate-400/60 opacity-60',
    strike: true,
  },
}

export function chipClassFor(baseClass: string, status: ClassStatus): string {
  const overlay = STATUS_OVERLAY[status]
  if (!overlay.chipOverlay) return baseClass
  return `${baseClass} ${overlay.chipOverlay}`.trim()
}

export function sumEffectiveRevenue(classes: ClassSession[]): number {
  return classes.reduce((sum, c) => sum + (c.effectiveRevenue ?? 0), 0)
}

/**
 * Planned hours = hours scheduled. Only `normal` classes count; both cancellation
 * statuses are excluded (mirrors the backend `EXCLUDED_FROM_WORKED_HOURS`). This
 * counts future classes too — it is the day's scheduled load, regardless of date.
 */
export function sumPlannedHours(classes: ClassSession[]): number {
  return classes
    .filter((c) => c.status === 'normal')
    .reduce((sum, c) => sum + (c.durationHours ?? 0), 0)
}

/** True when a class has already ended relative to `now`. */
function hasClassEnded(c: ClassSession, now: Date): boolean {
  if (c.classTime) {
    const start = new Date(`${c.classDate}T${c.classTime}`)
    const end = new Date(start.getTime() + (c.durationHours ?? 0) * 3_600_000)
    return end.getTime() <= now.getTime()
  }
  // No time on the class: only count it as worked once the whole day has passed.
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return c.classDate < today
}

/**
 * Worked hours = hours actually delivered: `normal` classes that have already
 * ended (end time < `now`). Future and not-yet-finished classes are excluded —
 * those are planned, not worked. Both cancellation statuses are excluded too.
 */
export function sumWorkedHours(classes: ClassSession[], now: Date = new Date()): number {
  return classes
    .filter((c) => c.status === 'normal' && hasClassEnded(c, now))
    .reduce((sum, c) => sum + (c.durationHours ?? 0), 0)
}
