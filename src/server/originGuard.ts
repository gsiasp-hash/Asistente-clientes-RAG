import { env } from './env'
import { HttpError } from './errors'

function normalize(origin: string): string {
  return origin.trim().replace(/\/$/, '')
}

export function assertAllowedOrigin(request: Request): void {
  const origin = request.headers.get('Origin')
  if (!origin) return
  if (env.allowedOrigins.includes(normalize(origin))) return
  throw new HttpError(403, 'Origen no autorizado para consumir esta API.')
}
