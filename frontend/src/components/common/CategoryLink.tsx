import { Link } from 'react-router'
import { cn } from '@/lib/cn'
import { GenreLabel } from './Brand'

// A genre or theme anywhere in the app opens the dashboard filtered by it (docs/07-frontend.md).
const LINK = 'rounded-sm underline-offset-2 transition-colors hover:text-pink hover:underline'

export function GenreLink({
  genre,
  className,
  icon = true,
}: {
  genre: string
  className?: string
  icon?: boolean
}) {
  return (
    <Link
      to={`/?genres=${encodeURIComponent(genre)}`}
      className={cn(LINK, className)}
      title={`See ${genre} charts`}
    >
      {icon ? <GenreLabel genre={genre} /> : genre}
    </Link>
  )
}

export function ThemeLink({
  themeId,
  name,
  className,
}: {
  themeId: string
  name: string
  className?: string
}) {
  return (
    <Link
      to={`/?themes=${encodeURIComponent(themeId)}`}
      className={cn(LINK, className)}
      title={`See ${name} charts`}
    >
      {name}
    </Link>
  )
}
