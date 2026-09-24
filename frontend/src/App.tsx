import { Route, Routes } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { CollectionPage } from '@/pages/CollectionPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DiscoverPage } from '@/pages/DiscoverPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="discover" element={<DiscoverPage />} />
        <Route path="discover/:collectionId" element={<CollectionPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
