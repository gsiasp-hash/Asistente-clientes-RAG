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

function list(value: string | undefined, fallback: string[]): string[] {
  const items = (value ?? '')
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean)
  return items.length > 0 ? items : fallback
}

export const env = {
  get groqApiKey() {
    return getRequired('GROQ_API_KEY')
  },
  get geminiApiKey() {
    return getRequired('GEMINI_API_KEY')
  },
  get supabaseUrl() {
    return getRequired('SUPABASE_URL')
  },
  get supabaseServiceKey() {
    return getRequired('SUPABASE_SERVICE_KEY')
  },
  get embeddingModel() {
    return process.env.EMBEDDING_MODEL ?? 'gemini-embedding-001'
  },
  get llmModel() {
    return process.env.LLM_MODEL ?? 'openai/gpt-oss-120b'
  },
  get matchThreshold() {
    return num(process.env.RAG_MATCH_THRESHOLD, 0.4)
  },
  get adminToken() {
    return process.env.ADMIN_TOKEN ?? ''
  },
  get sessionTtlHours() {
    return num(process.env.SESSION_TTL_HOURS, 1)
  },
  get sessionMaxAgeHours() {
    return num(process.env.SESSION_MAX_AGE_HOURS, 24)
  },
  get dailyUploadLimit() {
    return num(process.env.DAILY_UPLOAD_LIMIT, 50)
  },
  get sessionMessageLimit() {
    return num(process.env.SESSION_MESSAGE_LIMIT, 15)
  },
  get globalDailyMessageLimit() {
    return num(process.env.GLOBAL_DAILY_MESSAGE_LIMIT, 200)
  },
  get allowedOrigins() {
    return list(process.env.ALLOWED_ORIGINS, [
      'https://asistente-rag-plum.vercel.app',
      'http://localhost:3000',
    ])
  },
  get turnstileSecretKey() {
    return process.env.TURNSTILE_SECRET_KEY ?? ''
  },
  get turnstileHostnames() {
    return list(process.env.TURNSTILE_HOSTNAMES, ['localhost', '127.0.0.1'])
  },
}
