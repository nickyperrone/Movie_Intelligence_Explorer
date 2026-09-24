import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// "Where does this come from": dataset, formula and grain behind a panel (docs/04-metrics.md).
export function SourceNote({ children }: { children: string }) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-subtle hover:bg-hover hover:text-white">
        <Info className="size-3.5" /> Source
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 border-none bg-hover text-sm leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  )
}
