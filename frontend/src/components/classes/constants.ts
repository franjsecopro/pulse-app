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
 *
 * `cancelledWithoutPayment` does not count toward day totals because the
 * business does not charge when a class is cancelled with more than 24h
 * notice.
 */
export const STATUS_OVERLAY: Record<
  ClassStatus,
  {
    icon: string
    iconClass: string
    labelKey: string
    chipOverlay: string
    strike: boolean
    countsTowardTotal: boolean
  }
> = {
  normal: {
    icon: '',
    iconClass: '',
    labelKey: 'classes.status.normal',
    chipOverlay: '',
    strike: false,
    countsTowardTotal: true,
  },
  cancelledWithPayment: {
    icon: 'payments',
    iconClass: 'text-amber-600',
    labelKey: 'classes.status.cancelledWithPayment',
    chipOverlay: 'ring-1 ring-amber-400/70 opacity-80',
    strike: false,
    countsTowardTotal: true,
  },
  cancelledWithoutPayment: {
    icon: 'block',
    iconClass: 'text-slate-500',
    labelKey: 'classes.status.cancelledWithoutPayment',
    chipOverlay: 'ring-1 ring-slate-400/60 opacity-60',
    strike: true,
    countsTowardTotal: false,
  },
}

export function chipClassFor(baseClass: string, status: ClassStatus): string {
  const overlay = STATUS_OVERLAY[status]
  if (!overlay.chipOverlay) return baseClass
  return `${baseClass} ${overlay.chipOverlay}`.trim()
}

export function sumEffectiveTotal(classes: ClassSession[]): number {
  return classes.reduce((sum, c) => {
    if (!STATUS_OVERLAY[c.status].countsTowardTotal) return sum
    return sum + (c.totalAmount ?? 0)
  }, 0)
}
