import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/cn'
import { toggle } from '@/lib/url-state'

type MultiSelectPillProps = {
  label: string
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  renderOption?: (option: string) => ReactNode
}

export function MultiSelectPill({
  label,
  options,
  selected,
  onChange,
  renderOption = (option) => option,
}: MultiSelectPillProps) {
  const summary =
    selected.length === 0
      ? label
      : selected.length === 1
        ? selected[0]
        : `${selected[0]} +${selected.length - 1}`
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'pressable inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors',
          selected.length ? 'bg-white text-black' : 'bg-pill text-white hover:bg-hover',
        )}
        aria-label={`${label} filter`}
      >
        {summary}
        <ChevronDown className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 border-none bg-hover p-1">
        <ul
          className="max-h-72 overflow-y-auto"
          role="listbox"
          aria-multiselectable
          aria-label={label}
        >
          {options.map((option) => {
            const checked = selected.includes(option)
            return (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => onChange(toggle(selected, option))}
                  className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-white/10"
                >
                  <span className={checked ? 'text-pink' : undefined}>{renderOption(option)}</span>
                  {checked && <Check className="size-4 text-pink" />}
                </button>
              </li>
            )
          })}
        </ul>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-1 w-full rounded-sm px-3 py-2 text-left text-sm text-subtle hover:bg-white/10 hover:text-white"
          >
            Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
