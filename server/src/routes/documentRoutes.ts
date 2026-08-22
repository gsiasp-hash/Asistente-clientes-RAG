import { Router } from 'express'
import multer from 'multer'
import { uploadDocument, getDocuments, removeDocument } from '../controllers/documentController.js'
import { requireSession } from '../middleware/session.js'
import { HttpError } from '../utils/errors.js'

const MAX_FILE_BYTES = 10 * 1024 * 1024

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new HttpError(400, 'Solo se aceptan archivos PDF.'))
    }
  },
})

export const documentsRouter = Router()

documentsRouter.use(requireSession)
documentsRouter.post('/upload', upload.single('file'), uploadDocument)
documentsRouter.get('/', getDocuments)
documentsRouter.delete('/:fileName', removeDocument)
