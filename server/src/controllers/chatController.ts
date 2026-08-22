import type { Request, Response } from 'express'
import {
  initConversation,
  loadHistory,
  loadFullConversation,
  persistUserMessage,
  persistAssistantMessage,
  retrieveContext,
  buildPrompt,
  streamAnswer,
} from '../services/chatService.js'
import { isAdmin } from '../middleware/session.js'
import { checkAndIncrement } from '../utils/rateLimiter.js'
import { env } from '../config/env.js'
import { initSse, sendSse } from '../utils/sse.js'
import { HttpError } from '../utils/errors.js'

const MAX_MESSAGE_LENGTH = 2000

export async function chat(req: Request, res: Response): Promise<void> {
  const rawMessage = req.body?.message
  const message = typeof rawMessage === 'string' ? rawMessage.trim() : ''
  const conversationIdInput =
    typeof req.body?.conversationId === 'string' && req.body.conversationId.trim() !== ''
      ? req.body.conversationId.trim()
      : undefined
  const sessionId = req.sessionId!

  if (!message) throw new HttpError(400, 'El campo "message" es obligatorio.')
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new HttpError(400, `El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres.`)
  }
  if (!isAdmin(req)) {
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

  initSse(res)
  sendSse(res, { event: 'meta', data: { conversationId } })

  const abort = new AbortController()
  let closed = false
  req.on('close', () => {
    closed = true
    abort.abort()
  })

  let answer = ''
  try {
    for await (const delta of streamAnswer(prompt, abort.signal)) {
      if (closed) {
        res.end()
        return
      }
      answer += delta
      sendSse(res, { event: 'delta', data: { text: delta } })
    }

    if (closed) {
      res.end()
      return
    }

    if (!answer.trim()) {
      sendSse(res, { event: 'error', data: { message: 'El modelo no generó respuesta. Intenta de nuevo.' } })
      res.end()
      return
    }

    await persistAssistantMessage(
      conversationId,
      answer.trim(),
      context.map((c) => ({ fileName: c.fileName, similarity: c.similarity }))
    )
    sendSse(res, { event: 'done', data: { conversationId } })
    res.end()
  } catch (err) {
    console.error('[chat]', err)
    if (!closed) {
      sendSse(res, { event: 'error', data: { message: 'No se pudo generar la respuesta. Intenta de nuevo.' } })
    }
    res.end()
  }
}

export async function getConversationMessages(req: Request, res: Response): Promise<void> {
  const param = req.params.id
  const conversationId = Array.isArray(param) ? param[0] : param
  if (!conversationId) throw new HttpError(400, 'Falta el id de la conversación en la ruta.')

  await initConversation(conversationId, req.sessionId!)
  const messages = await loadFullConversation(conversationId)

  res.json({ conversationId, messages })
}
