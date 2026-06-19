import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { cloneElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) =>
      cloneElement(children, { width: 600, height: 300 }),
  }
})

import { formatCompactCurrency, formatCurrency } from '../../../utils/formatters'
import { TrendChart } from './TrendChart'

const SERIES = [
  { key: 'expected', label: 'Esperado', color: '#94a3b8' },
  { key: 'paid', label: 'Cobrado', color: '#10b981' },
  { key: 'net', label: 'Neto', color: '#6366f1' },
]

const DATA = [
  { period: '2026-01', expected: 120, paid: 0, net: null },
  { period: '2026-05', expected: 899, paid: 727, net: null },
  { period: '2026-06', expected: 270.75, paid: 0, net: null },
]

describe('TrendChart Y-axis tick labels (regression: index must not leak into currency)', () => {
  it('formats ticks as € amounts, never index+value like "4900"/"1225"', () => {
    const { container } = render(
      <TrendChart
        data={DATA}
        xKey='period'
        series={SERIES}
        formatValue={formatCurrency}
        formatTick={formatCompactCurrency}
      />,
    )
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent ?? '')

    const yTicks = texts.filter((s) => !s.startsWith('2026-'))
    // Every Y tick must be € formatted.
    expect(yTicks.every((s) => s.startsWith('€'))).toBe(true)
    // The index-leak artifacts must be gone.
    expect(texts.some((s) => s === '4900' || s === '1225' || s === '00')).toBe(false)
  })
})
