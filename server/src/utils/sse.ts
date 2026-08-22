import type { Response } from 'express'

export type SseEvent =
  | { event: 'meta'; data: { conversationId: string } }
  | { event: 'delta'; data: { text: string } }
  | { event: 'done'; data: { conversationId: string } }
  | { event: 'error'; data: { message: string } }

export function initSse(res: Response): void {
  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()
}

export function sendSse(res: Response, event: SseEvent): void {
  res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`)
}
