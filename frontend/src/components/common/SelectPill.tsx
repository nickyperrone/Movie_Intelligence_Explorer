import { Check, ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/cn'

type SelectPillProps = {
  label: string
  value: string | undefined
  options: string[]
  onChange: (value: string) => void
  renderOption?: (option: string) => ReactNode
  placeholder?: string
  prefix?: string
  size?: 'sm' | 'lg'
}

// Single choice with the same popover as MultiSelectPill; replaces native <select> everywhere.
export function SelectPill({
  label,
  value,
  options,
  onChange,
  renderOption = (option) => option,
  placeholder = 'Choose',
  prefix,
  size = 'sm',
}: SelectPillProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        className={cn(
          'inline-flex shrink-0 items-center gap-2 rounded-full bg-pill font-medium text-white transition-colors hover:bg-hover',
          size === 'lg' ? 'h-11 px-4 text-base' : 'h-8 px-3.5 text-sm',
        )}
      >
        {prefix && <span className="text-subtle">{prefix}</span>}
        {value ? renderOption(value) : <span className="text-subtle">{placeholder}</span>}
        <ChevronDown className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 border-none bg-hover p-1">
        <ul className="max-h-72 overflow-y-auto" role="listbox" aria-label={label}>
          {options.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-white/10"
              >
                <span className={option === value ? 'text-pink' : undefined}>
                  {renderOption(option)}
                </span>
                {option === value && <Check className="size-4 text-pink" />}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
