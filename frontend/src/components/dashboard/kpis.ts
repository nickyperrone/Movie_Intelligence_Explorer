import type { Schemas } from '@/api/client'
import { compact, hours, percent } from '@/lib/format'

export type KpiKey = 'streams' | 'viewing_hours' | 'titles_with_consumption' | 'engagement'

export type KpiDefinition = {
  key: KpiKey
  label: string
  formula: string
  source: string
  format: (value: number | null) => string
  ratio: boolean
  // What each platform or country contributes, read from a breakdown item.
  contribution: (item: Schemas['BreakdownItem']) => number
  contributionFormat: (value: number | null) => string
  titleSort: Schemas['TitleSort']
}

const CONSUMPTION =
  'Monthly consumption, dataset C (one row per movie, month, country and platform).'

export const KPIS: KpiDefinition[] = [
  {
    key: 'streams',
    label: 'Streams',
    formula: 'Sum of streams over every row in the period that matches the filters.',
    source: CONSUMPTION,
    format: compact,
    ratio: false,
    contribution: (item) => item.streams,
    contributionFormat: compact,
    titleSort: 'streams',
  },
  {
    key: 'viewing_hours',
    label: 'Viewing hours',
    formula: 'Sum of viewing minutes over the same rows, divided by 60.',
    source: CONSUMPTION,
    format: hours,
    ratio: false,
    contribution: (item) => item.viewing_hours,
    contributionFormat: hours,
    titleSort: 'viewing_hours',
  },
  {
    key: 'titles_with_consumption',
    label: 'Titles streamed',
    formula: 'Number of different movies with at least one stream in the period.',
    source: CONSUMPTION,
    format: compact,
    ratio: false,
    contribution: (item) => item.titles,
    contributionFormat: compact,
    titleSort: 'streams',
  },
  {
    key: 'engagement',
    label: 'Engagement',
    formula:
      'Viewing minutes ÷ (streams × runtime), summed over all rows: the share of a movie watched per stream. It is a ratio of sums, so large titles weigh in proportion to their streams.',
    source: `${CONSUMPTION} Runtime from dataset A.`,
    format: percent,
    ratio: true,
    contribution: (item) => item.streams,
    contributionFormat: compact,
    titleSort: 'streams',
  },
]
