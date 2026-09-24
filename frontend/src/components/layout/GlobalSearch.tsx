import { Search, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import type { Schemas } from '@/api/client'
import { useMovieLookup, usePeopleLookup, useSearchSuggestions } from '@/api/queries'
import { Poster } from '@/components/common/Poster'
import { cn } from '@/lib/cn'

const SUGGESTION_DELAY_MS = 250

type Option =
  | { kind: 'movie'; movie: Schemas['MovieSummary']; detail: string }
  | { kind: 'person'; person: Schemas['Person'] }
  | { kind: 'all'; query: string }

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function GlobalSearch({ urlQuery }: { urlQuery: string }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(urlQuery)
  const [syncedQuery, setSyncedQuery] = useState(urlQuery)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  // When the URL query changes from outside (back button, a link), show it. Adjusting state
  // during render avoids an extra effect pass.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery)
    setText(urlQuery)
  }

  const debounced = useDebounced(text.trim(), SUGGESTION_DELAY_MS)
  const titles = useMovieLookup(debounced.length >= 2 ? debounced : '')
  const meaning = useSearchSuggestions(debounced)
  const people = usePeopleLookup(debounced)

  const titleMatches = debounced.length >= 2 ? (titles.data?.results ?? []).slice(0, 3) : []
  const titleIds = new Set(titleMatches.map((movie) => movie.title_id))
  const meaningMatches =
    debounced.length >= 2
      ? (meaning.data?.results ?? []).filter((r) => !titleIds.has(r.movie.title_id)).slice(0, 5)
      : []
  const peopleMatches = debounced.length >= 2 ? (people.data?.results ?? []) : []
  const options: Option[] = [
    ...peopleMatches.map((person) => ({ kind: 'person' as const, person })),
    ...titleMatches.map((movie) => ({
      kind: 'movie' as const,
      movie,
      detail: `${movie.year} · title match`,
    })),
    ...meaningMatches.map((result) => ({
      kind: 'movie' as const,
      movie: result.movie,
      detail: `${result.movie.year} · ${Math.round(result.score * 100)}% match`,
    })),
    ...(debounced.length >= 2 ? [{ kind: 'all' as const, query: debounced }] : []),
  ]
  const showDropdown = open && options.length > 0

  useEffect(() => {
    // "/" focuses the search box unless the user is already typing somewhere.
    function onKeyDown(event: globalThis.KeyboardEvent) {
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

  function choose(option: Option) {
    setOpen(false)
    setActive(-1)
    inputRef.current?.blur()
    if (option.kind === 'movie') navigate(`/movies/${option.movie.title_id}`)
    else if (option.kind === 'person') {
      const name = encodeURIComponent(option.person.name)
      navigate(`/search?q=${name}&people=${name}&interpret=false`)
    } else navigate(`/search?q=${encodeURIComponent(option.query)}`)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const query = text.trim()
    if (active >= 0 && options[active]) return choose(options[active])
    if (query.length >= 2) choose({ kind: 'all', query })
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      // Positions run from -1 (nothing highlighted, focus stays on the text) to the last option.
      const step = event.key === 'ArrowDown' ? 1 : -1
      const positions = options.length + 1
      setActive((current) => ((current + 1 + step + positions) % positions) - 1)
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  return (
    <form role="search" onSubmit={submit} className="relative w-full max-w-2xl">
      <label htmlFor="global-search" className="sr-only">
        Search movies
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-6 size-5 -translate-y-1/2 text-subtle" />
      <input
        id="global-search"
        ref={inputRef}
        value={text}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="search-suggestions"
        aria-activedescendant={active >= 0 ? `suggestion-${active}` : undefined}
        autoComplete="off"
        onChange={(event) => {
          setText(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder="Find a movie and its performance, e.g. “heist movies” or “Zootopia”"
        className={cn(
          'h-12 w-full bg-pill pl-11 pr-4 text-sm text-white placeholder:text-subtle outline-none transition-shadow hover:bg-hover focus:ring-2 focus:ring-white',
          showDropdown ? 'rounded-t-3xl' : 'rounded-full',
        )}
      />
      {showDropdown && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute inset-x-0 top-12 z-30 max-h-[70vh] overflow-y-auto rounded-b-3xl bg-hover p-2 shadow-2xl shadow-black/60"
        >
          {options.map((option, index) => {
            const firstTitle = peopleMatches.length
            const firstMeaning = peopleMatches.length + titleMatches.length
            const heading =
              index === 0 && peopleMatches.length > 0
                ? 'People'
                : index === firstTitle && titleMatches.length > 0
                  ? 'Titles'
                  : index === firstMeaning && meaningMatches.length > 0
                    ? 'Matches by meaning'
                    : null
            return (
              <li
                key={
                  option.kind === 'movie'
                    ? option.movie.title_id
                    : option.kind === 'person'
                      ? `person-${option.person.name}`
                      : 'all'
                }
              >
                {heading && (
                  <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-subtle">
                    {heading}
                  </p>
                )}
                <button
                  id={`suggestion-${index}`}
                  type="button"
                  role="option"
                  aria-selected={active === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm',
                    active === index && 'bg-white/10',
                  )}
                >
                  {option.kind === 'movie' ? (
                    <>
                      <Poster
                        src={option.movie.image_url}
                        title={option.movie.title}
                        className="h-12 w-8 shrink-0 rounded-sm text-[9px]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{option.movie.title}</span>
                        <span className="text-xs text-subtle">{option.detail}</span>
                      </span>
                    </>
                  ) : option.kind === 'person' ? (
                    <>
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-pill">
                        <UserRound className="size-5 text-subtle" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{option.person.name}</span>
                        <span className="text-xs text-subtle">
                          {option.person.roles
                            .map((role) => (role === 'cast' ? 'actor' : role))
                            .join(' and ')}{' '}
                          · {option.person.movie_count}{' '}
                          {option.person.movie_count === 1 ? 'movie' : 'movies'}
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="grid h-12 w-8 shrink-0 place-items-center rounded-sm bg-pink text-black">
                        <Search className="size-4" />
                      </span>
                      <span>
                        See all results for <span className="font-bold">“{option.query}”</span>
                        <span className="block text-xs text-subtle">
                          Press Enter to search with AI filters
                        </span>
                      </span>
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </form>
  )
}
