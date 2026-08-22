const REQUIRED_KEYS = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'] as const

export type RequiredKey = (typeof REQUIRED_KEYS)[number]

function getRequired(key: RequiredKey): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Variable de entorno faltante: ${key}. Revisa server/.env`)
  }
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 5000),
  groqApiKey: getRequired('GROQ_API_KEY'),
  geminiApiKey: getRequired('GEMINI_API_KEY'),
  supabaseUrl: getRequired('SUPABASE_URL'),
  supabaseServiceKey: getRequired('SUPABASE_SERVICE_KEY'),
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'gemini-embedding-001',
  llmModel: process.env.LLM_MODEL ?? 'openai/gpt-oss-120b',
}
