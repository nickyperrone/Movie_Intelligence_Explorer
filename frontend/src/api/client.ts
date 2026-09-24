import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

export type Schemas = components['schemas']

export const api = createClient<paths>({ baseUrl: '/api/v1' })

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

type FetchResult<T> = { data?: T; error?: unknown; response: Response }

// Turns an openapi-fetch result into data or a thrown ApiError built from the error envelope.
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<T> {
  const { data, error, response } = await request
  if (data !== undefined) return data
  const envelope = (error as Schemas['Error'] | undefined)?.error
  throw new ApiError(
    response.status,
    envelope?.code ?? 'internal_error',
    envelope?.message ?? `Request failed with status ${response.status}`,
  )
}
