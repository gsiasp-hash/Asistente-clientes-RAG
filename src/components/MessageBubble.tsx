import { MarkdownContent } from './MarkdownContent'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  streaming: boolean
}

export function MessageBubble({ role, content, streaming }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-md bg-indigo-600 text-white'
            : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <MarkdownContent content={streaming && content.length > 0 ? `${content}▍` : content} />
        )}
      </div>
    </div>
  )
}
