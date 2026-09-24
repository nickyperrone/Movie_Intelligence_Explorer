import { Search } from 'lucide-react'
import { useState } from 'react'
import type { Schemas } from '@/api/client'
import { useMovieLookup } from '@/api/queries'
import { Poster } from '@/components/common/Poster'

type TitlePickerProps = {
  selected: Schemas['MovieSummary'] | undefined
  onSelect: (movie: Schemas['MovieSummary']) => void
}

export function TitlePicker({ selected, onSelect }: TitlePickerProps) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const lookup = useMovieLookup(text)
  const results = lookup.data?.results ?? []

  return (
    <div className="relative w-72 max-w-full">
      <label htmlFor="title-picker" className="sr-only">
        Title
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <input
          id="title-picker"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="title-picker-list"
          autoComplete="off"
          value={open ? text : (selected?.title ?? text)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            setText(event.target.value)
            setOpen(true)
          }}
          placeholder="Search a movie by title"
          className="h-11 w-full rounded-full bg-pill pl-9 pr-4 text-base font-medium outline-none placeholder:text-subtle focus:ring-2 focus:ring-white"
        />
      </div>
      {open && results.length > 0 && (
        <ul
          id="title-picker-list"
          role="listbox"
          className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-lg bg-hover p-1 shadow-2xl"
        >
          {results.map((movie) => (
            <li key={movie.title_id}>
              <button
                type="button"
                role="option"
                aria-selected={movie.title_id === selected?.title_id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(movie)
                  setText('')
                  setOpen(false)
                }}
                className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/10"
              >
                <Poster
                  src={movie.image_url}
                  title={movie.title}
                  className="h-10 w-7 shrink-0 rounded-sm text-[9px]"
                />
                <span className="min-w-0">
                  <span className="block truncate">{movie.title}</span>
                  <span className="text-xs text-subtle">
                    {movie.year} · {movie.primary_genre ?? '—'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
