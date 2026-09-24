import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

// Shareable page state lives in the URL (docs/07-frontend.md, "Routes and URL state").

export function useUrlState() {
  const [params, setParams] = useSearchParams()

  const get = useCallback((key: string) => params.get(key) ?? undefined, [params])
  const getList = useCallback((key: string) => params.getAll(key), [params])

  const update = useCallback(
    (changes: Record<string, string | string[] | number | boolean | undefined | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(changes)) {
            next.delete(key)
            if (value === undefined || value === null || value === '') continue
            for (const item of Array.isArray(value) ? value : [value])
              next.append(key, String(item))
          }
          return next
        },
        { replace: false },
      )
    },
    [setParams],
  )

  return { params, get, getList, update }
}

export function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}
