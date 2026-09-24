import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { api, unwrap, type Schemas } from './client'

export type DashboardQuery = {
  start?: string
  end?: string
  countries: string[]
  platforms: string[]
  genres: string[]
  themes: string[]
  distributors: string[]
}

export type SearchQuery = {
  q: string
  interpret: boolean
  genres: string[]
  year_min?: number
  year_max?: number
  countries: string[]
  platforms: string[]
  people: string[]
}

export type LicensingQuery = { title_id: string; platform: string; country: string }

export function useFilterOptions() {
  return useQuery({
    queryKey: ['filters'],
    queryFn: () => unwrap(api.GET('/filters')),
    staleTime: Infinity,
  })
}

export function useSearch(query: SearchQuery | null) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => unwrap(api.GET('/search', { params: { query: { ...query!, limit: 30 } } })),
    enabled: query !== null && query.q.trim().length >= 2,
    // Keeps the previous results on screen while the next keystroke's results load.
    placeholderData: keepPreviousData,
  })
}

export function useSearchSuggestions(text: string) {
  const q = text.trim()
  return useQuery({
    queryKey: ['suggestions', q],
    queryFn: () =>
      unwrap(api.GET('/search', { params: { query: { q, interpret: false, limit: 5 } } })),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
  })
}

export function usePeopleLookup(text: string) {
  const q = text.trim()
  return useQuery({
    queryKey: ['people', q],
    queryFn: () => unwrap(api.GET('/people/lookup', { params: { query: { q, limit: 3 } } })),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
  })
}

export function useMarketOpportunities(titleId: string) {
  return useQuery({
    queryKey: ['markets', titleId],
    queryFn: () =>
      unwrap(api.GET('/decisions/markets', { params: { query: { title_id: titleId } } })),
    enabled: titleId !== '',
  })
}

export function useMovieLookup(text: string) {
  return useQuery({
    queryKey: ['lookup', text],
    queryFn: () => unwrap(api.GET('/movies/lookup', { params: { query: { q: text, limit: 8 } } })),
    enabled: text.trim().length >= 1,
    placeholderData: keepPreviousData,
  })
}

export function useMovie(titleId: string) {
  return useQuery({
    queryKey: ['movie', titleId],
    queryFn: () =>
      unwrap(api.GET('/movies/{title_id}', { params: { path: { title_id: titleId } } })),
  })
}

export function useAvailability(titleId: string) {
  return useQuery({
    queryKey: ['availability', titleId],
    queryFn: () =>
      unwrap(
        api.GET('/movies/{title_id}/availability', { params: { path: { title_id: titleId } } }),
      ),
  })
}

export function usePerformance(titleId: string, countries: string[], platforms: string[]) {
  return useQuery({
    queryKey: ['performance', titleId, countries, platforms],
    queryFn: () =>
      unwrap(
        api.GET('/movies/{title_id}/performance', {
          params: { path: { title_id: titleId }, query: { countries, platforms } },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export function useSimilar(titleId: string) {
  return useQuery({
    queryKey: ['similar', titleId],
    queryFn: () =>
      unwrap(
        api.GET('/movies/{title_id}/similar', {
          params: { path: { title_id: titleId }, query: { limit: 10 } },
        }),
      ),
  })
}

export function useInsight(titleId: string) {
  return useQuery({
    queryKey: ['insight', titleId],
    queryFn: () =>
      unwrap(api.GET('/movies/{title_id}/insight', { params: { path: { title_id: titleId } } })),
  })
}

export function useDashboardSummary(query: DashboardQuery) {
  return useQuery({
    queryKey: ['dashboard', 'summary', query],
    queryFn: () => unwrap(api.GET('/dashboard/summary', { params: { query } })),
    placeholderData: keepPreviousData,
  })
}

export function useDashboardTrend(
  query: DashboardQuery,
  groupBy?: 'platform' | 'country',
  enabled = true,
) {
  return useQuery({
    queryKey: ['dashboard', 'trend', query, groupBy],
    queryFn: () =>
      unwrap(api.GET('/dashboard/trend', { params: { query: { ...query, group_by: groupBy } } })),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useDashboardBreakdown(
  query: DashboardQuery,
  dimension: Schemas['BreakdownDimension'],
) {
  return useQuery({
    queryKey: ['dashboard', 'breakdown', dimension, query],
    queryFn: () =>
      unwrap(api.GET('/dashboard/breakdown', { params: { query: { ...query, dimension } } })),
    placeholderData: keepPreviousData,
  })
}

export function useDashboardMatrix(query: DashboardQuery) {
  return useQuery({
    queryKey: ['dashboard', 'matrix', query],
    queryFn: () => unwrap(api.GET('/dashboard/matrix', { params: { query } })),
    placeholderData: keepPreviousData,
  })
}

export function useDashboardTitles(query: DashboardQuery, sort: Schemas['TitleSort']) {
  const limit = 10
  return useInfiniteQuery({
    queryKey: ['dashboard', 'titles', query, sort],
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/dashboard/titles', {
          params: { query: { ...query, sort, limit, offset: pageParam } },
        }),
      ),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.offset + last.limit < last.total ? last.offset + last.limit : undefined,
  })
}

export function useDashboardChanges(query: DashboardQuery) {
  return useQuery({
    queryKey: ['dashboard', 'changes', query],
    queryFn: () => unwrap(api.GET('/dashboard/changes', { params: { query } })),
    placeholderData: keepPreviousData,
  })
}

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => unwrap(api.GET('/collections')),
    staleTime: Infinity,
  })
}

export function useCollection(collectionId: string) {
  return useQuery({
    queryKey: ['collection', collectionId],
    queryFn: () =>
      unwrap(
        api.GET('/collections/{collection_id}', {
          params: { path: { collection_id: collectionId } },
        }),
      ),
  })
}

export function useLicensing(query: LicensingQuery | null) {
  return useQuery({
    queryKey: ['licensing', query],
    queryFn: () => unwrap(api.GET('/decisions/licensing', { params: { query: query! } })),
    enabled: query !== null,
  })
}

export function useLicensingMemo(query: LicensingQuery | null, enabled: boolean) {
  return useQuery({
    queryKey: ['licensing-memo', query],
    queryFn: () => unwrap(api.GET('/decisions/licensing/memo', { params: { query: query! } })),
    enabled: query !== null && enabled,
  })
}

export function useConceptEvaluation() {
  return useMutation({
    mutationFn: (loglines: string[]) =>
      unwrap(api.POST('/decisions/concepts', { body: { loglines } })),
  })
}

export function useConceptsMemo() {
  return useMutation({
    mutationFn: (loglines: string[]) =>
      unwrap(api.POST('/decisions/concepts/memo', { body: { loglines } })),
  })
}

export function useAssistant() {
  return useMutation({
    mutationFn: (messages: Schemas['ChatMessage'][]) =>
      unwrap(api.POST('/assistant/answer', { body: { messages } })),
  })
}
