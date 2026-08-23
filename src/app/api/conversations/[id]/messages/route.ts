import { initConversation, loadFullConversation } from '@/server/chatService'
import { requireSession } from '@/server/session'
import { HttpError, jsonError } from '@/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const sessionId = await requireSession(request)

    const { id: raw } = await params
    let conversationId = raw
    try {
      conversationId = decodeURIComponent(raw)
    } catch {}

    if (!conversationId) {
      throw new HttpError(400, 'Falta el id de la conversación en la ruta.')
    }

    await initConversation(conversationId, sessionId)
    const messages = await loadFullConversation(conversationId)

    return Response.json({ conversationId, messages })
  } catch (error) {
    return jsonError(error)
  }
}
