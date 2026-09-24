import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { GlobalSearch } from './GlobalSearch'

export function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const urlQuery = location.pathname === '/search' ? (params.get('q') ?? '') : ''
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 bg-surface/95 px-6 py-3 backdrop-blur max-sm:px-4">
      <div className="flex gap-2 max-sm:hidden">
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate(-1)}
          className="grid size-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Go forward"
          onClick={() => navigate(1)}
          className="grid size-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <GlobalSearch urlQuery={urlQuery} />
    </header>
  )
}
