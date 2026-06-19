import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * Recharts boundary. This is the ONLY file that imports recharts — every other
 * component talks to this small, library-agnostic API. Swapping the chart
 * library later means rewriting this file alone (Dependency Inversion).
 */

export interface TrendSeries {
  key: string
  label: string
  color: string
}

interface TrendChartProps {
  data: Array<Record<string, string | number | null>>
  xKey: string
  series: TrendSeries[]
  height?: number
  /** Formats tooltip values (full precision, e.g. currency). */
  formatValue?: (value: number) => string
  /** Formats Y-axis ticks (compact, to avoid clipping). Falls back to formatValue. */
  formatTick?: (value: number) => string
}

/**
 * Round a value up to a "nice" axis maximum so the top tick sits just above the
 * data, never far above it. 899 → 900, 727 → 800, 4100 → 5000.
 */
export function niceCeil(value: number): number {
  if (value <= 0) return 10
  const pow = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / pow) * pow
}

/** Y-axis top: a "nice" value just above the largest point across all series. */
export function computeAxisMax(
  data: Array<Record<string, string | number | null>>,
  series: TrendSeries[],
): number {
  const maxValue = Math.max(0, ...data.flatMap((row) => series.map((s) => Number(row[s.key] ?? 0))))
  return niceCeil(maxValue)
}

export function TrendChart({
  data,
  xKey,
  series,
  height = 280,
  formatValue,
  formatTick,
}: TrendChartProps) {
  const axisMax = computeAxisMax(data, series)
  const formatYTick = formatTick ?? formatValue

  return (
    <ResponsiveContainer width='100%' height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray='3 3' stroke='#e2e8f0' vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          domain={[0, axisMax]}
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          // recharts calls tickFormatter(value, index). Wrap it so only the value
          // reaches the formatter — otherwise the index leaks into formatCurrency's
          // `currency` arg and prefixes ticks with 0,1,2,3,4 (the infamous "4900").
          tickFormatter={formatYTick ? (value: number) => formatYTick(value) : undefined}
          width={56}
          allowDecimals={false}
        />
        <Tooltip
          formatter={(value: number | string) =>
            formatValue && typeof value === 'number' ? formatValue(value) : value
          }
          contentStyle={{
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            fontSize: 13,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type='monotone'
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
