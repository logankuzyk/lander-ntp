import { once } from 'node:events'
import { connect } from 'node:net'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'

import { startServer } from './main.js'

describe('startServer shutdown', () => {
  it.each(['SIGTERM', 'SIGINT'] as const)(
    'force-closes a stalled connection and closes the database after %s',
    async (signal) => {
      const db = new DatabaseSync(':memory:')
      const server = await startServer({
        config: {
          authSecret: 'a'.repeat(32),
          databasePath: ':memory:',
          nodeEnv: 'test',
          port: 0,
          trustAnyExtensionOrigin: false,
          trustedExtensionIds: ['ocglhjclnhfbgbccffinhioaangigioa'],
        },
        db,
        shutdownTimeoutMs: 25,
      })

      await once(server, 'listening')
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('Expected a TCP listener')

      // The request line and headers never finish, so Node counts the connection as busy and only
      // the forced close at the end of the shutdown timeout can end it.
      const received = once(server, 'connection')
      const socket = connect(address.port, '127.0.0.1')
      socket.on('error', () => undefined)
      const socketClosed = once(socket, 'close')
      socket.write('POST /health HTTP/1.1\r\nHost: x\r\nContent-Length: 100\r\n')
      await received
      // Give the server a moment to read the partial headers, after which the connection is busy.
      await new Promise((resolve) => setTimeout(resolve, 50))

      try {
        process.emit(signal)
        await socketClosed
        expect(db.isOpen).toBe(false)
      } finally {
        server.closeAllConnections()
        if (db.isOpen) db.close()
      }
    },
  )
})
