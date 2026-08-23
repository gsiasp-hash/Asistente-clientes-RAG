import { env } from './env'
import { HttpError } from './errors'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const ACTION = 'chat'
const MAX_TOKEN_LENGTH = 2048

function clientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || undefined
  return request.headers.get('x-real-ip') ?? undefined
}

export async function verifyTurnstile(token: unknown, request: Request): Promise<void> {
  const secret = env.turnstileSecretKey
  if (!secret) return

  const value = typeof token === 'string' ? token : ''
  if (!value || value.length > MAX_TOKEN_LENGTH) {
    throw new HttpError(403, 'Verificación anti-bot pendiente. Completa la comprobación e inténtalo de nuevo.')
  }

  const expectedHostnames = new Set(env.turnstileHostnames)
  let success = false
  let action: string | null = null
  let hostname: string | null = null

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret,
        response: value,
        ...(clientIp(request) ? { remoteip: clientIp(request)! } : {}),
      }),
    })
    if (!response.ok) throw new Error(`siteverify ${response.status}`)
    const result = (await response.json()) as {
      success?: boolean
      action?: string | null
      hostname?: string | null
    }
    success = result.success === true
    action = result.action ?? null
    hostname = result.hostname ?? null
  } catch (error) {
    console.error('[turnstile]', error instanceof Error ? error.message : error)
    throw new HttpError(403, 'No se pudo verificar la comprobación anti-bot. Inténtalo de nuevo.')
  }

  if (!success || action !== ACTION || !hostname || !expectedHostnames.has(hostname)) {
    throw new HttpError(403, 'Comprobación anti-bot inválida. Recarga la página e inténtalo de nuevo.')
  }
}
