import { describe, expect, it, vi } from 'vitest'

import { pingHeartbeat } from './heartbeat.js'

describe('pingHeartbeat', () => {
  it('passes the abort signal to the injected request', async () => {
    const controller = new AbortController()
    const request = vi.fn(async () => new Response(null, { status: 204 }))

    await pingHeartbeat('https://monitor.invalid/ping', controller.signal, request)

    expect(request).toHaveBeenCalledWith('https://monitor.invalid/ping', {
      signal: controller.signal,
    })
  })
})
