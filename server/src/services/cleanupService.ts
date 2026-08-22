import { supabase } from '../config/supabase.js'
import { env } from '../config/env.js'

interface CleanupResult {
  sessions: number
}

export async function cleanupExpiredSessions(): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - env.sessionTtlHours * 3_600_000).toISOString()

  const { data: expired, error } = await supabase
    .from('sessions')
    .select('session_id')
    .lt('last_seen_at', cutoff)

  if (error) throw new Error(`Supabase al buscar sesiones expiradas: ${error.message}`)

  const ids = (expired ?? []).map((row) => row.session_id)
  if (ids.length === 0) return { sessions: 0 }

  const docsResult = await supabase.from('document_sections').delete().in('session_id', ids)
  if (docsResult.error) throw new Error(`Supabase al limpiar documentos: ${docsResult.error.message}`)

  const convResult = await supabase.from('conversations').delete().in('session_id', ids)
  if (convResult.error) throw new Error(`Supabase al limpiar conversaciones: ${convResult.error.message}`)

  const orphansResult = await supabase
    .from('conversations')
    .delete()
    .is('session_id', null)
    .lt('created_at', cutoff)
  if (orphansResult.error) throw new Error(`Supabase al limpiar conversaciones huérfanas: ${orphansResult.error.message}`)

  const sessResult = await supabase.from('sessions').delete().in('session_id', ids)
  if (sessResult.error) throw new Error(`Supabase al limpiar sesiones: ${sessResult.error.message}`)

  console.log(`[cleanup] ${ids.length} sesión(es) inactivas eliminadas (> ${env.sessionTtlHours}h)`)
  return { sessions: ids.length }
}

export function startCleanupJob(): void {
  const run = () => {
    cleanupExpiredSessions().catch((err) => console.error('[cleanup]', err instanceof Error ? err.message : err))
  }
  setTimeout(run, 10_000)
  setInterval(run, 30 * 60_000)
}
