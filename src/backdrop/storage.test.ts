import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { backgroundItem, checkBackground, DEFAULT_BACKGROUND, displayKind } from './storage'

describe('the background choice', () => {
  beforeEach(async () => {
    await fakeBrowser.storage.sync.clear()
  })

  it('uses photos when no choice has been saved and does not write on load', async () => {
    expect(await backgroundItem.read()).toEqual({ newer: false, value: DEFAULT_BACKGROUND })
    expect(DEFAULT_BACKGROUND.kind).toBe('photo')
    expect(DEFAULT_BACKGROUND.favouritesOnly).toBe(false)
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({})
  })

  it('keeps unknown keys and draws an unknown kind as photos', () => {
    expect(
      checkBackground({ colour: '#123456', extra: 4, favouritesOnly: false, kind: 'future', v: 1 }),
    ).toEqual({
      colour: '#123456',
      extra: 4,
      favouritesOnly: false,
      kind: 'future',
      v: 1,
    })
    expect(
      displayKind(
        checkBackground({ colour: '#123456', favouritesOnly: false, kind: 'future', v: 1 }),
      ),
    ).toBe('photo')
    expect(
      displayKind(
        checkBackground({ colour: '#123456', favouritesOnly: false, kind: 'colour', v: 1 }),
      ),
    ).toBe('colour')
  })

  it('uses the first colour preset when the stored colour is unreadable', () => {
    expect(
      checkBackground({ colour: 'red', favouritesOnly: false, kind: 'colour', v: 1 }),
    ).toMatchObject({
      colour: expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
      kind: 'colour',
    })
  })

  it('reads malformed and partial data with safe defaults', () => {
    expect(checkBackground('broken')).toEqual(DEFAULT_BACKGROUND)
    expect(checkBackground({ future: 1, kind: 'colour', v: 1 })).toEqual({
      ...DEFAULT_BACKGROUND,
      future: 1,
      kind: 'colour',
    })
  })

  it('marks newer and unreadable versions read-only and refuses writes', async () => {
    for (const raw of [
      { colour: '#123456', favouritesOnly: false, future: true, kind: 'photo', v: 2 },
      { colour: '#123456', favouritesOnly: false, kind: 'photo', v: 'later' },
    ]) {
      await fakeBrowser.storage.sync.set({ background: raw })
      expect((await backgroundItem.read()).newer).toBe(true)
      await expect(backgroundItem.setValue(DEFAULT_BACKGROUND)).rejects.toThrow()
      expect((await fakeBrowser.storage.sync.get('background')).background).toEqual(raw)
    }
  })

  it.each([
    { colour: '#123456', favouritesOnly: false, v: 1 },
    { colour: '#123456', favouritesOnly: false, kind: 7, v: 1 },
  ])(
    'marks a background with no readable kind read-only and preserves it on write',
    async (raw) => {
      await fakeBrowser.storage.sync.set({ background: raw })

      expect((await backgroundItem.read()).newer).toBe(true)
      await expect(backgroundItem.setValue(DEFAULT_BACKGROUND)).rejects.toThrow()
      expect((await fakeBrowser.storage.sync.get('background')).background).toEqual(raw)
    },
  )
})
