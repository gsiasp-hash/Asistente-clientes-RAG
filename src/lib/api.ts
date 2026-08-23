import { parseSse } from './sse'
import type { ConflictInfo, DocumentsByScope, HistoryMessage, UploadResult } from '../types'


const SESSION_KEY = 'rag_session_token'
const CONVERSATION_KEY = 'rag_conversation_id'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class UploadConflictError extends ApiError {
  readonly conflict: ConflictInfo

  constructor(conflict: ConflictInfo) {
    super(409, conflict.message)
    this.conflict = conflict
  }
}

let memoryToken: string | null = null

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readItem(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeItem(key: string, value: string): void {
  try {
    storage()?.setItem(key, value)
  } catch {}
}

function randomToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return token
}

export function getSessionToken(): string {
  const stored = readItem(SESSION_KEY)
  if (stored && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) return stored

  const token = memoryToken ?? randomToken()
  memoryToken = token
  writeItem(SESSION_KEY, token)
  return token
}

export function getStoredConversationId(): string | null {
  return readItem(CONVERSATION_KEY)
}

export function storeConversationId(id: string): void {
  writeItem(CONVERSATION_KEY, id)
}

export function clearStoredConversationId(): void {
  try {
    storage()?.removeItem(CONVERSATION_KEY)
  } catch {}
}

function authHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = { 'X-Session-Token': getSessionToken() }
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

async function fail(res: Response): Promise<never> {
  let message = `Error del servidor (${res.status})`
  try {
    const body = await res.json()
    if (typeof body?.message === 'string' && body.message) message = body.message
    else if (typeof body?.error === 'string' && body.error) message = body.error
  } catch {}
  throw new ApiError(res.status, message)
}

async function failUpload(res: Response): Promise<never> {
  if (res.status === 409) {
    const body = await res.json().catch(() => null)
    throw new UploadConflictError({
      fileName: body?.fileName ?? '',
      existingSections: body?.existingSections ?? 0,
      message: body?.message ?? 'El documento ya existe.',
    })
  }
  return fail(res)
}

export async function listDocuments(): Promise<DocumentsByScope> {
  const res = await fetch(`/api/documents`, { headers: authHeaders() })
  if (!res.ok) await fail(res)
  return res.json()
}

export async function uploadDocument(file: File, replace: boolean): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)

  const url = `/api/documents/upload${replace ? '?replace=true' : ''}`
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    headers: authHeaders(),
  })
  if (!res.ok) await failUpload(res)
  return res.json()
}

export async function deleteDocument(fileName: string): Promise<void> {
  const res = await fetch(`/api/documents/${encodeURIComponent(fileName)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) await fail(res)
}

export async function fetchHistory(conversationId: string): Promise<HistoryMessage[]> {
  const res = await fetch(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    { headers: authHeaders() }
  )
  if (!res.ok) await fail(res)
  const body = await res.json()
  return body.messages ?? []
}

interface StreamChatParams {
  conversationId?: string | null
  message: string
  turnstileToken?: string
  signal: AbortSignal
  onMeta?: (conversationId: string) => void
  onDelta?: (text: string) => void
  onDone?: (conversationId: string) => void
  onError?: (message: string) => void
}

export async function streamChat(params: StreamChatParams): Promise<void> {
  const res = await fetch(`/api/chat`, {
    method: 'POST',
    headers: authHeaders(true),
    signal: params.signal,
    body: JSON.stringify({
      conversationId: params.conversationId ?? undefined,
      message: params.message,
      turnstileToken: params.turnstileToken || undefined,
    }),
  })
  if (!res.ok) await fail(res)

  for await (const frame of parseSse(res)) {
    try {
      const data = JSON.parse(frame.data)
      if (frame.event === 'meta') params.onMeta?.(data.conversationId)
      else if (frame.event === 'delta') params.onDelta?.(data.text ?? '')
      else if (frame.event === 'done') params.onDone?.(data.conversationId)
      else if (frame.event === 'error') params.onError?.(data.message ?? 'Error inesperado.')
    } catch {}
  }
}
