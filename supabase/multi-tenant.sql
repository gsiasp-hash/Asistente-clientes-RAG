-- ============================================================
-- Migración multi-tenant para portafolio público
-- Ejecutar en el SQL Editor de Supabase (BD existente)
-- ============================================================

-- 1. Sesión propietaria en documentos y conversaciones
ALTER TABLE document_sections ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS session_id TEXT;

-- session_id NULL = documento global de demostración (visible a todos)
CREATE INDEX IF NOT EXISTS idx_document_sections_session ON document_sections (session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations (session_id);

-- 2. Registro de actividad por sesión (para limpieza por TTL)
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. RPC de búsqueda con filtro de visibilidad (globales + propios)
CREATE OR REPLACE FUNCTION match_document_sections (
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT,
  p_session_id TEXT
)
RETURNS TABLE (
  id BIGINT,
  file_name TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    document_sections.id,
    document_sections.file_name,
    document_sections.content,
    1 - (document_sections.embedding <=> query_embedding) AS similarity
  FROM document_sections
  WHERE (document_sections.session_id IS NULL OR document_sections.session_id = p_session_id)
    AND 1 - (document_sections.embedding <=> query_embedding) > match_threshold
  ORDER BY document_sections.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

NOTIFY pgrst, 'reload schema';
