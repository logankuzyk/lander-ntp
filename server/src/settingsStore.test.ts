import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'

import { SettingsStore } from './settingsStore.js'

const databases: DatabaseSync[] = []

function makeStore() {
  const db = new DatabaseSync(':memory:')
  databases.push(db)
  db.exec('CREATE TABLE user (id TEXT PRIMARY KEY)')
  db.prepare('INSERT INTO user (id) VALUES (?)').run('account-a')
  return new SettingsStore(db, { now: () => new Date('2026-01-01T00:00:00.000Z') })
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close()
})

describe('SettingsStore', () => {
  it('keeps a 0.2.3 settings document for its account', () => {
    const store = makeStore()
    const settings = {
      clock: { enabled: true, hour12: false, showDate: false, showSeconds: false },
      dim: true,
      font: 'system',
      photos: { frequency: 'every-visit', mode: 'cycle', pinnedId: null, tags: [] },
      weather: {
        enabled: false,
        fields: [
          { id: 'highLow', shown: true },
          { id: 'location', shown: false },
          { id: 'sun', shown: false },
          { id: 'condition', shown: false },
          { id: 'feelsLike', shown: false },
        ],
        followDevice: false,
        place: null,
        unit: 'celsius',
      },
    }

    expect(store.put('account-a', 'settings', settings)).toEqual({
      changed: true,
      rev: 1,
      saved: { v: 1, value: settings },
    })
    expect(store.get('account-a')).toEqual({
      items: { settings: { v: 1, value: settings } },
      rev: 1,
    })
  })

  it('keeps layouts with widget types the server does not know', () => {
    const store = makeStore()
    const layout = { v: 1, widgets: [{ options: { preserved: true }, type: 'future-widget' }] }

    expect(store.put('account-a', 'layout', layout)).toMatchObject({
      changed: true,
      saved: { v: 1, value: layout },
    })
  })

  it('uses version 1 when a layout omits its version', () => {
    const store = makeStore()
    const layout = { widgets: [{ options: {}, type: 'clock' }] }

    expect(store.put('account-a', 'layout', layout)).toMatchObject({
      saved: { v: 1, value: layout },
    })
  })

  it('accepts an item of exactly 8,192 UTF-8 bytes and rejects 8,193', () => {
    const store = makeStore()
    const prefix = '{"v":1,"data":"'
    const suffix = '"}'
    const fill = 'x'.repeat(8192 - 'layout'.length - prefix.length - suffix.length)

    expect(store.put('account-a', 'layout', { data: fill, v: 1 })).not.toBe('too_large')
    expect(store.put('account-a', 'layout', { data: `${fill}x`, v: 1 })).toBe('too_large')
  })

  it('does not raise the account revision for identical content', () => {
    const store = makeStore()
    const onboarding = { dismissed: [], welcomed: false }

    expect(store.put('account-a', 'onboarding', onboarding)).toMatchObject({ rev: 1 })
    expect(store.put('account-a', 'onboarding', onboarding)).toMatchObject({
      changed: false,
      rev: 1,
    })
  })

  it('rejects unknown items and values outside the shared shape', () => {
    const store = makeStore()

    expect(store.put('account-a', 'not-an-item', {})).toBe('unknown_item')
    expect(store.put('account-a', 'settings', { clock: 'not settings' })).toBe('invalid')
  })

  it('refuses a lower item version and leaves the stored version intact', () => {
    const store = makeStore()

    expect(store.put('account-a', 'layout', { v: 2, widgets: [] })).toMatchObject({
      changed: true,
      saved: { v: 2 },
    })
    expect(store.put('account-a', 'layout', { v: 1, widgets: [] })).toBe('older_version')
    expect(store.get('account-a').items.layout).toEqual({ v: 2, value: { v: 2, widgets: [] } })
  })

  it('updates account activity at most once an hour', () => {
    let now = new Date('2026-01-01T00:00:00.000Z')
    const db = new DatabaseSync(':memory:')
    databases.push(db)
    db.exec('CREATE TABLE user (id TEXT PRIMARY KEY)')
    db.prepare('INSERT INTO user (id) VALUES (?)').run('account-a')
    const store = new SettingsStore(db, { now: () => now })
    const lastUsed = () =>
      (
        db
          .prepare('SELECT last_used_at FROM settings_account WHERE user_id = ?')
          .get('account-a') as { last_used_at: number | null } | undefined
      )?.last_used_at

    store.touch('account-a', now)
    expect(lastUsed()).toBe(now.getTime())
    now = new Date(now.getTime() + 30 * 60 * 1000)
    store.touch('account-a', now)
    expect(lastUsed()).toBe(new Date('2026-01-01T00:00:00.000Z').getTime())
    now = new Date('2026-01-01T01:00:00.000Z')
    store.touch('account-a', now)
    expect(lastUsed()).toBe(now.getTime())
  })
})
