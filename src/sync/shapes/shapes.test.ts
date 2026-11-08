// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { itemBytes, syncedShapes } from './index'

describe('synced stored shapes', () => {
  it('checks settings stored by 0.2.3 and treats the missing version as 1', () => {
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

    expect(syncedShapes.settings.check(settings)).toEqual({ ok: true, v: 1 })
  })

  it('accepts unknown settings and onboarding keys so they can be kept', () => {
    const settings = {
      clock: { enabled: true, hour12: false, showDate: false, showSeconds: false },
      dim: true,
      font: 'system',
      futureSetting: { preserved: true },
      photos: { frequency: 'every-visit', mode: 'cycle', pinnedId: null, tags: [] },
    }

    expect(syncedShapes.settings.check(settings)).toEqual({ ok: true, v: 1 })
    expect(
      syncedShapes.onboarding.check({ dismissed: [], futureCallout: 2, welcomed: true }),
    ).toEqual({
      ok: true,
      v: 1,
    })
  })

  it('checks Layout shape without inspecting Widget options and keeps unknown fields', () => {
    expect(
      syncedShapes.layout.check({
        futureLayoutField: { kept: true },
        v: 1,
        widgets: [{ id: 'one', options: 'opaque future options', type: 'future-widget' }],
      }),
    ).toEqual({ ok: true, v: 1 })
  })

  it('rejects an unreadable or newer Layout shape', () => {
    expect(syncedShapes.layout.check({ v: 1 })).toEqual({ ok: false })
    expect(syncedShapes.layout.check({ v: 2, widgets: [] })).toEqual({ ok: false })
  })

  it('rejects values outside the current shape', () => {
    expect(syncedShapes.settings.check({ photos: 'anything' })).toEqual({ ok: false })
    expect(syncedShapes.onboarding.check({ dismissed: 'none', welcomed: true })).toEqual({
      ok: false,
    })
  })

  it('rejects versions this extension cannot read', () => {
    const settings = {
      clock: { enabled: true, hour12: false, showDate: false, showSeconds: false },
      dim: true,
      font: 'system',
      photos: { frequency: 'every-visit', mode: 'cycle', pinnedId: null, tags: [] },
    }

    expect(syncedShapes.settings.check({ ...settings, v: 2 })).toEqual({ ok: false })
    expect(syncedShapes.onboarding.check({ dismissed: [], v: 2, welcomed: true })).toEqual({
      ok: false,
    })
    expect(syncedShapes.settings.check({ ...settings, v: 0 })).toEqual({ ok: false })
    expect(syncedShapes.settings.check({ ...settings, v: 1.5 })).toEqual({ ok: false })
  })

  it('counts UTF-8 bytes for a place name in the serialized item', () => {
    const item = { place: 'Québec' }
    expect(itemBytes('settings', item)).toBe(
      8 + new TextEncoder().encode(JSON.stringify(item)).byteLength,
    )
  })
})
