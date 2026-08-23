import { supabase } from './supabase'
import { env } from './env'
import { HttpError } from './errors'
import { cleanupExpiredSessions } from './cleanupService'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,64}$/
const SWEEP_INTERVAL_MS = 10 * 60_000

let lastSweepAt = 0

function maybeSweep(): void {
  const now = Date.now()
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return
  lastSweepAt = now
  void cleanupExpiredSessions().catch((err) =>
    console.error('[cleanup]', err instanceof Error ? err.message : err)
  )
}

export async function requireSession(request: Request): Promise<string> {
  const token = request.headers.get('X-Session-Token')
  if (!token || !TOKEN_PATTERN.test(token)) {
    throw new HttpError(400, 'Falta el token de sesión (header X-Session-Token). Recarga la página para generarlo.')
  }

  maybeSweep()

  const { error } = await supabase
    .from('sessions')
    .upsert({ session_id: token, last_seen_at: new Date().toISOString() })
  if (error) throw new Error(`Supabase al registrar sesión: ${error.message}`)

  return token
}

export function isAdmin(request: Request): boolean {
  return env.adminToken.length > 0 && request.headers.get('X-Admin-Token') === env.adminToken
}
