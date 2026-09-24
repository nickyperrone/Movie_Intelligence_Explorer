import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'

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

const LIVE_SEARCH_DELAY_MS = 250

function GlobalSearch({ urlQuery }: { urlQuery: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(urlQuery)
  const [syncedQuery, setSyncedQuery] = useState(urlQuery)

  // When the URL changes from outside (back button, a link), show its query. Adjusting state
  // during render avoids an extra effect pass.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery)
    setText(urlQuery)
  }

  useEffect(() => {
    // Search as you type with embeddings only; the LLM runs only when the user presses Enter.
    const query = text.trim()
    if (query.length < 2 || query === urlQuery.trim()) return
    const timer = setTimeout(() => {
      setSyncedQuery(query)
      navigate(`/search?q=${encodeURIComponent(query)}&interpret=false`, {
        replace: location.pathname === '/search',
      })
    }, LIVE_SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text, urlQuery, navigate, location.pathname])

  useEffect(() => {
    // "/" focuses the search box unless the user is already typing somewhere.
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if (event.key === '/' && !typing) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    const query = text.trim()
    if (query.length < 2) return
    setSyncedQuery(query)
    navigate(`/search?q=${encodeURIComponent(query)}`)
  }

  return (
    <form role="search" onSubmit={submit} className="relative w-full max-w-2xl">
      <label htmlFor="global-search" className="sr-only">
        Search movies
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-subtle" />
      <input
        id="global-search"
        ref={inputRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="What do you want to watch? Try “movies about artificial intelligence”"
        className="h-12 w-full rounded-full bg-pill pl-11 pr-4 text-sm text-white placeholder:text-subtle outline-none transition-shadow hover:bg-hover focus:ring-2 focus:ring-white"
      />
    </form>
  )
}
