import { useCallback, useEffect, useState } from 'react'
import {
  ApiError,
  UploadConflictError,
  deleteDocument,
  listDocuments,
  uploadDocument,
} from '../lib/api'
import type { ConflictInfo, DocumentsByScope } from '../types'

interface UploadOutcome {
  conflict?: ConflictInfo
}

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentsByScope | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadingFile, setUploadingFile] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setDocuments(await listDocuments())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los documentos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const upload = useCallback(
    async (file: File, replace = false): Promise<UploadOutcome> => {
      setUploadingFile(file.name)
      setError(null)
      try {
        await uploadDocument(file, replace)
        await refresh()
        return {}
      } catch (err) {
        if (err instanceof UploadConflictError) {
          return { conflict: err.conflict }
        }
        setError(err instanceof ApiError || err instanceof Error ? err.message : 'Error al subir el archivo.')
        return {}
      } finally {
        setUploadingFile(null)
      }
    },
    [refresh]
  )

  const remove = useCallback(
    async (fileName: string) => {
      setError(null)
      try {
        await deleteDocument(fileName)
        await refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al eliminar el documento.')
      }
    },
    [refresh]
  )

  const clearMine = useCallback(async () => {
    if (!documents) return
    setError(null)
    try {
      for (const doc of documents.mine) {
        await deleteDocument(doc.fileName)
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al vaciar los documentos.')
      await refresh()
    }
  }, [documents, refresh])

  return { documents, loading, uploadingFile, error, refresh, upload, remove, clearMine }
}
