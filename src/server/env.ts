const REQUIRED_KEYS = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'] as const

export type RequiredKey = (typeof REQUIRED_KEYS)[number]

function getRequired(key: RequiredKey): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Variable de entorno faltante: ${key}. Configúrala en .env (local) o en Vercel Environment Variables.`)
  }
  return value
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const env = {
  groqApiKey: getRequired('GROQ_API_KEY'),
  geminiApiKey: getRequired('GEMINI_API_KEY'),
  supabaseUrl: getRequired('SUPABASE_URL'),
  supabaseServiceKey: getRequired('SUPABASE_SERVICE_KEY'),
  embeddingModel: process.env.EMBEDDING_MODEL ?? 'gemini-embedding-001',
  llmModel: process.env.LLM_MODEL ?? 'openai/gpt-oss-120b',
  matchThreshold: num(process.env.RAG_MATCH_THRESHOLD, 0.4),
  adminToken: process.env.ADMIN_TOKEN ?? '',
  sessionTtlHours: num(process.env.SESSION_TTL_HOURS, 1),
  sessionMaxAgeHours: num(process.env.SESSION_MAX_AGE_HOURS, 24),
  dailyUploadLimit: num(process.env.DAILY_UPLOAD_LIMIT, 50),
  sessionMessageLimit: num(process.env.SESSION_MESSAGE_LIMIT, 15),
}
