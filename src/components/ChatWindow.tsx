import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { MessageBubble } from './MessageBubble'
import type { ChatMessage } from '../types'

interface ChatWindowProps {
  messages: ChatMessage[]
  isStreaming: boolean
  error: string | null
  onSend: (text: string) => void
  onStop: () => void
  onNewChat: () => void
}

const EXAMPLE_QUESTIONS = [
  'Resume los documentos disponibles',
  '¿Qué información puedes encontrarme?',
]

export function ChatWindow({ messages, isStreaming, error, onSend, onStop, onNewChat }: ChatWindowProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  useEffect(() => {
    if (stickToBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
    }
  }, [messages])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  function submit() {
    const text = input.trim()
    if (!text || isStreaming) return
    onSend(text)
    setInput('')
    stickToBottomRef.current = true
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const empty = messages.length === 0

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-700">Probar asistente</h2>
        <button
          type="button"
          onClick={onNewChat}
          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          Nuevo chat
        </button>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 space-y-3 overflow-y-auto p-4">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-sm text-sm text-slate-500">
              Hazle una pregunta al asistente sobre los documentos indexados. Responde únicamente con lo que
              encuentre en ellos.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => onSend(question)}
                  className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, i) => (
            <MessageBubble
              key={i}
              role={message.role}
              content={message.content}
              streaming={isStreaming && i === messages.length - 1 && message.role === 'assistant'}
            />
          ))
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Escribe tu pregunta… (Enter para enviar)"
            disabled={isStreaming}
            className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-900"
            >
              Detener
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Enviar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
