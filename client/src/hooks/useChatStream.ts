import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  clearStoredConversationId,
  fetchHistory,
  getStoredConversationId,
  storeConversationId,
  streamChat,
} from '../lib/api'
import type { ChatMessage } from '../types'

export function useChatStream() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(() => getStoredConversationId())
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const conversationRef = useRef<string | null>(conversationId)

  useEffect(() => {
    const stored = getStoredConversationId()
    if (!stored) return
    let cancelled = false
    ;(async () => {
      try {
        const history = await fetchHistory(stored)
        if (cancelled) return
        setMessages(history.map(({ role, content }) => ({ role, content })))
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          clearStoredConversationId()
          setConversationId(null)
          conversationRef.current = null
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isStreaming) return

      setError(null)
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }, { role: 'assistant', content: '' }])

      const controller = new AbortController()
      abortRef.current = controller
      setIsStreaming(true)

      streamChat({
        conversationId: conversationRef.current,
        message: trimmed,
        signal: controller.signal,
        onMeta: (id) => {
          conversationRef.current = id
          setConversationId(id)
          storeConversationId(id)
        },
        onDelta: (chunk) => {
          setMessages((prev) => {
            if (prev.length === 0) return prev
            const last = prev[prev.length - 1]
            if (last?.role !== 'assistant') return prev
            const updated = { ...last, content: last.content + chunk }
            return [...prev.slice(0, -1), updated]
          })
        },
        onError: (message) => setError(message),
      })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return
          setError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor.')
          setMessages((prev) =>
            prev.length > 0 && prev[prev.length - 1]?.content === '' ? prev.slice(0, -1) : prev
          )
        })
        .finally(() => {
          setIsStreaming(false)
          abortRef.current = null
        })
    },
    [isStreaming]
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const newChat = useCallback(() => {
    abortRef.current?.abort()
    clearStoredConversationId()
    setConversationId(null)
    conversationRef.current = null
    setMessages([])
    setError(null)
  }, [])

  return { messages, isStreaming, error, send, stop, newChat }
}
