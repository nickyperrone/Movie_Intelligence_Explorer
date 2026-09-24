import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { ApiError } from '@/api/client'
import App from './App'
import './index.css'

const RELOAD_MARKER = 'reloaded-for-new-build'
const RELOAD_WINDOW_MS = 30_000

// After a deploy, a tab that loaded the previous build asks for page files that no longer exist
// (docs/08-deployment.md). One reload picks up the new build; the marker stops a reload loop when
// the server is really down.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_MARKER) ?? 0)
    if (Date.now() - last < RELOAD_WINDOW_MS) return
    sessionStorage.setItem(RELOAD_MARKER, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      // 4xx responses will not change on retry.
      retry: (failures, error) =>
        !(error instanceof ApiError && error.status < 500) && failures < 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
