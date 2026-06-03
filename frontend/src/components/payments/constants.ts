export const PAYMENT_STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: string }
> = {
  confirmed: {
    label: 'payments.status.confirmed',
    className: 'bg-emerald-100 text-emerald-700',
    icon: 'check_circle',
  },
  pending: {
    label: 'payments.status.pending',
    className: 'bg-amber-100 text-amber-700',
    icon: 'schedule',
  },
  unmatched: {
    label: 'payments.status.unmatched',
    className: 'bg-slate-100 text-slate-600',
    icon: 'help',
  },
}
