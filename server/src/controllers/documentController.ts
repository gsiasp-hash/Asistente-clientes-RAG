import type { Request, Response } from 'express'
import { sectionCount, ingestPdf, listDocuments, deleteSections } from '../services/pdfService.js'
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

  const fileName = sanitizeFileName(file.originalname)
  const replace = wantsReplace(req)

  const existing = await sectionCount(fileName)

  if (existing > 0 && !replace) {
    res.status(409).json({
      error: 'documento_existente',
      message: `"${fileName}" ya está indexado (${existing} secciones). Confirma si deseas reemplazarlo.`,
      fileName,
      existingSections: existing,
    })
    return
  }

  let replacedSections = 0
  if (existing > 0) {
    replacedSections = await deleteSections(fileName)
  }

  const result = await ingestPdf(file.buffer, fileName)

  res.status(existing > 0 ? 200 : 201).json({
    fileName,
    pages: result.pages,
    chunks: result.chunks,
    replacedSections,
  })
}

export async function getDocuments(_req: Request, res: Response): Promise<void> {
  const documents = await listDocuments()
  res.json({ documents, total: documents.length })
}

export async function removeDocument(req: Request, res: Response): Promise<void> {
  const param = req.params.fileName
  const fileName = Array.isArray(param) ? param[0] : param
  if (!fileName) {
    throw new HttpError(400, 'Falta el nombre del archivo en la ruta.')
  }

  const deleted = await deleteSections(fileName)

  if (deleted === 0) {
    throw new HttpError(404, `No se encontró ningún documento con el nombre "${fileName}".`)
  }

  res.json({ fileName, deletedSections: deleted })
}
