import { Link } from 'react-router'
import type { Schemas } from '@/api/client'
import { useFilterOptions, useSearch, type SearchQuery } from '@/api/queries'
import { MovieCard, MovieCardSkeleton } from '@/components/common/MovieCard'
import { EmptyState, ErrorState } from '@/components/common/States'
import { SearchFilterBar } from '@/components/search/SearchFilterBar'
import { useUrlState } from '@/lib/url-state'

const EXAMPLE_QUERIES = [
  'dark psychological thrillers about obsession',
  'family movies about overcoming loss',
  'animated adventures',
  'movies about artificial intelligence',
]

const INTERPRETATION_NOTES: Partial<Record<Schemas['LlmStatus'], string>> = {
  disabled: 'Filters are not inferred from the text because no language model is configured.',
  failed: 'Filters could not be inferred from the text this time; results use the text as written.',
}

function ExampleLinks() {
  return (
    <>
      {EXAMPLE_QUERIES.map((query) => (
        <Link
          key={query}
          to={`/search?q=${encodeURIComponent(query)}`}
          className="rounded-full bg-pill px-3.5 py-1.5 text-sm hover:bg-hover"
        >
          {query}
        </Link>
      ))}
    </>
  )
}

export function SearchPage() {
  const { get, getList, update } = useUrlState()
  const options = useFilterOptions()
  const q = get('q') ?? ''
  const yearMin = get('year_min')
  const yearMax = get('year_max')
  const query: SearchQuery | null = q
    ? {
        q,
        interpret: get('interpret') !== 'false',
        genres: getList('genres'),
        year_min: yearMin ? Number(yearMin) : undefined,
        year_max: yearMax ? Number(yearMax) : undefined,
        countries: getList('countries'),
        platforms: getList('platforms'),
        people: getList('people'),
      }
    : null
  const search = useSearch(query)

  if (!query) {
    return (
      <div className="pt-8">
        <h1 className="text-4xl font-black tracking-tight">Search by idea, not by title</h1>
        <p className="mt-2 max-w-2xl text-subtle">
          Describe a theme, a mood or a plot in English or Spanish. Results are ranked by meaning,
          using embeddings of each movie’s genres and plot.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <ExampleLinks />
        </div>
      </div>
    )
  }

  function applyFilters(filters: Schemas['SearchFilters'], semanticQuery: string) {
    // Editing filters re-runs the search on the interpreted text without calling the LLM again.
    update({
      q: semanticQuery,
      interpret: false,
      genres: filters.genres,
      year_min: filters.year_min ?? undefined,
      year_max: filters.year_max ?? undefined,
      countries: filters.countries,
      platforms: filters.platforms,
      people: filters.people,
    })
  }

  const data = search.data
  const hasFilters =
    data &&
    (data.applied_filters.genres.length ||
      data.applied_filters.countries.length ||
      data.applied_filters.platforms.length ||
      data.applied_filters.people.length ||
      data.applied_filters.year_min !== null ||
      data.applied_filters.year_max !== null)

  return (
    <div className="space-y-5 pt-4">
      <header>
        <p className="text-sm font-bold text-subtle">Search results for</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">“{q}”</h1>
        {data && data.semantic_query !== data.query && (
          <p className="mt-2 text-sm text-subtle">
            Searching for <span className="font-bold text-white">“{data.semantic_query}”</span>
            {hasFilters ? ' with the filters below' : ''}
          </p>
        )}
        {data && INTERPRETATION_NOTES[data.interpretation.status] && (
          <p className="mt-2 text-sm text-subtle">
            {INTERPRETATION_NOTES[data.interpretation.status]}
          </p>
        )}
      </header>

      {data && options.data && (
        <SearchFilterBar
          filters={data.applied_filters}
          options={options.data}
          onChange={(filters) => applyFilters(filters, data.semantic_query)}
        />
      )}

      {search.isError ? (
        <ErrorState error={search.error} onRetry={() => search.refetch()} />
      ) : !data ? (
        <div className="-mx-3 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
          {Array.from({ length: 12 }, (_, index) => (
            <MovieCardSkeleton key={index} />
          ))}
        </div>
      ) : data.results.length === 0 ? (
        <EmptyState message="No movies match this search.">
          {hasFilters ? (
            <button
              type="button"
              onClick={() =>
                applyFilters(
                  {
                    genres: [],
                    year_min: null,
                    year_max: null,
                    countries: [],
                    platforms: [],
                    people: [],
                  },
                  data.semantic_query,
                )
              }
              className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-black"
            >
              Clear filters
            </button>
          ) : (
            <ExampleLinks />
          )}
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-subtle">
            {data.results.length} movies, most similar first. Match is the cosine similarity between
            the query and the movie.
          </p>
          <div className="-mx-3 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
            {data.results.map((result) => (
              <MovieCard
                key={result.movie.title_id}
                movie={result.movie}
                caption={`${result.movie.year} · ${result.movie.genres.slice(0, 2).join(', ')} · ${Math.round(result.score * 100)}% match`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
