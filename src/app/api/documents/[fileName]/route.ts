import { deleteSections } from '@/server/pdfService'
import { requireSession, isAdmin } from '@/server/session'
import { HttpError, jsonError } from '@/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ fileName: string }> }
): Promise<Response> {
  try {
    await requireSession(request)

    const { fileName: raw } = await params
    let fileName = raw
    try {
      fileName = decodeURIComponent(raw)
    } catch {}

    if (!fileName) {
      throw new HttpError(400, 'Falta el nombre del archivo en la ruta.')
    }

    const scope = isAdmin(request) ? null : (request.headers.get('X-Session-Token') ?? null)
    const deleted = await deleteSections(fileName, scope)

    if (deleted === 0) {
      throw new HttpError(404, `No se encontró ningún documento con el nombre "${fileName}".`)
    }

    return Response.json({ fileName, deletedSections: deleted })
  } catch (error) {
    return jsonError(error)
  }
}
