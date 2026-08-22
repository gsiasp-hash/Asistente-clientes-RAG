import type { ErrorRequestHandler } from 'express'
import { MulterError } from 'multer'
import { HttpError } from '../utils/errors.js'

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
    return
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'El archivo excede el límite de 10 MB.' : `Error al procesar el archivo: ${err.message}`
    res.status(400).json({ error: message })
    return
  }

  console.error('[error no controlado]', err)
  res.status(500).json({ error: 'Error interno del servidor.' })
}
