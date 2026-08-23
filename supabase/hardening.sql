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

-- 3. La RPC de búsqueda solo desde el backend.
--    Firma explícita porque existen dos sobrecargas (3 y 4 argumentos).
REVOKE EXECUTE ON FUNCTION match_document_sections(VECTOR(768), FLOAT, INT, TEXT)
  FROM anon, authenticated;

-- 4. Eliminar la sobrecarga vieja de 3 argumentos (sin filtro de sesión).
--    Idempotente: recorre las definiciones y borra cualquier firma que no sea de 4 args.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS fn, pronargs
    FROM pg_proc
    WHERE proname = 'match_document_sections'
  LOOP
    IF r.pronargs <> 4 THEN
      EXECUTE format('DROP FUNCTION %s', r.fn);
      RAISE NOTICE 'Eliminada sobrecarga obsoleta: %', r.fn;
    END IF;
  END LOOP;
END $$;

-- 5. Refrescar caché del API REST de Supabase
NOTIFY pgrst, 'reload schema';
