import { lazy } from 'react'
import { Route, Routes } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Each page is its own bundle, so the first load only downloads the page being opened.
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const DiscoverPage = lazy(() =>
  import('@/pages/DiscoverPage').then((m) => ({ default: m.DiscoverPage })),
)
const CollectionPage = lazy(() =>
  import('@/pages/CollectionPage').then((m) => ({ default: m.CollectionPage })),
)
const SearchPage = lazy(() => import('@/pages/SearchPage').then((m) => ({ default: m.SearchPage })))
const MoviePage = lazy(() => import('@/pages/MoviePage').then((m) => ({ default: m.MoviePage })))
const DecisionStudioPage = lazy(() =>
  import('@/pages/DecisionStudioPage').then((m) => ({ default: m.DecisionStudioPage })),
)

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="discover" element={<DiscoverPage />} />
        <Route path="discover/:collectionId" element={<CollectionPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="movies/:titleId" element={<MoviePage />} />
        <Route path="decide" element={<DecisionStudioPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
