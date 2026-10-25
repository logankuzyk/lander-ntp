import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { storage } from 'wxt/utils/storage'

import { defineGuardedItem, NewerVersionError, versionOf } from './guard'

describe('versionOf', () => {
  it('counts a stored value with no `v` as version 1, so what v0.2.3 wrote reads as 1', () => {
    expect(versionOf({ font: 'system' })).toBe(1)
    expect(versionOf(null)).toBe(1)
    expect(versionOf(undefined)).toBe(1)
  })

  it('reads a whole number of at least 1', () => {
    expect(versionOf({ v: 1 })).toBe(1)
    expect(versionOf({ v: 2 })).toBe(2)
    expect(versionOf({ v: 40 })).toBe(40)
  })

  it.each([0, -1, 1.5, '2', null, true, Number.NaN, Number.POSITIVE_INFINITY, {}, [2]])(
    'calls %j unreadable',
    (v) => {
      expect(versionOf({ v })).toBe('unreadable')
    },
  )
})

type Thing = { name: string; v: 1 }

const FALLBACK: Thing = { name: 'fallback', v: 1 }

/** A guarded item over the fake browser's sync area, keeping `name` and stamping `v: 1`. */
const thing = () =>
  defineGuardedItem<Thing>({
    check: (raw) => {
      const name = (raw as { name?: unknown } | null)?.name
      return typeof name === 'string' ? { ...(raw as Thing), v: 1 } : FALLBACK
    },
    fallback: FALLBACK,
    key: 'sync:thing',
    version: 1,
  })

afterEach(() => vi.restoreAllMocks())

/** What is in the sync area, as the browser holds it. */
const stored = async () => (await fakeBrowser.storage.sync.get('thing')).thing

describe('defineGuardedItem', () => {
  it('reads the fallback when nothing is stored, and a stored value as not newer', async () => {
    const item = thing()
    expect(await item.read()).toEqual({ newer: false, value: FALLBACK })

    await fakeBrowser.storage.sync.set({ thing: { name: 'stored' } })

    expect(await item.read()).toEqual({ newer: false, value: { name: 'stored', v: 1 } })
  })

  it('reads a value with a higher `v` as newer', async () => {
    await fakeBrowser.storage.sync.set({ thing: { name: 'stored', v: 2 } })

    const { newer, value } = await thing().read()

    expect(newer).toBe(true)
    expect(value.name).toBe('stored')
  })

  it.each([0, 1.5, '2', null])(
    'reads a `v` of %j as newer, as it cannot be told apart',
    async (v) => {
      await fakeBrowser.storage.sync.set({ thing: { name: 'stored', v } })

      expect((await thing().read()).newer).toBe(true)
    },
  )

  it('writes over a value of the version it knows, and over a value with no version', async () => {
    const item = thing()
    await fakeBrowser.storage.sync.set({ thing: { name: 'from v0.2.3' } })

    await item.write({ name: 'one', v: 1 })
    expect(await stored()).toEqual({ name: 'one', v: 1 })

    await item.write({ name: 'two', v: 1 })
    expect(await stored()).toEqual({ name: 'two', v: 1 })
  })

  it('refuses to write over a newer value, and leaves it as it is', async () => {
    const newer = { name: 'from the future', v: 2 }
    await fakeBrowser.storage.sync.set({ thing: newer })
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    await expect(thing().write({ name: 'mine', v: 1 })).rejects.toBeInstanceOf(NewerVersionError)

    expect(set).not.toHaveBeenCalled()
    expect(await stored()).toEqual(newer)
  })

  it('refuses a value it cannot read the version of', async () => {
    await fakeBrowser.storage.sync.set({ thing: { name: 'odd', v: 'two' } })

    await expect(thing().write({ name: 'mine', v: 1 })).rejects.toBeInstanceOf(NewerVersionError)

    expect(await stored()).toEqual({ name: 'odd', v: 'two' })
  })

  it('looks again at write time: a newer value that arrived after the read is not overwritten', async () => {
    const item = thing()
    await fakeBrowser.storage.sync.set({ thing: { name: 'old', v: 1 } })
    expect((await item.read()).newer).toBe(false)

    // Another device syncs a newer version in, after this one has read and before it writes.
    await fakeBrowser.storage.sync.set({ thing: { name: 'arrived', v: 2 } })
    await expect(item.write({ name: 'mine', v: 1 })).rejects.toBeInstanceOf(NewerVersionError)

    expect(await stored()).toEqual({ name: 'arrived', v: 2 })
  })

  it('tells a watcher what arrived, and whether it is newer', async () => {
    const item = thing()
    const seen: unknown[] = []
    const unwatch = item.watch((read) => seen.push(read))

    await storage.setItem('sync:thing', { name: 'a' })
    await storage.setItem('sync:thing', { name: 'b', v: 2 })
    await storage.removeItem('sync:thing')
    unwatch()

    expect(seen).toEqual([
      { newer: false, value: { name: 'a', v: 1 } },
      { newer: true, value: { name: 'b', v: 1 } },
      null,
    ])
  })
})
