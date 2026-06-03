export const CLASS_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  normal: { label: 'classes.status.normal', className: 'bg-emerald-100 text-emerald-700' },
  cancelled_with_payment: { label: 'classes.status.cancelledWithPayment', className: 'bg-amber-100 text-amber-700' },
  cancelled_without_payment: { label: 'classes.status.cancelledWithoutPayment', className: 'bg-slate-100 text-slate-500' },
}
