export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function jsonError(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  console.error('[error no controlado]', error)
  return Response.json({ error: 'Error interno del servidor.' }, { status: 500 })
}
