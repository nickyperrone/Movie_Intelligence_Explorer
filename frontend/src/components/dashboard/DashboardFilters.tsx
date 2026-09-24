import { CountryLabel, GenreLabel, PlatformLabel } from '@/components/common/Brand'
import type { Schemas } from '@/api/client'
import type { DashboardQuery } from '@/api/queries'
import { MultiSelectPill } from '@/components/common/MultiSelectPill'
import { Pill } from '@/components/common/Pill'
import { monthLabel } from '@/lib/format'

type DashboardFiltersProps = {
  options: Schemas['FilterOptions']
  query: DashboardQuery
  period: { start: string; end: string }
  onChange: (changes: Partial<DashboardQuery>) => void
  onReset: () => void
}

function monthsBetween(start: string, end: string): string[] {
  const months: string[] = []
  let [year, month] = start.split('-').map(Number)
  const [endYear, endMonth] = end.split('-').map(Number)
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return months
}

function MonthSelect({
  label,
  value,
  months,
  onChange,
}: {
  label: string
  value: string
  months: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="inline-flex h-8 items-center gap-2 rounded-full bg-pill pl-3.5 pr-2 text-sm hover:bg-hover">
      <span className="text-subtle">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent font-medium text-white outline-none"
      >
        {months.map((month) => (
          <option key={month} value={month} className="bg-hover">
            {monthLabel(month)}
          </option>
        ))}
      </select>
    </label>
  )
}

export function DashboardFilters({
  options,
  query,
  period,
  onChange,
  onReset,
}: DashboardFiltersProps) {
  const months = monthsBetween(options.consumption_months.start, options.consumption_months.end)
  const active =
    query.start ||
    query.end ||
    query.countries.length ||
    query.platforms.length ||
    query.genres.length ||
    query.distributors.length
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MonthSelect
        label="From"
        value={period.start}
        months={months}
        onChange={(start) => onChange({ start })}
      />
      <MonthSelect
        label="To"
        value={period.end}
        months={months}
        onChange={(end) => onChange({ end })}
      />
      <MultiSelectPill
        label="Countries"
        renderOption={(country) => <CountryLabel country={country} />}
        options={options.consumption.countries}
        selected={query.countries}
        onChange={(countries) => onChange({ countries })}
      />
      <MultiSelectPill
        label="Platforms"
        renderOption={(platform) => <PlatformLabel platform={platform} />}
        options={options.consumption.platforms}
        selected={query.platforms}
        onChange={(platforms) => onChange({ platforms })}
      />
      <MultiSelectPill
        label="Genres"
        renderOption={(genre) => <GenreLabel genre={genre} />}
        options={options.primary_genres}
        selected={query.genres}
        onChange={(genres) => onChange({ genres })}
      />
      <MultiSelectPill
        label="Distributors"
        options={options.distributors}
        selected={query.distributors}
        onChange={(distributors) => onChange({ distributors })}
      />
      <Pill
        active={query.distributors.length === 1 && query.distributors[0] === 'Sony'}
        onClick={() => onChange({ distributors: ['Sony'] })}
      >
        Sony titles
      </Pill>
      {active ? (
        <button
          type="button"
          onClick={onReset}
          className="px-2 text-sm font-bold text-subtle hover:text-white"
        >
          Reset
        </button>
      ) : null}
    </div>
  )
}
