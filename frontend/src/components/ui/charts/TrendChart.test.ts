import { describe, expect, it } from 'vitest'
import { computeAxisMax, niceCeil } from './TrendChart'

const REVENUE_SERIES = [
  { key: 'expected', label: 'Expected', color: '#000' },
  { key: 'paid', label: 'Paid', color: '#000' },
  { key: 'net', label: 'Net', color: '#000' },
]

describe('computeAxisMax — Y-axis top from data', () => {
  it("uses the real data max, not an inflated value (user's actual data)", () => {
    const data = [
      { period: '2026-01', expected: 120, paid: 0, net: null },
      { period: '2026-02', expected: 160, paid: 0, net: null },
      { period: '2026-03', expected: 200, paid: 0, net: null },
      { period: '2026-04', expected: 567, paid: 0, net: null },
      { period: '2026-05', expected: 899, paid: 727, net: null },
      { period: '2026-06', expected: 270.75, paid: 0, net: null },
    ]
    // Max point is 899 → axis tops at 900, NOT 4900.
    expect(computeAxisMax(data, REVENUE_SERIES)).toBe(900)
  })

  it('ignores null series (net unconfigured) instead of treating them as huge', () => {
    const data = [{ period: 'p', expected: 50, paid: 40, net: null }]
    expect(computeAxisMax(data, REVENUE_SERIES)).toBe(50)
  })

  it('returns a small positive max for empty data', () => {
    expect(computeAxisMax([], REVENUE_SERIES)).toBe(10)
  })
})

describe('niceCeil — chart Y-axis top', () => {
  it('rounds just above the data max, not far above it', () => {
    expect(niceCeil(899)).toBe(900)
    expect(niceCeil(727)).toBe(800)
    expect(niceCeil(4100)).toBe(5000)
    expect(niceCeil(120)).toBe(200)
  })

  it('returns an exact round value unchanged', () => {
    expect(niceCeil(900)).toBe(900)
    expect(niceCeil(5000)).toBe(5000)
  })

  it('falls back to a small positive max for empty/zero data', () => {
    expect(niceCeil(0)).toBe(10)
    expect(niceCeil(-5)).toBe(10)
  })
})
