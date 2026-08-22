import type { DocumentSummary, DocumentsByScope } from '../types'

interface DocumentListProps {
  documents: DocumentsByScope | null
  loading: boolean
  onRemove: (fileName: string) => void
  onClearMine: () => void
}

function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DocRow({ doc, removable, onRemove }: { doc: DocumentSummary; removable: boolean; onRemove: (f: string) => void }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800">{doc.fileName}</p>
        <p className="text-xs text-slate-400">
          {doc.sections} secciones · {formatDate(doc.lastIngested)}
        </p>
      </div>
      {removable && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`¿Eliminar "${doc.fileName}"?`)) onRemove(doc.fileName)
          }}
          className="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          title="Eliminar documento"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
          </svg>
        </button>
      )}
    </li>
  )
}

export function DocumentList({ documents, loading, onRemove, onClearMine }: DocumentListProps) {
  if (loading) {
    return <p className="text-sm text-slate-500">Cargando documentos…</p>
  }

  const demo = documents?.demo ?? []
  const mine = documents?.mine ?? []

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          Mis documentos
          {mine.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('¿Vaciar todos tus documentos de esta sesión?')) onClearMine()
              }}
              className="ml-auto text-xs font-normal text-slate-400 underline-offset-2 hover:text-red-600 hover:underline"
            >
              Vaciar
            </button>
          )}
        </h2>
        {mine.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Aún no has subido documentos. Se borrarán automáticamente una hora después de tu última actividad.
          </p>
        ) : (
          <ul className="space-y-2">
            {mine.map((doc) => (
              <DocRow key={doc.fileName} doc={doc} removable onRemove={onRemove} />
            ))}
          </ul>
        )}
      </div>

      {demo.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">
            Documentos de demostración
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
              solo lectura
            </span>
          </h2>
          <ul className="space-y-2">
            {demo.map((doc) => (
              <DocRow key={doc.fileName} doc={doc} removable={false} onRemove={onRemove} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
