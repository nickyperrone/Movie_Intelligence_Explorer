import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Schemas } from '@/api/client'
import type { DashboardQuery } from '@/api/queries'
import { CountryLabel, GenreLabel, PlatformLabel } from '@/components/common/Brand'
import { MultiSelectPill } from '@/components/common/MultiSelectPill'
import { Pill } from '@/components/common/Pill'
import { monthRange } from '@/lib/format'
import { shiftMonth } from '@/lib/months'
import { PeriodPicker } from './PeriodPicker'

type DashboardToolbarProps = {
  options: Schemas['FilterOptions']
  query: DashboardQuery
  summary: Schemas['DashboardSummary'] | undefined
  onChange: (changes: Partial<DashboardQuery>) => void
  onReset: () => void
}

function Chip({
  children,
  onRemove,
  label,
}: {
  children: ReactNode
  onRemove: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${label}`}
      className="pressable inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-white pl-3 pr-2 text-xs font-medium text-black hover:bg-white/85"
    >
      {children}
      <X className="size-3" />
    </button>
  )
}

export function DashboardToolbar({
  options,
  query,
  summary,
  onChange,
  onReset,
}: DashboardToolbarProps) {
  const { start: first, end: last } = options.consumption_months
  const period = summary?.filters ?? { start: shiftMonth(last, -11), end: last }
  const themeName = new Map(options.themes.map((theme) => [theme.theme_id, theme.name]))
  const without = (key: keyof DashboardQuery, value: string) => () =>
    onChange({ [key]: (query[key] as string[]).filter((item) => item !== value) })

  const chips = [
    ...query.countries.map((v) => ({
      key: `country ${v}`,
      node: <CountryLabel country={v} />,
      remove: without('countries', v),
    })),
    ...query.platforms.map((v) => ({
      key: `platform ${v}`,
      node: <PlatformLabel platform={v} />,
      remove: without('platforms', v),
    })),
    ...query.genres.map((v) => ({
      key: `genre ${v}`,
      node: <GenreLabel genre={v} />,
      remove: without('genres', v),
    })),
    ...query.themes.map((v) => ({
      key: `theme ${v}`,
      node: <span>{themeName.get(v) ?? v}</span>,
      remove: without('themes', v),
    })),
    ...query.distributors.map((v) => ({
      key: `distributor ${v}`,
      node: <span>{v}</span>,
      remove: without('distributors', v),
    })),
  ]
  const customized = chips.length > 0 || query.start !== undefined || query.end !== undefined

  return (
    <div className="sticky top-0 z-10 -mx-6 border-b border-white/5 bg-surface px-6 py-3 max-sm:-mx-4 max-sm:px-4">
      <div
        className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 scrollbar-none"
        role="group"
        aria-label="Filters"
      >
        <PeriodPicker
          first={first}
          last={last}
          period={period}
          onChange={(next) =>
            onChange(
              next ? { start: next.start, end: next.end } : { start: undefined, end: undefined },
            )
          }
        />
        <span className="mx-1 h-5 w-px shrink-0 bg-white/15" aria-hidden />
        <MultiSelectPill
          label="Countries"
          options={options.consumption.countries}
          selected={query.countries}
          onChange={(countries) => onChange({ countries })}
          renderOption={(v) => <CountryLabel country={v} />}
        />
        <MultiSelectPill
          label="Platforms"
          options={options.consumption.platforms}
          selected={query.platforms}
          onChange={(platforms) => onChange({ platforms })}
          renderOption={(v) => <PlatformLabel platform={v} />}
        />
        <MultiSelectPill
          label="Genres"
          options={options.primary_genres}
          selected={query.genres}
          onChange={(genres) => onChange({ genres })}
          renderOption={(v) => <GenreLabel genre={v} />}
        />
        <MultiSelectPill
          label="Themes"
          options={options.themes.map((t) => t.theme_id)}
          selected={query.themes}
          onChange={(themes) => onChange({ themes })}
          renderOption={(v) => themeName.get(v) ?? v}
        />
        <MultiSelectPill
          label="Distributors"
          options={options.distributors}
          selected={query.distributors}
          onChange={(distributors) => onChange({ distributors })}
        />
        <Pill
          active={query.distributors.length === 1 && query.distributors[0] === 'Sony'}
          onClick={() =>
            onChange({ distributors: query.distributors.includes('Sony') ? [] : ['Sony'] })
          }
        >
          Sony titles
        </Pill>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span>
          <span className="font-bold">{monthRange(period.start, period.end)}</span>
          <span className="text-subtle">
            {summary?.previous_period
              ? ` · vs ${monthRange(summary.previous_period.start, summary.previous_period.end)}`
              : summary
                ? ' · no comparison: the previous period starts before Jan 2023'
                : ''}
          </span>
        </span>
        {chips.map((chip) => (
          <Chip key={chip.key} label={chip.key} onRemove={chip.remove}>
            {chip.node}
          </Chip>
        ))}
        {customized && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-bold text-subtle hover:text-white"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}
