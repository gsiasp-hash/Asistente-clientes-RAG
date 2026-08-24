import { supabase } from './supabase'
import { embedTexts } from './gemini'
import { groq } from './groq'
import { env } from './env'
import { HttpError } from './errors'

const HISTORY_LIMIT = 10
const MATCH_COUNT = 3
const MAX_ANSWER_TOKENS = 1024

export interface RetrievedChunk {
  fileName: string
  content: string
  similarity: number
}

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `Eres un asistente de soporte al cliente. Responde ÚNICAMENTE con información proveniente del contexto de documentos proporcionado y del historial reciente de la conversación.

Reglas estrictas:
- Si la respuesta no está en el contexto ni en el historial, responde que no encuentras información sobre eso en los documentos cargados y sugiere reformular la pregunta o contactar a una persona del equipo.
- Nunca uses conocimiento general externo ni inventes datos.
- Responde en el idioma del usuario, con tono cordial, claro y directo.
- Formatea tus respuestas en Markdown: prioriza listas y párrafos compactos; usa tablas solo cuando aporten claridad y con un máximo de 4 columnas.
- Usa exclusivamente sintaxis Markdown; nunca incluyas etiquetas HTML como <br>, <b> ni tablas HTML. Para saltos de línea dentro de celdas de tabla usa espacios normales o reestructura la fila.`

export async function initConversation(conversationId: string | undefined, sessionId: string): Promise<string> {
  if (conversationId) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidPattern.test(conversationId)) {
      throw new HttpError(404, 'La conversación indicada no existe.')
    }
    const { data, error } = await supabase
      .from('conversations')
      .select('id, session_id')
      .eq('id', conversationId)
      .single()
    if (error || !data || data.session_id !== sessionId) {
      throw new HttpError(404, 'La conversación indicada no existe.')
    }
    return conversationId
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({ session_id: sessionId })
    .select('id')
    .single()
  if (error || !data) {
    throw new Error(`Supabase al crear conversación: ${error?.message ?? 'sin datos'}`)
  }
  return data.id
}

export async function loadHistory(conversationId: string): Promise<HistoryMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (error) throw new Error(`Supabase al cargar historial: ${error.message}`)

  const rows = ((data ?? []) as Array<{ role: string; content: string }>).reverse()
  return rows.map((r) => ({ role: r.role as HistoryMessage['role'], content: r.content }))
}

export interface ConversationMessage {
  role: string
  content: string
  sources: Array<{ fileName: string; similarity: number }> | null
  createdAt: string | null
}

export async function loadFullConversation(conversationId: string): Promise<ConversationMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content, sources, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Supabase al cargar mensajes: ${error.message}`)

  return ((data ?? []) as Array<{
    role: string
    content: string
    sources: ConversationMessage['sources']
    created_at: string | null
  }>).map((row) => ({
    role: row.role,
    content: row.content,
    sources: row.sources ?? null,
    createdAt: row.created_at,
  }))
}

export async function persistUserMessage(conversationId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role: 'user', content })
  if (error) throw new Error(`Supabase al guardar mensaje del usuario: ${error.message}`)
}

export async function persistAssistantMessage(
  conversationId: string,
  content: string,
  sources: Array<{ fileName: string; similarity: number }>
): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content,
    sources,
  })
  if (error) throw new Error(`Supabase al guardar respuesta: ${error.message}`)
}

export async function retrieveContext(question: string, sessionId: string): Promise<RetrievedChunk[]> {
  const [embedding] = await embedTexts([question], 'RETRIEVAL_QUERY')
  if (!embedding) return []

  const { data, error } = await supabase.rpc('match_document_sections', {
    query_embedding: embedding,
    match_threshold: env.matchThreshold,
    match_count: MATCH_COUNT,
    p_session_id: sessionId,
  })
  if (error) throw new Error(`Supabase RPC de búsqueda: ${error.message}`)

  const rows = (data ?? []) as Array<{ file_name: string; content: string; similarity: number }>
  return rows.map((r) => ({ fileName: r.file_name, content: r.content, similarity: r.similarity }))
}

export function buildPrompt(
  history: HistoryMessage[],
  context: RetrievedChunk[],
  question: string
): LlmMessage[] {
  const messages: LlmMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]

  for (const h of history) {
    messages.push({ role: h.role, content: h.content })
  }

  const contextBlock = context.length > 0
    ? `CONTEXTO DE DOCUMENTOS (única fuente válida de información):\n\n${context
        .map((c, i) => `[${i + 1}] Documento: ${c.fileName}\n${c.content}`)
        .join('\n\n')}`
    : 'No se encontraron fragmentos relevantes en los documentos cargados para esta pregunta. Aplica la regla de rechazo honesto si el historial tampoco alcanza para responder.'

  messages.push({ role: 'system', content: contextBlock })
  messages.push({ role: 'user', content: question })

  return messages
}

export async function* streamAnswer(
  messages: LlmMessage[],
  signal: AbortSignal
): AsyncGenerator<string> {
  const stream = await groq.chat.completions.create(
    {
      model: env.llmModel,
      messages,
      stream: true,
      temperature: 0.2,
      max_tokens: MAX_ANSWER_TOKENS,
      reasoning_format: 'hidden',
    },
    { signal }
  )

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content
    if (delta) yield delta
  }
}
