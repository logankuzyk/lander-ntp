import { beforeEach, describe, expect, it, vi } from 'vitest'

import { handle, MAX_BODY_LENGTH } from './handler'

const writeDataPoint = vi.fn()
const limit = vi.fn()
const env = { LANDER_NTP_EVENTS: { writeDataPoint }, LIMITER: { limit } } as unknown as Env

const INSTALL_ID = '6f1c1b0e-8d5f-4c1a-9b8e-2a7c3d4e5f60'

const heartbeat = {
  event: 'heartbeat',
  installId: INSTALL_ID,
  version: '0.2.0',
  browser: 'firefox',
  props: {
    photos: { mode: 'cycle', frequency: 'every-visit', tags: 2 },
    font: 'geist',
    dim: true,
    clock: { enabled: true, hour12: false, showDate: true, showSeconds: false },
  },
}

const post = (body: unknown, init: RequestInit = {}) =>
  handle(
    new Request('https://ntp.logankuzyk.com/events', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
      ...init,
    }),
    env,
  )

beforeEach(() => {
  writeDataPoint.mockReset()
  limit.mockReset().mockResolvedValue({ success: true })
})

describe('POST /events', () => {
  it('writes a heartbeat to Analytics Engine, one column per setting', async () => {
    const response = await post(heartbeat)

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: [INSTALL_ID],
      blobs: ['heartbeat', 'firefox', '0.2.0', 'cycle', 'every-visit', 'geist'],
      doubles: [1, 1, 0, 1, 0, 2],
    })
  })

  it('rate-limits by install id', async () => {
    limit.mockResolvedValueOnce({ success: false })

    expect((await post(heartbeat)).status).toBe(429)
    expect(limit).toHaveBeenCalledWith({ key: `install:${INSTALL_ID}` })
    expect(writeDataPoint).not.toHaveBeenCalled()
  })

  it('rate-limits by IP too, so a fresh install id per request gets around nothing', async () => {
    limit.mockResolvedValueOnce({ success: false })

    const response = await post(heartbeat, {
      headers: { 'Content-Type': 'text/plain', 'CF-Connecting-IP': '203.0.113.7' },
    })

    expect(response.status).toBe(429)
    expect(limit).toHaveBeenCalledTimes(1)
    expect(limit).toHaveBeenCalledWith({ key: 'ip:203.0.113.7' })
    expect(writeDataPoint).not.toHaveBeenCalled()
  })

  it('never writes the IP it rate-limits on', async () => {
    await post(heartbeat, {
      headers: { 'Content-Type': 'text/plain', 'CF-Connecting-IP': '203.0.113.7' },
    })

    expect(limit).toHaveBeenCalledTimes(2)
    expect(writeDataPoint).toHaveBeenCalledOnce()
    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain('203.0.113.7')
  })

  it('drops keys the schema does not name', async () => {
    await post({ ...heartbeat, props: { ...heartbeat.props, url: 'https://example.com' } })

    expect(JSON.stringify(writeDataPoint.mock.calls)).not.toContain('example.com')
  })

  it.each([
    ['malformed JSON', '{'],
    ['an unknown event', { ...heartbeat, event: 'page_view' }],
    ['a made-up install id', { ...heartbeat, installId: 'me' }],
    ['an unknown browser', { ...heartbeat, browser: 'netscape' }],
    ['a missing setting', { ...heartbeat, props: { ...heartbeat.props, dim: undefined } }],
    ['an oversized value', { ...heartbeat, props: { ...heartbeat.props, font: 'x'.repeat(100) } }],
    [
      'a negative tag count',
      {
        ...heartbeat,
        props: { ...heartbeat.props, photos: { ...heartbeat.props.photos, tags: -1 } },
      },
    ],
  ])('rejects %s', async (_, body) => {
    expect((await post(body)).status).toBe(400)
    expect(writeDataPoint).not.toHaveBeenCalled()
  })

  it('refuses an oversized body before reading it', async () => {
    const response = await post(heartbeat, {
      headers: { 'Content-Length': String(MAX_BODY_LENGTH + 1) },
    })

    expect(response.status).toBe(413)
  })

  it('refuses an oversized body that does not say how big it is', async () => {
    expect((await post('x'.repeat(MAX_BODY_LENGTH + 1))).status).toBe(413)
  })

  it('stops reading a streamed body once it is too big', async () => {
    let pulled = 0
    const chunk = new TextEncoder().encode('x'.repeat(1024))
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++
        controller.enqueue(chunk)
      },
    })

    const response = await post('', { body, duplex: 'half' } as RequestInit)

    expect(response.status).toBe(413)
    expect(pulled).toBeLessThanOrEqual(MAX_BODY_LENGTH / chunk.byteLength + 2)
  })

  it('counts bytes rather than characters', async () => {
    const padded = { ...heartbeat, pad: 'é'.repeat(MAX_BODY_LENGTH / 2) }

    expect((await post(padded)).status).toBe(413)
  })
})

describe('other requests', () => {
  it('answers the CORS preflight', async () => {
    const response = await handle(
      new Request('https://ntp.logankuzyk.com/events', { method: 'OPTIONS' }),
      env,
    )

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST')
  })

  it('only takes POST', async () => {
    const response = await handle(new Request('https://ntp.logankuzyk.com/events'), env)

    expect(response.status).toBe(405)
  })

  it('has nothing anywhere else', async () => {
    const response = await handle(new Request('https://ntp.logankuzyk.com/'), env)

    expect(response.status).toBe(404)
  })
})
