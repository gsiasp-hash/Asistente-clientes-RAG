import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

async function count(table: string, filter?: (q: any) => any): Promise<number> {
  let q = supabase.from(table).select('*', { count: 'exact', head: true })
  if (filter) q = filter(q)
  const { count, error } = await q
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

console.log('=== AUDITORÍA DE DATOS EN SUPABASE ===\n')

const sections = await count('document_sections')
const conversations = await count('conversations')
const messages = await count('messages')
const sessions = await count('sessions')
const sectionsWithSession = await count('document_sections', (q) => q.not('session_id', 'is', null))
const globalSections = sections - sectionsWithSession

console.log(`document_sections : ${sections} (globales: ${globalSections}, de sesiones: ${sectionsWithSession})`)
console.log(`conversations     : ${conversations}`)
console.log(`messages          : ${messages}`)
console.log(`sessions          : ${sessions}`)

if (conversations === 0 && messages === 0) {
  console.log('\n✓ Estado esperado: sin conversaciones ni mensajes de usuarios.')
} else {
  console.log('\n⚠ Hay datos de usuario que revisar arriba.')

  const { data: convRows } = await supabase.from('conversations').select('id, session_id, created_at').limit(10)
  console.log('\nConversaciones restantes:')
  console.log(JSON.stringify(convRows, null, 1))
}
