import { supabase } from './supabase'
import { env } from './env'
import { HttpError } from './errors'

function startOfUtcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function assertGlobalDailyBudget(): Promise<void> {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${startOfUtcDay()}T00:00:00.000Z`)

  if (error) throw new Error(`Supabase al contar mensajes globales: ${error.message}`)
  if ((count ?? 0) >= env.globalDailyMessageLimit) {
    throw new HttpError(
      429,
      'La demostración alcanzó su límite diario de mensajes. Vuelve mañana o contacta al autor.'
    )
  }
}
