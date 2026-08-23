import { GoogleGenAI } from '@google/genai'
import { env } from './env'

const ai = new GoogleGenAI({ apiKey: env.geminiApiKey })

const EMBEDDING_DIMS = 768
const BATCH_SIZE = 100

export type EmbedTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

export async function embedTexts(
  texts: string[],
  taskType: EmbedTaskType
): Promise<number[][]> {
  if (texts.length === 0) return []

  const all: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const res = await ai.models.embedContent({
      model: env.embeddingModel,
      contents: batch,
      config: { outputDimensionality: EMBEDDING_DIMS, taskType },
    })

    const embeddings = res.embeddings?.map((e) => e.values ?? []) ?? []
    if (embeddings.length !== batch.length || embeddings.some((v) => v.length !== EMBEDDING_DIMS)) {
      throw new Error(`La API de embeddings devolvió una respuesta inválida para el lote ${i / BATCH_SIZE + 1}`)
    }
    all.push(...embeddings)
  }

  return all
}
