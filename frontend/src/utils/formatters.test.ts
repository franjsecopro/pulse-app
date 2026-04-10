import { describe, it, expect } from 'vitest'
import { formatDate, formatHours, formatCurrency, calcDuration } from './formatters'

// ─── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('converts ISO date to DD/MM/YYYY', () => {
    expect(formatDate('2026-05-01')).toBe('01/05/2026')
  })

  it('pads single-digit day and month', () => {
    expect(formatDate('2026-01-03')).toBe('03/01/2026')
  })

  it('returns fallback "—" for null', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('returns fallback "—" for undefined', () => {
    expect(formatDate(undefined)).toBe('—')
  })

  it('returns custom fallback when provided', () => {
    expect(formatDate(null, 'Sin fecha')).toBe('Sin fecha')
  })

  it('returns fallback for malformed date string', () => {
    expect(formatDate('not-a-date')).toBe('—')
  })
})

// ─── formatHours ─────────────────────────────────────────────────────────────

describe('formatHours', () => {
  it('formats whole hours without minutes', () => {
    expect(formatHours(2)).toBe('2h')
  })

  it('formats minutes-only durations', () => {
    expect(formatHours(0.5)).toBe('30min')
  })

  it('formats hours and minutes together', () => {
    expect(formatHours(1.5)).toBe('1h 30min')
  })

  it('rounds fractional minutes correctly', () => {
    expect(formatHours(1.25)).toBe('1h 15min')
  })

  it('formats 1 hour exactly', () => {
    expect(formatHours(1)).toBe('1h')
  })

  it('formats 45 minutes', () => {
    expect(formatHours(0.75)).toBe('45min')
  })
})

// ─── formatCurrency ──────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats with default euro symbol', () => {
    expect(formatCurrency(55)).toBe('€55.00')
  })

  it('shows two decimal places', () => {
    expect(formatCurrency(100)).toBe('€100.00')
  })

  it('formats decimal amounts correctly', () => {
    expect(formatCurrency(12.5)).toBe('€12.50')
  })

  it('accepts a custom currency symbol', () => {
    expect(formatCurrency(100, '$')).toBe('$100.00')
  })

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('€0.00')
  })
})

// ─── calcDuration ────────────────────────────────────────────────────────────

describe('calcDuration', () => {
  it('calculates duration in decimal hours', () => {
    expect(calcDuration('09:00', '10:30')).toBe(1.5)
  })

  it('returns 1 for a one-hour slot', () => {
    expect(calcDuration('09:00', '10:00')).toBe(1)
  })

  it('calculates a 45-minute slot', () => {
    expect(calcDuration('10:00', '10:45')).toBe(0.75)
  })

  it('calculates a cross-hour slot', () => {
    expect(calcDuration('08:30', '10:00')).toBe(1.5)
  })

  it('returns 0 for equal start and end times', () => {
    expect(calcDuration('09:00', '09:00')).toBe(0)
  })

  it('calculates a 2-hour slot', () => {
    expect(calcDuration('09:00', '11:00')).toBe(2)
  })
})
