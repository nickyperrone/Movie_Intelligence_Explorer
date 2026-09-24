import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { compact, monthLabel, monthShort } from '@/lib/format'

type Point = { month: string; value: number }

type TrendChartProps = {
  points: Point[]
  metricLabel: string
  format?: (value: number) => string
  height?: number
}

export function TrendChart({
  points,
  metricLabel,
  format = compact,
  height = 280,
}: TrendChartProps) {
  const first = points[0]?.month
  const last = points.at(-1)?.month
  return (
    <div
      role="img"
      aria-label={`${metricLabel} per month from ${monthLabel(first)} to ${monthLabel(last)}`}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6fcf" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#e157f5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgb(255 255 255 / 0.06)" />
          <XAxis
            dataKey="month"
            tickFormatter={monthShort}
            tick={{ fill: '#b3b3b3', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(value: number) => format(value)}
            tick={{ fill: '#b3b3b3', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: 'rgb(255 255 255 / 0.2)' }}
            contentStyle={{ background: '#282828', border: 'none', borderRadius: 8, color: '#fff' }}
            labelFormatter={(month) => monthLabel(String(month))}
            formatter={(value) => [format(Number(value)), metricLabel]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#ff6fcf"
            strokeWidth={2}
            fill="url(#trend-fill)"
            dot={points.length <= 3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
