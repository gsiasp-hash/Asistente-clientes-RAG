'use client'

import { useEffect, useState } from 'react'
import { getSessionToken } from '../lib/api'

export function Header() {
  const [token, setToken] = useState('')

  useEffect(() => {
    setToken(getSessionToken())
  }, [])

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Asistente de Soporte al Cliente</h1>
          <p className="text-xs text-slate-500">Panel de administración · RAG con streaming</p>
        </div>
        {token && (
          <span
            className="hidden rounded-full bg-slate-100 px-3 py-1 font-mono text-xs text-slate-500 sm:block"
            title="Token de tu sesión — aísla tus documentos de otros visitantes"
          >
            sesión: {token.slice(0, 8)}
          </span>
        )}
      </div>
    </header>
  )
}
