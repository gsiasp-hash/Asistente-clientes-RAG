-- ============================================================
-- Asistente de Soporte al Cliente (RAG) — Esquema de BD
-- Ejecutar completo en el SQL Editor de Supabase
-- Incluye modelo multi-tenant para portafolio público
-- ============================================================

-- 1. Habilitar extensión de vectores
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- CONOCIMIENTO: secciones de documentos (RAG)
-- session_id NULL = documento global de demostración
-- session_id = token = documento privado de un visitante
-- ============================================================

CREATE TABLE IF NOT EXISTS document_sections (
  id BIGSERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768), -- dimensiones de salida de gemini-embedding-001
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_sections_embedding
  ON document_sections USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_document_sections_session
  ON document_sections (session_id);

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

-- ============================================================
-- SESIONES ANÓNIMAS: actividad para limpieza por TTL
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- HISTORIAL: conversaciones y mensajes (memoria del chat)
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations (session_id);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON messages (created_at);

-- ============================================================
-- SEGURIDAD: el backend accede con service_role (bypass RLS).
-- RLS activo sin políticas públicas: nadie accede directo
-- desde el cliente.
-- ============================================================

ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Bloquear acceso directo a tablas desde claves publishable (anon/authenticated).
-- Solo el backend con service_role lee y escribe.
REVOKE ALL ON document_sections FROM anon, authenticated;
REVOKE ALL ON conversations FROM anon, authenticated;
REVOKE ALL ON messages FROM anon, authenticated;
REVOKE ALL ON sessions FROM anon, authenticated;

-- La RPC de búsqueda solo ejecutable desde el backend
REVOKE EXECUTE ON FUNCTION match_document_sections(VECTOR(768), FLOAT, INT, TEXT)
  FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
