import { describe, expect, it } from 'vitest'
import type { ClassSession } from '../../types'
import { sumPlannedHours, sumWorkedHours } from './constants'

const cls = (
  durationHours: number,
  status: ClassSession['status'],
  classDate = '2026-06-15',
  classTime: string | null = '10:00:00',
): ClassSession => ({ durationHours, status, classDate, classTime }) as ClassSession

describe('sumPlannedHours', () => {
  it('sums duration of all normal classes regardless of date', () => {
    expect(
      sumPlannedHours([cls(2, 'normal', '2026-06-15'), cls(1.5, 'normal', '2030-01-01')]),
    ).toBe(3.5)
  })

  it('excludes both cancellation statuses', () => {
    expect(
      sumPlannedHours([
        cls(2, 'normal'),
        cls(1, 'cancelledWithPayment'),
        cls(1, 'cancelledWithoutPayment'),
      ]),
    ).toBe(2)
  })

  it('returns 0 for an empty list', () => {
    expect(sumPlannedHours([])).toBe(0)
  })
})

describe('sumWorkedHours', () => {
  const now = new Date('2026-06-18T12:00:00')

  it('counts a normal class that has already ended', () => {
    expect(sumWorkedHours([cls(2, 'normal', '2026-06-15', '10:00:00')], now)).toBe(2)
  })

  it('excludes a future class that has not happened yet', () => {
    expect(sumWorkedHours([cls(2, 'normal', '2026-06-20', '10:00:00')], now)).toBe(0)
  })

  it('excludes a class earlier today that has not ended yet', () => {
    // starts 14:00 today, now is 12:00 → not ended
    expect(sumWorkedHours([cls(1, 'normal', '2026-06-18', '14:00:00')], now)).toBe(0)
  })

  it('counts a class earlier today that already ended', () => {
    // 10:00 + 1h = 11:00 today, now is 12:00 → ended
    expect(sumWorkedHours([cls(1, 'normal', '2026-06-18', '10:00:00')], now)).toBe(1)
  })

  it('excludes cancellations even if already ended', () => {
    expect(
      sumWorkedHours(
        [cls(2, 'normal', '2026-06-15'), cls(1, 'cancelledWithPayment', '2026-06-15')],
        now,
      ),
    ).toBe(2)
  })

  it('for a class without a time, counts it only once the whole day has passed', () => {
    expect(sumWorkedHours([cls(2, 'normal', '2026-06-15', null)], now)).toBe(2)
    expect(sumWorkedHours([cls(2, 'normal', '2026-06-18', null)], now)).toBe(0)
    expect(sumWorkedHours([cls(2, 'normal', '2026-06-20', null)], now)).toBe(0)
  })
})
