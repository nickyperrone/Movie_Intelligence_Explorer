import type { Schemas } from '@/api/client'
import { cn } from '@/lib/cn'

const SIGNALS: Record<Schemas['DemandSignal'], { label: string; className: string }> = {
  strong: { label: 'Strong demand signal', className: 'bg-pink text-black' },
  moderate: { label: 'Moderate demand signal', className: 'bg-white text-black' },
  weak: { label: 'Weak demand signal', className: 'bg-negative text-black' },
  insufficient_evidence: { label: 'Not enough evidence', className: 'bg-pill text-white' },
}

export function SignalBadge({ signal }: { signal: Schemas['DemandSignal'] }) {
  const { label, className } = SIGNALS[signal]
  return (
    <span className={cn('inline-flex rounded-full px-4 py-1.5 text-sm font-bold', className)}>
      {label}
    </span>
  )
}
