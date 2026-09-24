import { CalendarDays, Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { SelectPill } from '@/components/common/SelectPill'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/cn'
import { monthLabel, monthRange } from '@/lib/format'
import { monthsBetween, shiftMonth } from '@/lib/months'

export type Period = { start: string; end: string }
type Preset = Period & { id: string; label: string; isDefault?: boolean }

// Presets are relative to the latest month in the data, not to today.
function presetsFor(first: string, last: string): Preset[] {
  const years: Preset[] = []
  for (let year = Number(last.slice(0, 4)); year >= Number(first.slice(0, 4)); year -= 1) {
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

type PeriodPickerProps = {
  first: string
  last: string
  period: Period
  onChange: (period: Period | null) => void
}

export function PeriodPicker({ first, last, period, onChange }: PeriodPickerProps) {
  const [open, setOpen] = useState(false)
  const presets = presetsFor(first, last)
  const active = presets.find((p) => p.start === period.start && p.end === period.end)
  const months = monthsBetween(first, last)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Period"
        className="pressable inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-medium text-black"
      >
        <CalendarDays className="size-3.5" />
        {active ? active.label : monthRange(period.start, period.end)}
        <ChevronDown className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 border-none bg-hover p-2">
        <p className="px-2 pb-1 pt-1 text-xs font-bold uppercase tracking-wider text-subtle">
          Period
        </p>
        <ul role="listbox" aria-label="Period presets" className="grid grid-cols-2 gap-1">
          {presets.map((preset) => (
            <li key={preset.id}>
              <button
                type="button"
                role="option"
                aria-selected={active?.id === preset.id}
                onClick={() => {
                  onChange(preset.isDefault ? null : preset)
                  setOpen(false)
                }}
                className={cn(
                  'pressable flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-white/10',
                  active?.id === preset.id && 'text-pink',
                )}
              >
                {preset.label}
                {active?.id === preset.id && <Check className="size-3.5" />}
              </button>
            </li>
          ))}
        </ul>
        <p className="px-2 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-subtle">
          Custom range
        </p>
        <div className="flex flex-wrap gap-2 px-2 pb-1">
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
        </div>
      </PopoverContent>
    </Popover>
  )
}
