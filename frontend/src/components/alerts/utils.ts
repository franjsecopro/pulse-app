import type { Alert } from '../../types'

function monthKey(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function formatMonthLabels(alerts: Alert[], monthNames: string[]): string {
  if (alerts.length === 0) return ''

  const seen = new Set<string>()
  const unique: Array<{ month: number; year: number }> = []
  for (const alert of alerts) {
    const key = monthKey(alert.month, alert.year)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push({ month: alert.month, year: alert.year })
  }

  unique.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  const labels = unique.map(({ month, year }) => `${monthNames[month - 1]} ${year}`)
  if (labels.length === 1) return labels[0]!
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`
}
