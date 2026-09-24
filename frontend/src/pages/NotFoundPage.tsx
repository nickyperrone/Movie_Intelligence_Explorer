import { Link } from 'react-router'

export function NotFoundPage({ message = 'This page does not exist.' }: { message?: string }) {
  return (
    <div className="grid place-items-center py-24 text-center">
      <h1 className="text-3xl font-black tracking-tight">Not found</h1>
      <p className="mt-2 text-subtle">{message}</p>
      <Link
        to="/"
        className="mt-6 rounded-full bg-white px-5 py-2 text-sm font-bold text-black hover:scale-105"
      >
        Go to the dashboard
      </Link>
    </div>
  )
}
