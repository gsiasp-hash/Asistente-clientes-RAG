import type { Request, Response } from 'express'
import {
  sectionCount,
  ingestPdf,
  listDocuments,
  deleteSections,
  getSessionUsage,
  MAX_DOCS_PER_SESSION,
  MAX_CHUNKS_PER_SESSION,
} from '../services/pdfService.js'
import { isAdmin } from '../middleware/session.js'
import { checkAndIncrement } from '../utils/rateLimiter.js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/errors.js'

const MAX_FILE_BYTES = 10 * 1024 * 1024

function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? ''
  const clean = base.replace(/[\u0000-\u001f<>:"|?*]/g, '').trim()
  return clean.length > 0 ? clean : 'documento.pdf'
}

function wantsReplace(req: Request): boolean {
  return req.body?.replace === 'true' || req.body?.replace === true || req.query.replace === 'true'
}

export async function uploadDocument(req: Request, res: Response): Promise<void> {
  const file = req.file
  if (!file) {
    throw new HttpError(400, 'Debes adjuntar un archivo PDF en el campo "file" del formulario.')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new HttpError(400, 'El archivo excede el límite de 10 MB.')
  }

  const admin = isAdmin(req)
  const sessionId = req.sessionId ?? null
  const scope = admin ? null : sessionId

  if (!admin) {
    checkAndIncrement(
      'uploads',
      env.dailyUploadLimit,
      'Se alcanzó el límite diario de subidas de la demostración. Vuelve mañana.'
    )
  }

  const fileName = sanitizeFileName(file.originalname)
  const replace = wantsReplace(req)

  const existingChunks = await sectionCount(fileName, scope)

  if (existingChunks > 0 && !replace) {
    res.status(409).json({
      error: 'documento_existente',
      message: `"${fileName}" ya está indexado (${existingChunks} secciones). Confirma si deseas reemplazarlo.`,
      fileName,
      existingSections: existingChunks,
    })
    return
  }

  let chunkBudget: number | null = null
  if (!admin && sessionId) {
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

  const result = await ingestPdf(file.buffer, fileName, scope, chunkBudget)

  res.status(existingChunks > 0 ? 200 : 201).json({
    fileName,
    pages: result.pages,
    chunks: result.chunks,
    replacedSections,
  })
}

export async function getDocuments(req: Request, res: Response): Promise<void> {
  const documents = await listDocuments(req.sessionId!)
  res.json(documents)
}

export async function removeDocument(req: Request, res: Response): Promise<void> {
  const param = req.params.fileName
  const fileName = Array.isArray(param) ? param[0] : param
  if (!fileName) {
    throw new HttpError(400, 'Falta el nombre del archivo en la ruta.')
  }

  const scope = isAdmin(req) ? null : (req.sessionId ?? null)
  const deleted = await deleteSections(fileName, scope)

  if (deleted === 0) {
    throw new HttpError(404, `No se encontró ningún documento con el nombre "${fileName}".`)
  }

  res.json({ fileName, deletedSections: deleted })
}
