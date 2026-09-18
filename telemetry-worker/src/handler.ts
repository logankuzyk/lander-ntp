import * as v from 'valibot'

import { EventSchema, toDataPoint } from './schema'

/** Events are a few hundred characters; anything far bigger isn't from the extension. */
export const MAX_BODY_LENGTH = 4096

const respond = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, {
    status,
    // Extension pages have per-install origins on Firefox, so there's no list to allow.
    headers: { 'Access-Control-Allow-Origin': '*', ...headers },
  })

/**
 * POST /events: validate one event and write it to Analytics Engine. The extension sends
 * text/plain to skip the CORS preflight, so the body is parsed as JSON whatever its type.
 * Client IPs and request metadata are never stored.
 */
export async function handle(request: Request, env: Env): Promise<Response> {
  if (new URL(request.url).pathname !== '/events') return respond(404)

  if (request.method === 'OPTIONS') {
    return respond(204, {
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    })
  }
  if (request.method !== 'POST') return respond(405, { Allow: 'POST, OPTIONS' })

  if (Number(request.headers.get('Content-Length')) > MAX_BODY_LENGTH) return respond(413)
  const body = await request.text()
  if (body.length > MAX_BODY_LENGTH) return respond(413)

  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return respond(400)
  }
  const result = v.safeParse(EventSchema, json)
  if (!result.success) return respond(400)

  const { success } = await env.LIMITER.limit({ key: result.output.installId })
  if (!success) return respond(429)

  env.EVENTS.writeDataPoint(toDataPoint(result.output))
  return respond(204)
}
