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
 * The body as text, or null once it passes `max` bytes. Read chunk by chunk rather than with
 * `request.text()`, so a chunked body with no Content-Length can't make the Worker buffer
 * more than that.
 */
async function readCapped(request: Request, max: number): Promise<string | null> {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

/**
 * POST /events: validate one event and write it to Analytics Engine. The extension sends
 * text/plain to skip the CORS preflight, so the body is parsed as JSON whatever its type.
 * Client IPs and request metadata are never stored or logged.
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

  // By IP as well as by install id, since the id is whatever the client says and a new one
  // per request would get around a limit on it alone. The IP is only the limiter's key for
  // the length of its window: it is never written to the dataset or logged, so this keeps
  // to the rule that the Worker stores no IPs. Skipped if the header is missing (tests).
  const ip = request.headers.get('cf-connecting-ip')
  if (ip && !(await env.LIMITER.limit({ key: `ip:${ip}` })).success) return respond(429)

  if (Number(request.headers.get('Content-Length')) > MAX_BODY_LENGTH) return respond(413)
  const body = await readCapped(request, MAX_BODY_LENGTH)
  if (body === null) return respond(413)

  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return respond(400)
  }
  const result = v.safeParse(EventSchema, json)
  if (!result.success) return respond(400)

  const { success } = await env.LIMITER.limit({ key: `install:${result.output.installId}` })
  if (!success) return respond(429)

  env.EVENTS.writeDataPoint(toDataPoint(result.output))
  return respond(204)
}
