import {
  initConversation,
  loadHistory,
  persistUserMessage,
  persistAssistantMessage,
  retrieveContext,
  buildPrompt,
  streamAnswer,
  type LlmMessage,
  type RetrievedChunk,
} from '@/server/chatService'
import { requireSession, isAdmin } from '@/server/session'
import { checkAndIncrement } from '@/server/rateLimiter'
import { env } from '@/server/env'
import { HttpError, jsonError } from '@/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_MESSAGE_LENGTH = 2000

type SseEvent =
  | { event: 'meta'; data: { conversationId: string } }
  | { event: 'delta'; data: { text: string } }
  | { event: 'done'; data: { conversationId: string } }
  | { event: 'error'; data: { message: string } }

function sseFrame(event: SseEvent): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`
  )
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}

interface PreparedChat {
  sessionId: string
  conversationId: string
  context: RetrievedChunk[]
  prompt: LlmMessage[]
}

async function prepare(request: Request): Promise<PreparedChat> {
  const sessionId = await requireSession(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new HttpError(400, 'El cuerpo de la petición debe ser JSON.')
  }
  const payload = (body ?? {}) as { message?: unknown; conversationId?: unknown }

  const rawMessage = payload.message
  const message = typeof rawMessage === 'string' ? rawMessage.trim() : ''
  const conversationIdInput =
    typeof payload.conversationId === 'string' && payload.conversationId.trim() !== ''
      ? payload.conversationId.trim()
      : undefined

  if (!message) throw new HttpError(400, 'El campo "message" es obligatorio.')
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new HttpError(400, `El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres.`)
  }
  if (!isAdmin(request)) {
    checkAndIncrement(
      `msg:${sessionId}`,
      env.sessionMessageLimit,
      `Alcanzaste el límite de ${env.sessionMessageLimit} mensajes por día. La demostración se reinicia mañana.`
    )
  }

  const conversationId = await initConversation(conversationIdInput, sessionId)
  const history = await loadHistory(conversationId)
  await persistUserMessage(conversationId, message)

  const context = await retrieveContext(message, sessionId)
  const prompt = buildPrompt(history, context, message)

  return { sessionId, conversationId, context, prompt }
}

export async function POST(request: Request): Promise<Response> {
  let chat: PreparedChat
  try {
    chat = await prepare(request)
  } catch (error) {
    return jsonError(error)
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sseFrame({ event: 'meta', data: { conversationId: chat.conversationId } }))

      const abort = new AbortController()
      request.signal.addEventListener('abort', () => abort.abort(), { once: true })

      let answer = ''
      try {
        for await (const delta of streamAnswer(chat.prompt, abort.signal)) {
          if (request.signal.aborted) break
          answer += delta
          controller.enqueue(sseFrame({ event: 'delta', data: { text: delta } }))
        }

        if (!request.signal.aborted) {
          if (!answer.trim()) {
            controller.enqueue(
              sseFrame({ event: 'error', data: { message: 'El modelo no generó respuesta. Intenta de nuevo.' } })
            )
          } else {
            await persistAssistantMessage(
              chat.conversationId,
              answer.trim(),
              chat.context.map((c) => ({ fileName: c.fileName, similarity: c.similarity }))
            )
            controller.enqueue(
              sseFrame({ event: 'done', data: { conversationId: chat.conversationId } })
            )
          }
        }
      } catch (err) {
        console.error('[chat]', err)
        if (!request.signal.aborted) {
          controller.enqueue(
            sseFrame({ event: 'error', data: { message: 'No se pudo generar la respuesta. Intenta de nuevo.' } })
          )
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
