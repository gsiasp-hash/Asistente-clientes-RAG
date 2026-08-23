-- ============================================================
-- 001 · Timeout absoluto de sesión anti-secuestro de recursos
--
-- El TTL por inactividad (SESSION_TTL_HOURS) se renueva con cada
-- petición: una sesión activa nunca expira y sus documentos pueden
-- permanecer en la BD indefinidamente. Esta migración añade
-- created_at para que el barrido también elimine sesiones que
-- superen la edad máxima absoluta (SESSION_MAX_AGE_HOURS),
-- independientemente de su actividad reciente.
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

NOTIFY pgrst, 'reload schema';
