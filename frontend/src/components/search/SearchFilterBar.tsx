import { CountryLabel, GenreLabel, PlatformLabel } from '@/components/common/Brand'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { Schemas } from '@/api/client'
import { MultiSelectPill } from '@/components/common/MultiSelectPill'
import { SelectPill } from '@/components/common/SelectPill'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type Filters = Schemas['SearchFilters']

type Chip = { id: string; label: string; remove: (filters: Filters) => Filters }

function chipsFor(filters: Filters): Chip[] {
  const without =
    <K extends keyof Filters>(key: K, value: string) =>
    (f: Filters) => ({
      ...f,
      [key]: (f[key] as string[]).filter((item) => item !== value),
    })
  return [
    ...filters.genres.map((genre) => ({
      id: `g-${genre}`,
      label: genre,
      remove: without('genres', genre),
    })),
    ...(filters.year_min !== null || filters.year_max !== null
      ? [
          {
            id: 'years',
            label:
              filters.year_min === filters.year_max
                ? String(filters.year_min)
                : `${filters.year_min ?? '…'}–${filters.year_max ?? '…'}`,
            remove: (f: Filters) => ({ ...f, year_min: null, year_max: null }),
          },
        ]
      : []),
    ...filters.countries.map((country) => ({
      id: `c-${country}`,
      label: `In ${country}`,
      remove: without('countries', country),
    })),
    ...filters.platforms.map((platform) => ({
      id: `p-${platform}`,
      label: `On ${platform}`,
      remove: without('platforms', platform),
    })),
    ...filters.people.map((person) => ({
      id: `n-${person}`,
      label: `With ${person}`,
      remove: without('people', person),
    })),
  ]
}

type SearchFilterBarProps = {
  filters: Filters
  options: Schemas['FilterOptions']
  onChange: (filters: Filters) => void
}

export function SearchFilterBar({ filters, options, onChange }: SearchFilterBarProps) {
  const [person, setPerson] = useState('')
  const years = Array.from(
    { length: options.year_range.max - options.year_range.min + 1 },
    (_, index) => options.year_range.min + index,
  )
  const chips = chipsFor(filters)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onChange(chip.remove(filters))}
          aria-label={`Remove filter ${chip.label}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white pl-3.5 pr-2.5 text-sm font-medium text-black hover:bg-white/85"
        >
          {chip.label}
          <X className="size-3.5" />
        </button>
      ))}
      <MultiSelectPill
        label="Genres"
        renderOption={(genre) => <GenreLabel genre={genre} />}
        options={options.genres}
        selected={filters.genres}
        onChange={(genres) => onChange({ ...filters, genres })}
      />
      <MultiSelectPill
        label="Platform"
        renderOption={(platform) => <PlatformLabel platform={platform} />}
        options={options.availability.platforms}
        selected={filters.platforms}
        onChange={(platforms) => onChange({ ...filters, platforms })}
      />
      <MultiSelectPill
        label="Country"
        renderOption={(country) => <CountryLabel country={country} />}
        options={options.availability.countries}
        selected={filters.countries}
        onChange={(countries) => onChange({ ...filters, countries })}
      />
      <Popover>
        <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-full bg-pill px-3.5 text-sm font-medium hover:bg-hover">
          <Plus className="size-3.5" /> Year or person
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-4 border-none bg-hover">
          <div className="flex flex-wrap gap-2">
            {(['year_min', 'year_max'] as const).map((key) => (
              <SelectPill
                key={key}
                label={key === 'year_min' ? 'From year' : 'To year'}
                prefix={key === 'year_min' ? 'From' : 'To'}
                placeholder="Any"
                value={filters[key] === null ? 'Any' : String(filters[key])}
                options={['Any', ...years.map(String)]}
                onChange={(value) =>
                  onChange({ ...filters, [key]: value === 'Any' ? null : Number(value) })
                }
              />
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const name = person.trim()
              if (name.length >= 2 && filters.people.length < 3) {
                onChange({ ...filters, people: [...filters.people, name] })
                setPerson('')
              }
            }}
          >
            <label className="text-xs text-subtle" htmlFor="person-filter">
              Actor or director
            </label>
            <input
              id="person-filter"
              value={person}
              onChange={(event) => setPerson(event.target.value)}
              placeholder="e.g. Sam Raimi"
              className="mt-1 w-full rounded-md bg-pill px-2 py-1.5 text-sm text-white placeholder:text-subtle"
            />
          </form>
        </PopoverContent>
      </Popover>
    </div>
  )
}
