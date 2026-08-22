-- ============================================================
-- Asistente de Soporte al Cliente (RAG) — Esquema de BD
-- Ejecutar completo en el SQL Editor de Supabase
-- ============================================================

-- 1. Habilitar extensión de vectores
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- CONOCIMIENTO: secciones de documentos (RAG)
-- ============================================================

CREATE TABLE IF NOT EXISTS document_sections (
  id BIGSERIAL PRIMARY KEY,
  file_name TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768), -- dimensiones del modelo text-embedding-004
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice IVFFlat para búsqueda por similitud coseno
CREATE INDEX IF NOT EXISTS idx_document_sections_embedding
  ON document_sections USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Búsqueda semántica: top-N chunks por similitud
CREATE OR REPLACE FUNCTION match_document_sections (
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count INT
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
  WHERE 1 - (document_sections.embedding <=> query_embedding) > match_threshold
  ORDER BY document_sections.embedding <=> query_embedding ASC
  LIMIT match_count;
$$;

-- ============================================================
-- HISTORIAL: conversaciones y mensajes (memoria del chat)
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB, -- citas usadas en la respuesta del asistente (opcional)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Consulta frecuente: historial ordenado por conversación
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, created_at);

-- ============================================================
-- SEGURIDAD: el backend accede con service_role (bypass RLS).
-- Activamos RLS y no definimos políticas públicas:
-- nadie puede leer/escribir desde el cliente directamente.
-- ============================================================

ALTER TABLE document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
