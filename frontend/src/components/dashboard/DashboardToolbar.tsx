import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Schemas } from '@/api/client'
import type { DashboardQuery } from '@/api/queries'
import { CountryLabel, GenreLabel, PlatformLabel } from '@/components/common/Brand'
import { MultiSelectPill } from '@/components/common/MultiSelectPill'
import { Pill } from '@/components/common/Pill'
import { SelectPill } from '@/components/common/SelectPill'
import { monthLabel, monthRange } from '@/lib/format'
import { monthsBetween, shiftMonth } from '@/lib/months'

type Preset = { id: string; label: string; start: string; end: string; isDefault?: boolean }

// Presets are relative to the latest month in the data, not to today.
function presetsFor(first: string, last: string): Preset[] {
  const lastYear = Number(last.slice(0, 4))
  const firstYear = Number(first.slice(0, 4))
  const years: Preset[] = []
  for (let year = lastYear; year >= firstYear; year -= 1) {
    years.push({
      id: String(year),
      label: String(year),
      start: `${year}-01` < first ? first : `${year}-01`,
      end: `${year}-12` > last ? last : `${year}-12`,
    })
  }
  return [
    { id: '3m', label: 'Last 3 months', start: shiftMonth(last, -2), end: last },
    { id: '6m', label: 'Last 6 months', start: shiftMonth(last, -5), end: last },
    {
      id: '12m',
      label: 'Last 12 months',
      start: shiftMonth(last, -11),
      end: last,
      isDefault: true,
    },
    ...years,
    { id: 'all', label: 'All time', start: first, end: last },
  ]
}

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
      className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white pl-3 pr-2 text-xs font-medium text-black hover:bg-white/85"
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
  const presets = presetsFor(first, last)
  const period = summary?.filters ?? { start: shiftMonth(last, -11), end: last }
  const activePreset = presets.find(
    (preset) => preset.start === period.start && preset.end === period.end,
  )
  const [customOpen, setCustomOpen] = useState(false)
  const showCustom = customOpen || !activePreset
  const months = monthsBetween(first, last)

  const filterChips = [
    ...query.countries.map((value) => ({
      key: `c-${value}`,
      node: <CountryLabel country={value} />,
      remove: () => onChange({ countries: query.countries.filter((v) => v !== value) }),
    })),
    ...query.platforms.map((value) => ({
      key: `p-${value}`,
      node: <PlatformLabel platform={value} />,
      remove: () => onChange({ platforms: query.platforms.filter((v) => v !== value) }),
    })),
    ...query.genres.map((value) => ({
      key: `g-${value}`,
      node: <GenreLabel genre={value} />,
      remove: () => onChange({ genres: query.genres.filter((v) => v !== value) }),
    })),
    ...query.distributors.map((value) => ({
      key: `d-${value}`,
      node: <span>{value}</span>,
      remove: () => onChange({ distributors: query.distributors.filter((v) => v !== value) }),
    })),
  ]

  return (
    <div className="sticky top-0 z-10 -mx-6 space-y-3 border-b border-white/5 bg-surface/95 px-6 py-3 backdrop-blur max-sm:-mx-4 max-sm:px-4">
      <div
        className="flex items-center gap-2 overflow-x-auto scrollbar-none"
        role="group"
        aria-label="Period"
      >
        {presets.map((preset) => (
          <Pill
            key={preset.id}
            active={!showCustom && activePreset?.id === preset.id}
            onClick={() => {
              setCustomOpen(false)
              onChange(
                preset.isDefault
                  ? { start: undefined, end: undefined }
                  : { start: preset.start, end: preset.end },
              )
            }}
          >
            {preset.label}
          </Pill>
        ))}
        <Pill active={showCustom} onClick={() => setCustomOpen(true)}>
          Custom
        </Pill>
        {showCustom && (
          <>
            <SelectPill
              label="From month"
              prefix="From"
              value={period.start}
              options={months.filter((m) => m <= period.end)}
              renderOption={monthLabel}
              onChange={(start) => onChange({ start, end: period.end })}
            />
            <SelectPill
              label="To month"
              prefix="To"
              value={period.end}
              options={months.filter((m) => m >= period.start)}
              renderOption={monthLabel}
              onChange={(end) => onChange({ start: period.start, end })}
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectPill
          label="Countries"
          options={options.consumption.countries}
          selected={query.countries}
          onChange={(countries) => onChange({ countries })}
          renderOption={(country) => <CountryLabel country={country} />}
        />
        <MultiSelectPill
          label="Platforms"
          options={options.consumption.platforms}
          selected={query.platforms}
          onChange={(platforms) => onChange({ platforms })}
          renderOption={(platform) => <PlatformLabel platform={platform} />}
        />
        <MultiSelectPill
          label="Genres"
          options={options.primary_genres}
          selected={query.genres}
          onChange={(genres) => onChange({ genres })}
          renderOption={(genre) => <GenreLabel genre={genre} />}
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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span>
          <span className="font-bold">{monthRange(period.start, period.end)}</span>
          <span className="text-subtle">
            {summary?.previous_period
              ? ` · compared with ${monthRange(summary.previous_period.start, summary.previous_period.end)}`
              : summary
                ? ' · no comparison: the previous period starts before Jan 2023'
                : ''}
          </span>
        </span>
        {filterChips.map((chip) => (
          <Chip key={chip.key} label={chip.key.slice(2)} onRemove={chip.remove}>
            {chip.node}
          </Chip>
        ))}
        {(filterChips.length > 0 || !activePreset?.isDefault) && (
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
