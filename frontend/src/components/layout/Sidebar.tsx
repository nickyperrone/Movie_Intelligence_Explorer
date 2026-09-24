import { Clapperboard, Compass, LayoutDashboard, Scale, Search } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/cn'

const NAVIGATION = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/discover', label: 'Discover', icon: Compass, end: false },
  { to: '/search', label: 'Search', icon: Search, end: false },
  { to: '/decide', label: 'Decision Studio', icon: Scale, end: false },
]

export function Sidebar() {
  return (
    <nav
      aria-label="Main"
      className="flex w-60 shrink-0 flex-col rounded-lg bg-surface p-3 max-lg:w-16 max-sm:order-last max-sm:w-full max-sm:flex-row max-sm:rounded-none max-sm:border-t max-sm:p-1"
    >
      <NavLink
        to="/"
        className="mb-4 flex items-center gap-2 px-3 py-2 max-lg:justify-center max-sm:hidden"
      >
        <Clapperboard className="size-7 shrink-0 text-pink" aria-hidden />
        <span className="font-bold tracking-tight max-lg:hidden">Movie Intelligence</span>
      </NavLink>
      <ul className="flex flex-col gap-1 max-sm:w-full max-sm:flex-row max-sm:justify-around">
        {NAVIGATION.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-4 rounded-md px-3 py-2.5 text-sm font-bold transition-colors duration-150 max-lg:justify-center max-sm:flex-col max-sm:gap-1 max-sm:text-[11px]',
                  isActive ? 'text-white' : 'text-subtle hover:text-white',
                )
              }
            >
              <Icon className="size-6 shrink-0" aria-hidden />
              <span className="max-lg:sr-only max-sm:not-sr-only">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <p className="mt-auto px-3 text-xs text-subtle max-lg:hidden">
        Built by{' '}
        <a
          href="https://www.linkedin.com/in/perronenicole/"
          target="_blank"
          rel="noreferrer"
          className="font-bold text-white underline-offset-2 hover:text-pink hover:underline"
        >
          Nicole Perrone
        </a>
      </p>
    </nav>
  )
}
