import type { Schemas } from '@/api/client'
import { cn } from '@/lib/cn'

const SIGNALS: Record<Schemas['DemandSignal'], { label: string; className: string }> = {
  strong: { label: 'Strong demand signal', className: 'bg-pink text-black' },
  moderate: { label: 'Moderate demand signal', className: 'bg-white text-black' },
  weak: { label: 'Weak demand signal', className: 'bg-negative text-black' },
  insufficient_evidence: { label: 'Not enough evidence', className: 'bg-pill text-white' },
}

export function SignalBadge({
  signal,
  compact = false,
}: {
  signal: Schemas['DemandSignal']
  compact?: boolean
}) {
  const { label, className } = SIGNALS[signal]
  const text = compact
    ? label.replace(' demand signal', '').replace('Not enough evidence', 'Too little data')
    : label
  return (
    <span
      className={cn(
        'inline-flex rounded-full font-bold',
        compact ? 'px-2.5 py-0.5 text-xs' : 'px-4 py-1.5 text-sm',
        className,
      )}
    >
      {text}
    </span>
  )
}
