import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import type { Schemas } from '@/api/client'
import * as queries from '@/api/queries'
import { LicensingTab } from '@/components/decide/LicensingTab'
import { PerformanceSection } from '@/components/movie/PerformanceSection'

vi.mock('@/api/queries')

function renderWithProviders(ui: ReactNode, route = '/') {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

function result<T>(data: T) {
  return { data, isError: false, isSuccess: true, error: null, refetch: vi.fn() } as never
}

const movie: Schemas['MovieSummary'] = {
  title_id: 'tt1',
  title: 'Test Movie',
  year: 2025,
  runtime_minutes: 100,
  primary_genre: 'Drama',
  genres: ['Drama'],
  rating: 7,
  vote_count: 1000,
  image_url: null,
}

describe('movie performance', () => {
  it('says so when a movie has no consumption', () => {
    vi.mocked(queries.usePerformance).mockReturnValue(
      result({
        title_id: 'tt1',
        applied_filters: { countries: [], platforms: [] },
        options: { countries: [], platforms: [] },
        period: null,
        totals: { streams: 0, viewing_hours: 0 },
        series: [],
        by_country: [],
        by_platform: [],
      }),
    )
    renderWithProviders(<PerformanceSection titleId="tt1" />)
    expect(
      screen.getByText('No consumption recorded in Argentina, Brazil, Colombia or Mexico.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /per month/ })).not.toBeInTheDocument()
  })
})

describe('licensing assessment', () => {
  it('explains when there are not enough comparable titles', () => {
    vi.mocked(queries.useFilterOptions).mockReturnValue(result(undefined))
    vi.mocked(queries.useMovie).mockReturnValue(result(undefined))
    vi.mocked(queries.useLicensingMemo).mockReturnValue(result(undefined))
    vi.mocked(queries.useMovieLookup).mockReturnValue(result(undefined))
    vi.mocked(queries.useLicensing).mockReturnValue(
      result({
        movie,
        target: { platform: 'Netflix', country: 'Brazil' },
        already_on_target: false,
        title_totals: { streams: 0, viewing_hours: 0 },
        availability_countries: [],
        comparables: [],
        expected_range: {
          status: 'insufficient_evidence',
          p25: null,
          median: null,
          p75: null,
          benchmark: 120,
          eligible_count: 1,
        },
        signal: 'insufficient_evidence',
        platform_fit: [],
        whitespace: [],
      }),
    )
    renderWithProviders(<LicensingTab />, '/decide?title=tt1&platform=Netflix&country=Brazil')
    expect(screen.getByText('Not enough evidence to judge')).toBeInTheDocument()
    expect(screen.getByText(/Fewer than 3 comparable titles streamed there/)).toBeInTheDocument()
  })
})
