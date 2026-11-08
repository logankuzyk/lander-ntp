import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'

import { Devices, parseUserAgent } from './devices.js'

const databases: DatabaseSync[] = []
const now = new Date('2026-01-01T00:00:00.000Z')

function makeDevices() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  db.exec(`
    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      token TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      userAgent TEXT,
      ipAddress TEXT
    )
  `)
  return { db, devices: new Devices(db, { now: () => now }) }
}

function addSession(db: DatabaseSync, id: string, userId = 'user-1') {
  db.prepare(
    `
    INSERT INTO session (id, userId, token, expiresAt, createdAt, updatedAt, userAgent, ipAddress)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `,
  ).run(
    id,
    userId,
    `token-${id}`,
    new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    now.toISOString(),
    now.toISOString(),
    'Mozilla/5.0 Chrome/120.0.0.0',
  )
}

function addExpiredSession(db: DatabaseSync, id: string, userId = 'user-1') {
  const expired = new Date(now.getTime() - 1).toISOString()
  db.prepare(
    `
    INSERT INTO session (id, userId, token, expiresAt, createdAt, updatedAt, userAgent, ipAddress)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `,
  ).run(id, userId, `token-${id}`, expired, expired, expired, null)
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})

describe('Devices', () => {
  it('marks a fourth session pending and lists the first three as active', () => {
    const { db, devices } = makeDevices()
    for (const id of ['one', 'two', 'three']) {
      addSession(db, id)
      expect(devices.admit('user-1', id)).toBe(false)
    }
    addSession(db, 'four')

    expect(devices.admit('user-1', 'four')).toBe(true)
    expect(devices.list('user-1', 'four')).toMatchObject({
      devices: [
        { current: true, id: 'four' },
        { current: false, id: 'one' },
        { current: false, id: 'three' },
        { current: false, id: 'two' },
      ],
      pending: true,
    })
  })

  it('does not count expired sessions or sessions belonging to another account', () => {
    const { db, devices } = makeDevices()
    addExpiredSession(db, 'expired')
    for (const id of ['one', 'two']) addSession(db, id)
    for (const id of ['other-one', 'other-two', 'other-three']) addSession(db, id, 'other-user')
    addSession(db, 'current')

    expect(devices.admit('user-1', 'current')).toBe(false)
  })

  it('keeps a pending session for fifteen minutes, then removes it', () => {
    let currentTime = now
    const db = new DatabaseSync(':memory:')
    databases.push(db)
    db.exec(`
      CREATE TABLE session (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        token TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        userAgent TEXT,
        ipAddress TEXT
      )
    `)
    const devices = new Devices(db, { now: () => currentTime })
    for (const id of ['one', 'two', 'three']) addSession(db, id)
    for (const id of ['one', 'two', 'three']) devices.admit('user-1', id)
    addSession(db, 'four')
    expect(devices.admit('user-1', 'four')).toBe(true)
    currentTime = new Date(now.getTime() + 15 * 60 * 1000 + 1)

    expect(devices.list('user-1', 'four')).toMatchObject({
      devices: expect.not.arrayContaining([expect.objectContaining({ id: 'four' })]),
      pending: false,
    })
  })

  it('removing a device from a pending session admits that session', () => {
    const { db, devices } = makeDevices()
    for (const id of ['one', 'two', 'three']) addSession(db, id)
    for (const id of ['one', 'two', 'three']) devices.admit('user-1', id)
    addSession(db, 'four')
    expect(devices.admit('user-1', 'four')).toBe(true)

    expect(devices.remove('user-1', 'one', 'four')).toBe(true)
    expect(devices.list('user-1', 'four').pending).toBe(false)
  })

  it('does not remove a device from another account', () => {
    const { db, devices } = makeDevices()
    addSession(db, 'mine')
    addSession(db, 'theirs', 'other-user')

    expect(devices.remove('user-1', 'theirs', 'mine')).toBe(false)
    expect(devices.list('other-user', 'theirs').devices).toHaveLength(1)
  })

  it('keeps the reviewer admitted by removing the oldest session', () => {
    const { db, devices } = makeDevices()
    for (const id of ['one', 'two', 'three']) addSession(db, id)
    for (const id of ['one', 'two', 'three']) devices.admit('user-1', id)
    addSession(db, 'reviewer')

    expect(devices.admit('user-1', 'reviewer', true)).toBe(false)
    expect(devices.list('user-1', 'reviewer')).toMatchObject({
      devices: [
        { current: true, id: 'reviewer' },
        { current: false, id: 'three' },
        { current: false, id: 'two' },
      ],
      pending: false,
    })
  })

  it.each([
    [
      'Chrome Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      'Chrome',
      'Windows',
    ],
    [
      'Edge macOS',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Edg/120.0.0.0',
      'Edge',
      'macOS',
    ],
    [
      'Firefox Linux',
      'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Firefox/120.0',
      'Firefox',
      'Linux',
    ],
    ['Chrome Android', 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0', 'Chrome', 'Android'],
    ['ChromeOS', 'Mozilla/5.0 (X11; CrOS x86_64 15662.0.0) Chrome/120.0.0.0', 'Chrome', 'ChromeOS'],
    ['unknown', 'unrecognized agent', 'Unknown', 'Unknown'],
  ])('reduces %s user agents', (_name, value, browser, os) => {
    expect(parseUserAgent(value)).toEqual({ browser, os })
  })
})
