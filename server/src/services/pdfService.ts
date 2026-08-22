import { PDFParse } from 'pdf-parse'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { supabase } from '../config/supabase.js'
import { embedTexts } from '../config/gemini.js'
import { HttpError } from '../utils/errors.js'

const CHUNK_SIZE = 500
const CHUNK_OVERLAP = 50
const INSERT_BATCH_SIZE = 200

export interface DocumentSummary {
  fileName: string
  sections: number
  lastIngested: string
}

export interface IngestResult {
  pages: number
  chunks: number
}

interface SectionRow {
  file_name: string
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

export async function sectionCount(fileName: string): Promise<number> {
  const { count, error } = await supabase
    .from('document_sections')
    .select('*', { count: 'exact', head: true })
    .eq('file_name', fileName)

  if (error) throw new Error(`Supabase: ${error.message}`)
  return count ?? 0
}

export async function deleteSections(fileName: string): Promise<number> {
  const { data, error } = await supabase
    .from('document_sections')
    .delete()
    .eq('file_name', fileName)
    .select('id')

  if (error) throw new Error(`Supabase: ${error.message}`)
  return data?.length ?? 0
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const { data, error } = await supabase
    .from('document_sections')
    .select('file_name, created_at')

  if (error) throw new Error(`Supabase: ${error.message}`)

  const rows = (data ?? []) as SectionRow[]
  const map = new Map<string, DocumentSummary>()

  for (const row of rows) {
    const current = map.get(row.file_name)
    if (!current) {
      map.set(row.file_name, {
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

  return [...map.values()].sort((a, b) => b.lastIngested.localeCompare(a.lastIngested))
}

export async function ingestPdf(buffer: Buffer, fileName: string): Promise<IngestResult> {
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

  const embeddings = await embedTexts(chunks, 'RETRIEVAL_DOCUMENT')
  const rows = chunks.map((content, i) => ({
    file_name: fileName,
    content,
    embedding: embeddings[i],
  }))

  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + INSERT_BATCH_SIZE)
    const { error } = await supabase.from('document_sections').insert(batch)
    if (error) throw new Error(`Supabase al insertar lote ${i / INSERT_BATCH_SIZE + 1}: ${error.message}`)
  }

  return { pages, chunks: chunks.length }
}
