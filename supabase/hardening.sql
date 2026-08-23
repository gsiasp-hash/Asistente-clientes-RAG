-- Endurecimiento de seguridad para la base viva.
-- Ejecutar una vez en Supabase SQL Editor.
-- Contexto: multi-tenant.sql creó la tabla sessions sin RLS, y las
-- funciones RPC son ejecutables por anon/authenticated por defecto.

-- 1. RLS en sessions (schema.sql ya lo incluye para fresh installs)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- 2. Bloquear acceso directo a tablas desde claves publishable (anon/authenticated).
--    Solo el backend con service_role debe leer/escribir.
REVOKE ALL ON document_sections FROM anon, authenticated;
REVOKE ALL ON conversations FROM anon, authenticated;
REVOKE ALL ON messages FROM anon, authenticated;
REVOKE ALL ON sessions FROM anon, authenticated;

-- 3. La RPC de búsqueda solo desde el backend
REVOKE EXECUTE ON FUNCTION match_document_sections FROM anon, authenticated;
