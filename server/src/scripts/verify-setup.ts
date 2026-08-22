import 'dotenv/config'

interface CheckResult {
  name: string
  ok: boolean
  detail: string
}

async function checkGemini(): Promise<CheckResult> {
  try {
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const model = process.env.EMBEDDING_MODEL ?? 'gemini-embedding-001'
    const res = await ai.models.embedContent({
      model,
      contents: 'Prueba de conexión del asistente de soporte',
      config: { outputDimensionality: 768 },
    })
    const dims = res.embeddings?.[0]?.values?.length ?? 0
    if (dims !== 768) {
      return { name: 'Gemini (embeddings)', ok: false, detail: `Dimensión inesperada: ${dims}` }
    }
    return { name: 'Gemini (embeddings)', ok: true, detail: `${model} → 768 dims` }
  } catch (err) {
    return { name: 'Gemini (embeddings)', ok: false, detail: msg(err) }
  }
}

async function checkSupabase(embedding: number[]): Promise<CheckResult> {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

    const tables = ['document_sections', 'conversations', 'messages']
    for (const table of tables) {
      const { error } = await supabase.from(table).select('*', { count: 'exact', head: true })
      if (error) {
        return { name: 'Supabase', ok: false, detail: `Tabla "${table}": ${error.message}` }
      }
    }

    const { data, error: rpcError } = await supabase.rpc('match_document_sections', {
      query_embedding: embedding,
      match_threshold: 0,
      match_count: 1,
    })
    if (rpcError) {
      return { name: 'Supabase', ok: false, detail: `RPC: ${rpcError.message}` }
    }

    const count = Array.isArray(data) ? data.length : 0
    return {
      name: 'Supabase',
      ok: true,
      detail: `Tablas OK · RPC match_document_sections OK (${count} resultado(s) en prueba vacía)`,
    }
  } catch (err) {
    return { name: 'Supabase', ok: false, detail: msg(err) }
  }
}

async function checkGroq(): Promise<CheckResult> {
  try {
    const Groq = (await import('groq-sdk')).default
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
    const models = await groq.models.list()
    const ids = models.data.map((m) => m.id)
    const target = process.env.LLM_MODEL ?? 'openai/gpt-oss-120b'
    if (!ids.includes(target)) {
      return {
        name: 'Groq Cloud',
        ok: false,
        detail: `Modelo "${target}" no encontrado (${ids.length} modelos disponibles)`,
      }
    }
    return { name: 'Groq Cloud', ok: true, detail: `${target} disponible` }
  } catch (err) {
    return { name: 'Groq Cloud', ok: false, detail: msg(err) }
  }
}

function msg(err: unknown): string {
  const e = err as { message?: string; status?: number; error?: { message?: string } }
  return e.error?.message ?? e.message ?? String(err)
}

async function main() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'GROQ_API_KEY', 'GEMINI_API_KEY']
  const missing = required.filter((k) => !process.env[k])

  if (missing.length > 0) {
    console.error(`✗ Variables faltantes en .env: ${missing.join(', ')}`)
    process.exit(1)
  }

  console.log('Verificando conexión con los servicios...\n')

  const gemini = await checkGemini()

  let embedding: number[] = []
  if (gemini.ok) {
    const { GoogleGenAI } = await import('@google/genai')
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const res = await ai.models.embedContent({
      model: process.env.EMBEDDING_MODEL ?? 'gemini-embedding-001',
      contents: 'vector de prueba para validar la función RPC',
      config: { outputDimensionality: 768 },
    })
    embedding = res.embeddings![0]!.values!
  }

  const results = [gemini, await checkSupabase(embedding), await checkGroq()]

  for (const r of results) {
    const icon = r.ok ? '✓' : '✗'
    console.log(`${icon} ${r.name}`)
    console.log(`  ${r.detail}\n`)
  }

  if (results.some((r) => !r.ok)) {
    console.error('Hay errores pendientes. Revisa server/.env y el esquema de Supabase.')
    process.exit(1)
  }

  console.log('Todos los servicios están operativos. Listo para la Fase 2.')
}

main()
