import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { layoutItem } from '@/layout/storage'

import { commitPulledItem } from './commit'

describe('committing an item pulled from the account', () => {
  beforeEach(async () => {
    await fakeBrowser.reset()
  })

  it('writes a pulled Layout through its guarded item and leaves settings alone', async () => {
    const layout = { futureLayoutField: { kept: true }, v: 1, widgets: [] }

    await commitPulledItem('layout', layout)

    expect(await fakeBrowser.storage.sync.get(null)).toEqual({
      layout: { futureLayoutField: { kept: true }, v: 1, widgets: [] },
    })
    expect(await layoutItem.getValue()).toMatchObject({
      extra: { futureLayoutField: { kept: true } },
      widgets: [],
    })
  })

  it('keeps a newer pulled Layout version in storage and makes it read-only', async () => {
    const layout = { futureLayoutField: { kept: true }, v: 2, widgets: [] }

    await commitPulledItem('layout', layout)

    expect(await fakeBrowser.storage.sync.get(null)).toEqual({ layout })
    expect(await layoutItem.read()).toMatchObject({ newer: true })
  })

  it('reports a guarded conflict with a newer local Layout as refused', async () => {
    await fakeBrowser.storage.sync.set({ layout: { v: 2, widgets: [] } })

    await expect(commitPulledItem('layout', { v: 1, widgets: [] })).resolves.toBe('refused')
    expect(await fakeBrowser.storage.sync.get('layout')).toEqual({ layout: { v: 2, widgets: [] } })
  })

  it('refuses an unreadable pulled Layout without writing it', async () => {
    await expect(commitPulledItem('layout', { v: 1, widgets: 'not a list' })).resolves.toBe(
      'refused',
    )
    expect(await fakeBrowser.storage.sync.get('layout')).toEqual({})
  })
})
