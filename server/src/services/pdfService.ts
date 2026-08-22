import { PDFParse } from 'pdf-parse'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { supabase } from '../config/supabase.js'
import { embedTexts } from '../config/gemini.js'
import { HttpError } from '../utils/errors.js'

const CHUNK_SIZE = 500
const CHUNK_OVERLAP = 50
const INSERT_BATCH_SIZE = 200
export const MAX_DOCS_PER_SESSION = 5
export const MAX_CHUNKS_PER_SESSION = 300

export interface DocumentSummary {
  fileName: string
  sections: number
  lastIngested: string
}

export interface DocumentsByScope {
  demo: DocumentSummary[]
  mine: DocumentSummary[]
}

export interface SessionUsage {
  docs: number
  chunks: number
}

export interface IngestResult {
  pages: number
  chunks: number
}

interface SectionRow {
  file_name: string
  session_id: string | null
  created_at: string | null
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function extractPdf(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return { text: result.text, pages: result.total }
  } finally {
    await parser.destroy()
  }
}

export async function sectionCount(fileName: string, sessionId: string | null): Promise<number> {
  let query = supabase
    .from('document_sections')
    .select('*', { count: 'exact', head: true })
    .eq('file_name', fileName)
  query = sessionId === null ? query.is('session_id', null) : query.eq('session_id', sessionId)

  const { count, error } = await query
  if (error) throw new Error(`Supabase: ${error.message}`)
  return count ?? 0
}

export async function deleteSections(fileName: string, sessionId: string | null): Promise<number> {
  let query = supabase.from('document_sections').delete().eq('file_name', fileName)
  query = sessionId === null ? query.is('session_id', null) : query.eq('session_id', sessionId)

  const { data, error } = await query.select('id')
  if (error) throw new Error(`Supabase: ${error.message}`)
  return data?.length ?? 0
}

export async function getSessionUsage(sessionId: string): Promise<SessionUsage> {
  const { data, error } = await supabase
    .from('document_sections')
    .select('file_name')
    .eq('session_id', sessionId)

  if (error) throw new Error(`Supabase: ${error.message}`)

  const rows = (data ?? []) as Array<{ file_name: string }>
  return {
    docs: new Set(rows.map((r) => r.file_name)).size,
    chunks: rows.length,
  }
}

export async function listDocuments(currentSessionId: string): Promise<DocumentsByScope> {
  const { data, error } = await supabase.from('document_sections').select('file_name, session_id, created_at')

  if (error) throw new Error(`Supabase: ${error.message}`)

  const rows = (data ?? []) as SectionRow[]
  const demo = new Map<string, DocumentSummary>()
  const mine = new Map<string, DocumentSummary>()

  for (const row of rows) {
    if (row.session_id !== null && row.session_id !== currentSessionId) continue

    const bucket = row.session_id === null ? demo : mine
    const current = bucket.get(row.file_name)
    if (!current) {
      bucket.set(row.file_name, {
        fileName: row.file_name,
        sections: 1,
        lastIngested: row.created_at ?? '',
      })
    } else {
      current.sections += 1
      if ((row.created_at ?? '') > current.lastIngested) {
        current.lastIngested = row.created_at ?? current.lastIngested
      }
    }
  }

  const sortDesc = (a: DocumentSummary, b: DocumentSummary) => b.lastIngested.localeCompare(a.lastIngested)
  return { demo: [...demo.values()].sort(sortDesc), mine: [...mine.values()].sort(sortDesc) }
}

export async function ingestPdf(
  buffer: Buffer,
  fileName: string,
  sessionId: string | null,
  chunkBudget: number | null
): Promise<IngestResult> {
  const { text, pages } = await extractPdf(buffer)
  const clean = normalizeText(text)

  if (!clean) {
    throw new HttpError(
      422,
      'El PDF no contiene texto extraíble. Probablemente es un documento escaneado sin capa OCR.'
    )
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  })
  const chunks = (await splitter.splitText(clean)).filter((c) => c.trim().length > 0)

  if (chunks.length === 0) {
    throw new HttpError(422, 'No se pudieron generar secciones a partir del contenido del PDF.')
  }

  if (chunkBudget !== null && chunks.length > chunkBudget) {
    throw new HttpError(
      400,
      `Este documento genera ${chunks.length} secciones y solo te quedan ${chunkBudget} disponibles en la sesión (límite de ${MAX_CHUNKS_PER_SESSION}). Prueba con un PDF más pequeño.`
    )
  }

  const embeddings = await embedTexts(chunks, 'RETRIEVAL_DOCUMENT')
  const rows = chunks.map((content, i) => ({
    file_name: fileName,
    content,
    embedding: embeddings[i],
    session_id: sessionId,
  }))

  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE)
    const { error } = await supabase.from('document_sections').insert(batch)
    if (error) throw new Error(`Supabase al insertar lote ${i / INSERT_BATCH_SIZE + 1}: ${error.message}`)
  }

  return { pages, chunks: chunks.length }
}
