import {
  sectionCount,
  ingestPdf,
  deleteSections,
  getSessionUsage,
  MAX_DOCS_PER_SESSION,
  MAX_CHUNKS_PER_SESSION,
} from '@/server/pdfService'
import { requireSession, isAdmin } from '@/server/session'
import { checkAndIncrement } from '@/server/rateLimiter'
import { env } from '@/server/env'
import { HttpError, jsonError } from '@/server/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_FILE_BYTES = 10 * 1024 * 1024

function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? ''
  const clean = base.replace(/[\u0000-\u001f<>:"|?*]/g, '').trim()
  return clean.length > 0 ? clean : 'documento.pdf'
}

export async function POST(request: Request): Promise<Response> {
  try {
    const admin = isAdmin(request)
    const sessionId = await requireSession(request)
    const scope = admin ? null : sessionId

    if (!admin) {
      checkAndIncrement(
        'uploads',
        env.dailyUploadLimit,
        'Se alcanzó el límite diario de subidas de la demostración. Vuelve mañana.'
      )
    }

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      throw new HttpError(400, 'Debes enviar el archivo como formulario multipart.')
    }

    const file = form.get('file')
    if (!(file instanceof File)) {
      throw new HttpError(400, 'Debes adjuntar un archivo PDF en el campo "file" del formulario.')
    }
    if (file.type !== 'application/pdf') {
      throw new HttpError(400, 'Solo se aceptan archivos PDF.')
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new HttpError(400, 'El archivo excede el límite de 10 MB.')
    }

    const fileName = sanitizeFileName(file.name)
    const replace = new URL(request.url).searchParams.get('replace') === 'true'

    const existingChunks = await sectionCount(fileName, scope)

    if (existingChunks > 0 && !replace) {
      return Response.json(
        {
          error: 'documento_existente',
          message: `"${fileName}" ya está indexado (${existingChunks} secciones). Confirma si deseas reemplazarlo.`,
          fileName,
          existingSections: existingChunks,
        },
        { status: 409 }
      )
    }

    let chunkBudget: number | null = null
    if (!admin) {
      const usage = await getSessionUsage(sessionId)
      const isNewFile = existingChunks === 0
      if (isNewFile && usage.docs >= MAX_DOCS_PER_SESSION) {
        throw new HttpError(
          400,
          `Llegaste al máximo de ${MAX_DOCS_PER_SESSION} documentos por sesión. Elimina alguno antes de subir otro.`
        )
      }
      chunkBudget = MAX_CHUNKS_PER_SESSION - (usage.chunks - (isNewFile ? 0 : existingChunks))
    }

    let replacedSections = 0
    if (existingChunks > 0) {
      replacedSections = await deleteSections(fileName, scope)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await ingestPdf(buffer, fileName, scope, chunkBudget)

    return Response.json(
      {
        fileName,
        pages: result.pages,
        chunks: result.chunks,
        replacedSections,
      },
      { status: existingChunks > 0 ? 200 : 201 }
    )
  } catch (error) {
    return jsonError(error)
  }
}
