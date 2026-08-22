-- ============================================================
-- Reparación: recrear la función de búsqueda semántica y
-- refrescar el caché de esquema de PostgREST.
-- Ejecutar en el SQL Editor de Supabase si /api/verify reporta
-- "Invalid path specified in request URL" en el test de RPC.
-- ============================================================

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

NOTIFY pgrst, 'reload schema';
