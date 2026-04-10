export const PAYMENT_STATUS_CONFIG: Record<string, { label: string; className: string; icon: string }> = {
  confirmed: { label: 'Confirmado', className: 'bg-emerald-100 text-emerald-700', icon: 'check_circle' },
  pending: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700', icon: 'schedule' },
  unmatched: { label: 'Sin identificar', className: 'bg-slate-100 text-slate-600', icon: 'help' },
}
