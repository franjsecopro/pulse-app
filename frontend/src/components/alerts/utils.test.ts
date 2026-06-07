import { describe, expect, it } from 'vitest'
import type { Alert } from '../../types'
import { formatMonthLabels } from './utils'

const months = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function makeAlert(month: number, year: number, clientId = 1): Alert {
  return {
    client_id: clientId,
    client_name: `Client ${clientId}`,
    type: 'debt',
    severity: 'error',
    amount: 100,
    month,
    year,
  }
}

describe('formatMonthLabels', () => {
  it('returns an empty string for no alerts', () => {
    expect(formatMonthLabels([], months)).toBe('')
  })

  it('returns a single "month year" for one alert', () => {
    expect(formatMonthLabels([makeAlert(6, 2026)], months)).toBe('junio 2026')
  })

  it('joins two alerts in the same year with " y "', () => {
    expect(formatMonthLabels([makeAlert(6, 2026), makeAlert(8, 2026)], months)).toBe(
      'junio 2026 y agosto 2026',
    )
  })

  it('joins three or more alerts in the same year with ", " and " y "', () => {
    expect(
      formatMonthLabels([makeAlert(6, 2026), makeAlert(8, 2026), makeAlert(9, 2026)], months),
    ).toBe('junio 2026, agosto 2026 y septiembre 2026')
  })

  it('orders alerts by year then month ascending', () => {
    expect(
      formatMonthLabels([makeAlert(9, 2027), makeAlert(6, 2026), makeAlert(8, 2026)], months),
    ).toBe('junio 2026, agosto 2026 y septiembre 2027')
  })

  it('deduplicates alerts that share the same month and year', () => {
    expect(
      formatMonthLabels(
        [makeAlert(6, 2026, 1), makeAlert(6, 2026, 2), makeAlert(6, 2026, 3)],
        months,
      ),
    ).toBe('junio 2026')
  })

  it('mixes years and months in chronological order with dedup', () => {
    expect(
      formatMonthLabels(
        [makeAlert(12, 2026), makeAlert(6, 2026, 1), makeAlert(6, 2026, 2), makeAlert(1, 2027)],
        months,
      ),
    ).toBe('junio 2026, diciembre 2026 y enero 2027')
  })
})
