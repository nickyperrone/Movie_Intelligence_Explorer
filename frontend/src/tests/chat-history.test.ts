import { beforeEach, describe, expect, it } from 'vitest'
import type { Schemas } from '@/api/client'
import { loadHistory, saveHistory, type Turn } from '@/components/decide/chatHistory'

function reply(rows: number): Schemas['AssistantReply'] {
  return {
    status: 'answered',
    answer: 'The catalog has 1,590 movies.',
    evidence: [
      {
        tool: 'run_sql',
        purpose: 'Count movies',
        sql: 'SELECT 1',
        columns: ['n'],
        rows: Array.from({ length: rows }, (_, index) => [index]),
        row_count: rows,
        error: null,
      },
    ],
  }
}

describe('chat history', () => {
  beforeEach(() => localStorage.clear())

  it('restores what was saved, without the reveal flag', () => {
    saveHistory([
      { role: 'user', content: 'How many movies?' },
      { role: 'assistant', reply: reply(1), fresh: true },
    ])
    const restored = loadHistory()
    expect(restored).toHaveLength(2)
    expect(restored[1]).toEqual({ role: 'assistant', reply: reply(1) })
  })

  it('keeps the last 40 messages and 20 rows per table', () => {
    const turns: Turn[] = Array.from({ length: 50 }, (_, index) => ({
      role: 'user',
      content: `question ${index}`,
    }))
    saveHistory([...turns, { role: 'assistant', reply: reply(200) }])
    const restored = loadHistory()
    expect(restored).toHaveLength(40)
    const last = restored.at(-1)
    expect(last?.role === 'assistant' && last.reply.evidence[0].rows).toHaveLength(20)
  })

  it('ignores broken storage and clears it for an empty chat', () => {
    localStorage.setItem('ask-history', '{not json')
    expect(loadHistory()).toEqual([])
    saveHistory([])
    expect(localStorage.getItem('ask-history')).toBeNull()
  })
})
