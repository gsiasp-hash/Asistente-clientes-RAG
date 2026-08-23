import { supabase } from './supabase'
import { env } from './env'

export interface CleanupResult {
  sessions: number
}

export async function cleanupExpiredSessions(): Promise<CleanupResult> {
  const idleCutoff = new Date(Date.now() - env.sessionTtlHours * 3_600_000).toISOString()
  const absoluteCutoff = new Date(Date.now() - env.sessionMaxAgeHours * 3_600_000).toISOString()

  const { data: expired, error } = await supabase
    .from('sessions')
    .select('session_id')
    .or(`last_seen_at.lt.${idleCutoff},created_at.lt.${absoluteCutoff}`)

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
    .lt('created_at', absoluteCutoff)
  if (orphansResult.error) throw new Error(`Supabase al limpiar conversaciones huérfanas: ${orphansResult.error.message}`)

  const sessResult = await supabase.from('sessions').delete().in('session_id', ids)
  if (sessResult.error) throw new Error(`Supabase al limpiar sesiones: ${sessResult.error.message}`)

  console.log(
    `[cleanup] ${ids.length} sesión(es) eliminada(s) (> ${env.sessionTtlHours}h inactiva o > ${env.sessionMaxAgeHours}h de vida)`
  )
  return { sessions: ids.length }
}
