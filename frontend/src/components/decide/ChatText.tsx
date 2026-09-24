import type { ReactNode } from 'react'

// Renders the assistant's answer: paragraphs, "- " bullets and **bold**. Nothing else is
// interpreted, and no HTML from the model is ever injected.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-bold text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  )
}

export function ChatText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`list-${blocks.length}`} className="space-y-1 pl-1">
          {bullets.map((item, index) => (
            <li key={index} className="flex gap-2">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-pink" aria-hidden />
              <span>{inline(item)}</span>
            </li>
          ))}
        </ul>,
      )
      bullets = []
    }
  }
  for (const line of text.split('\n').map((l) => l.trim())) {
    if (line.startsWith('- ') || line.startsWith('• ')) {
      bullets.push(line.slice(2))
    } else {
      flush()
      if (line) blocks.push(<p key={`p-${blocks.length}`}>{inline(line)}</p>)
    }
  }
  flush()
  return <div className="space-y-3 leading-relaxed">{blocks}</div>
}
