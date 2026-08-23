export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  return Response.json({
    status: 'ok',
    service: 'rag-support-api',
    timestamp: new Date().toISOString(),
  })
}
