/**
 * Formats an ISO date string (YYYY-MM-DD) to a localized display format (DD/MM/YYYY).
 * @param date - ISO date string (e.g. "2026-05-01") or null/undefined
 * @param fallback - Value to return when date is null/undefined (default "—")
 * @returns Formatted date string (e.g. "01/05/2026") or the fallback value
 */
export function formatDate(date: string | null | undefined, fallback = '—'): string {
  if (!date) return fallback
  const [year, month, day] = date.split('-')
  if (!year || !month || !day) return fallback
  return `${day}/${month}/${year}`
}

/**
 * Formats a decimal hour value into a human-readable string.
 * @param hours - Duration in decimal hours (e.g. 1.25)
 * @returns Formatted string (e.g. "1h 15min" or "2h")
 */
export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const min = Math.round((hours % 1) * 60)
  if (min === 0) return `${h}h`
  if (h === 0) return `${min}min`
  return `${h}h ${min}min`
}

/**
 * Formats a monetary amount as a locale currency string.
 * @param amount - Numeric amount
 * @param currency - Currency symbol (default "€")
 * @returns Formatted string (e.g. "€55.00")
 */
export function formatCurrency(amount: number, currency = '€'): string {
  return `${currency}${amount.toFixed(2)}`
}
