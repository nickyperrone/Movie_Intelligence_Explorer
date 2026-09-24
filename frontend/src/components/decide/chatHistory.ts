import type { Schemas } from '@/api/client'

export type AssistantTurn =
  | { role: 'assistant'; reply: Schemas['AssistantReply']; fresh?: boolean }
  | { role: 'error'; message: string; question: string }
export type Turn = { role: 'user'; content: string } | AssistantTurn

const STORAGE_KEY = 'ask-history'
const MAX_TURNS = 40
// The chat shows at most 20 rows per evidence table, so older rows are not worth the space.
const MAX_ROWS = 20

function isTurn(value: unknown): value is Turn {
  if (typeof value !== 'object' || value === null) return false
  const role = (value as { role?: unknown }).role
  return role === 'user' || role === 'assistant' || role === 'error'
}

// Storage can be missing, blocked or full (private windows, strict settings): the chat then works
// without saving.
export function loadHistory(): Turn[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isTurn) : []
  } catch {
    return []
  }
}

export function saveHistory(turns: Turn[]) {
  const kept = turns.slice(-MAX_TURNS).map((turn) =>
    turn.role === 'assistant'
      ? {
          role: turn.role,
          reply: {
            ...turn.reply,
            evidence: turn.reply.evidence.map((item) => ({
              ...item,
              rows: item.rows.slice(0, MAX_ROWS),
            })),
          },
        }
      : turn,
  )
  try {
    if (kept.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(kept))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Not saved; the conversation stays on screen.
  }
}

const QUESTIONS_KEY = 'ask-questions-left'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// The last count the server reported, kept for the rest of the same UTC day.
export function loadQuestionsLeft(): number | null {
  try {
    const saved = JSON.parse(localStorage.getItem(QUESTIONS_KEY) ?? 'null') as {
      day?: string
      left?: number
    } | null
    return saved?.day === today() && typeof saved.left === 'number' ? saved.left : null
  } catch {
    return null
  }
}

export function saveQuestionsLeft(left: number) {
  try {
    localStorage.setItem(QUESTIONS_KEY, JSON.stringify({ day: today(), left }))
  } catch {
    // Not saved; the count comes back with the next reply.
  }
}
