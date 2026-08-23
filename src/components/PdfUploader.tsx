import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { ConflictInfo } from '../types'

interface PdfUploaderProps {
  uploadingFile: string | null
  onUpload: (file: File, replace?: boolean) => Promise<{ conflict?: ConflictInfo }>
}

export function PdfUploader({ uploadingFile, onUpload }: PdfUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [conflict, setConflict] = useState<ConflictInfo | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  async function handleFile(file: File | undefined, replace = false) {
    if (!file || uploadingFile) return
    if (file.type !== 'application/pdf') {
      setConflict(null)
      return
    }

    const result = await onUpload(file, replace)

    if (result.conflict) {
      setConflict(result.conflict)
      setPendingFile(file)
    } else {
      setConflict(null)
      setPendingFile(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    void handleFile(e.dataTransfer.files[0])
  }

  const busy = uploadingFile !== null

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-700">Subir documento</h2>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
          dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50 hover:border-indigo-400'
        } ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        {busy ? (
          <p className="text-sm text-slate-600">
            Procesando <span className="font-medium">{uploadingFile}</span>…
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-600">Arrastra un PDF aquí</p>
            <p className="mt-0.5 text-xs text-slate-400">o haz clic para seleccionarlo · máx. 10 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>

      {conflict && pendingFile && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p>{conflict.message}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConflict(null)
                void handleFile(pendingFile, true)
              }}
              className="rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
            >
              Reemplazar
            </button>
            <button
              type="button"
              onClick={() => {
                setConflict(null)
                setPendingFile(null)
              }}
              className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
