import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { monthLabel, monthShort } from '@/lib/format'

export type TrendSeries = {
  key: string
  label: ReactNode
  name: string
  color: string
  values: number[]
  dashed?: boolean
}

type TrendChartProps = {
  months: string[]
  series: TrendSeries[]
  metricLabel: string
  format: (value: number) => string
  unit?: string
  height?: number
}

const axisNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

const AXIS_TICK = { fill: '#b3b3b3', fontSize: 12 }
const TOOLTIP_STYLE = { background: '#282828', border: 'none', borderRadius: 8, color: '#fff' }

export function TrendChart({
  months,
  series,
  metricLabel,
  format,
  unit = '',
  height = 300,
}: TrendChartProps) {
  const rows = months.map((month, index) =>
    Object.fromEntries([['month', month], ...series.map((s) => [s.key, s.values[index] ?? null])]),
  )
  const axis = {
    x: (
      <XAxis
        dataKey="month"
        tickFormatter={monthShort}
        tick={AXIS_TICK}
        axisLine={false}
        tickLine={false}
        minTickGap={24}
      />
    ),
    // Short labels ("600K h") and a wide gutter so the axis never clips.
    y: (
      <YAxis
        tickFormatter={(value: number) => `${axisNumber.format(value)}${unit}`}
        tick={AXIS_TICK}
        axisLine={false}
        tickLine={false}
        width={72}
      />
    ),
    grid: <CartesianGrid vertical={false} stroke="rgb(255 255 255 / 0.06)" />,
    tooltip: (
      <Tooltip
        cursor={{ stroke: 'rgb(255 255 255 / 0.2)' }}
        contentStyle={TOOLTIP_STYLE}
        labelFormatter={(month) => monthLabel(String(month))}
        formatter={(value, name) => [
          format(Number(value)),
          series.length > 1 ? String(name) : metricLabel,
        ]}
      />
    ),
  }
  const label = `${metricLabel} per month from ${monthLabel(months[0])} to ${monthLabel(months.at(-1))}`

  return (
    <div>
      <div role="img" aria-label={label} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {series.length === 1 ? (
            <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff6fcf" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#e157f5" stopOpacity={0} />
                </linearGradient>
              </defs>
              {axis.grid}
              {axis.x}
              {axis.y}
              {axis.tooltip}
              <Area
                type="monotone"
                dataKey={series[0].key}
                name={series[0].name}
                stroke={series[0].color}
                strokeWidth={2}
                fill="url(#trend-fill)"
                dot={months.length <= 3}
              />
            </AreaChart>
          ) : (
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              {axis.grid}
              {axis.x}
              {axis.y}
              {axis.tooltip}
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? '6 4' : undefined}
                  dot={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {series.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Legend">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className="h-0.5 w-5 rounded-full"
                style={{
                  background: s.dashed
                    ? `repeating-linear-gradient(90deg, ${s.color} 0 5px, transparent 5px 8px)`
                    : s.color,
                }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
