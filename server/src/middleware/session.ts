import type { RequestHandler } from 'express'
import type { Request } from 'express'
import { supabase } from '../config/supabase.js'
import { env } from '../config/env.js'
import { HttpError } from '../utils/errors.js'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

export const requireSession: RequestHandler = (req, _res, next) => {
  void handleSession(req)
    .then(() => next())
    .catch(next)
}

async function handleSession(req: Request): Promise<void> {
  const token = req.header('X-Session-Token')
  if (!token || !TOKEN_PATTERN.test(token)) {
    throw new HttpError(400, 'Falta el token de sesión (header X-Session-Token). Recarga la página para generarlo.')
  }

  req.sessionId = token

  const { error } = await supabase
    .from('sessions')
    .upsert({ session_id: token, last_seen_at: new Date().toISOString() })
  if (error) throw new Error(`Supabase al registrar sesión: ${error.message}`)
}

export function isAdmin(req: Request): boolean {
  return env.adminToken.length > 0 && req.header('X-Admin-Token') === env.adminToken
}
