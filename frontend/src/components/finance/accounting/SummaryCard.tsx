interface SummaryCardProps {
  label: string
  value: number
  color: string
}

const COLOR_MAP: Record<string, string> = {
  slate: 'bg-white border-slate-200 text-slate-900',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  red: 'bg-red-50 border-red-200 text-red-800',
  blue: 'bg-blue-50 border-blue-200 text-blue-800',
}

export function SummaryCard({ label, value, color }: SummaryCardProps) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${COLOR_MAP[color] ?? COLOR_MAP.slate}`}>
      <p className='text-xs font-medium opacity-70 uppercase tracking-wide'>{label}</p>
      <p className='text-2xl font-black mt-1'>
        {value < 0 ? '-' : ''}€{Math.abs(value).toFixed(2)}
      </p>
    </div>
  )
}
