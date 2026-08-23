-- Migración 002: índice para el límite global diario de mensajes.
-- El backend cuenta los mensajes del día (query head-only sobre created_at)
-- antes de cada llamada a la IA para acotar el consumo de Groq/Gemini.
-- Idempotente: seguro de re-ejecutar.

CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON messages (created_at);
