import { once } from 'node:events'
import { request as httpRequest } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'

import { startServer } from './main.js'

describe('startServer shutdown', () => {
  it.each(['SIGTERM', 'SIGINT'] as const)(
    'closes an in-flight request and database after %s',
    async (signal) => {
      const db = new DatabaseSync(':memory:')
      const server = startServer({
        config: {
          authSecret: 'a'.repeat(32),
          databasePath: ':memory:',
          nodeEnv: 'test',
          port: 0,
          trustAnyExtensionOrigin: false,
        },
        db,
        shutdownTimeoutMs: 25,
      })

      await once(server, 'listening')
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('Expected a TCP listener')

      const receivedRequest = once(server, 'request')
      const request = httpRequest({
        headers: { 'content-length': '100' },
        hostname: '127.0.0.1',
        method: 'POST',
        path: '/health',
        port: address.port,
      })
      request.on('error', () => undefined)
      const requestClosed = once(request, 'close')
      request.write('partial')
      await receivedRequest

      try {
        process.emit(signal)
        await requestClosed
        expect(db.isOpen).toBe(false)
      } finally {
        server.closeAllConnections()
        if (db.isOpen) db.close()
      }
    },
  )
})
