import type { Schemas } from '@/api/client'
import { compact } from '@/lib/format'

// Platform x country grid; the green intensity is scaled to the largest cell in the table.
export function MatrixGrid({ matrix }: { matrix: Schemas['DashboardMatrix'] }) {
  const cells = new Map(matrix.cells.map((cell) => [`${cell.platform}|${cell.country}`, cell]))
  const max = Math.max(...matrix.cells.map((cell) => cell.streams_per_title ?? 0), 0)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-separate border-spacing-1 text-sm">
        <caption className="sr-only">Streams per title by platform and country</caption>
        <thead>
          <tr>
            <th scope="col" className="text-left font-normal text-subtle">
              Platform
            </th>
            {matrix.countries.map((country) => (
              <th key={country} scope="col" className="px-2 text-center font-normal text-subtle">
                {country}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.platforms.map((platform) => (
            <tr key={platform}>
              <th scope="row" className="pr-3 text-left font-medium">
                {platform}
              </th>
              {matrix.countries.map((country) => {
                const cell = cells.get(`${platform}|${country}`)
                const value = cell?.streams_per_title ?? null
                const intensity = value && max ? value / max : 0
                return (
                  <td
                    key={country}
                    className="h-12 rounded-md text-center tabular"
                    style={{ background: `rgb(30 215 96 / ${0.08 + intensity * 0.72})` }}
                    title={
                      cell
                        ? `${cell.titles} titles, ${compact(cell.streams)} streams`
                        : 'No consumption'
                    }
                  >
                    <span className={intensity > 0.55 ? 'font-bold text-black' : 'text-white'}>
                      {compact(value)}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
