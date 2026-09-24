import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  return (
    <div className="flex h-dvh gap-2 bg-frame p-2 max-sm:flex-col max-sm:p-0">
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-surface max-sm:rounded-none">
        <TopBar />
        <div id="main-scroll" className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1440px] px-6 pb-16 max-sm:px-4">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
