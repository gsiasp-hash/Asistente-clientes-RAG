import { listDocuments } from '@/server/pdfService'
import { requireSession } from '@/server/session'
import { jsonError } from '@/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  try {
    const sessionId = await requireSession(request)
    const documents = await listDocuments(sessionId)
    return Response.json(documents)
  } catch (error) {
    return jsonError(error)
  }
}
