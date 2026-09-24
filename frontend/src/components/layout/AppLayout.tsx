import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex h-dvh gap-2 bg-frame p-2 max-sm:flex-col max-sm:p-0">
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-surface max-sm:rounded-none">
        <TopBar />
        <div id="main-scroll" className="flex-1 overflow-y-auto">
          {/* Keyed by path so every page change replays a short fade; skipped with reduced motion. */}
          <div
            key={pathname}
            className="mx-auto max-w-[1440px] px-6 pb-16 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 max-sm:px-4"
          >
            <Suspense fallback={<div className="h-screen" aria-busy />}>
              <Outlet />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  )
}
