import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { recordInstall } from '@/onboarding/install'
import { type Onboarding, onboardingItem } from '@/onboarding/storage'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'

import { asV023, saveLikeV023 } from './compat'

/** What a v0.2.3 device wrote: the shape the frozen reader accepts as it stands. */
const SETTINGS_0_2_3 = {
  clock: { enabled: true, hour12: false, showDate: true, showSeconds: false },
  dim: false,
  font: 'geist',
  photos: { frequency: '1h', mode: 'pinned', pinnedId: 'p1', tags: ['coast'] },
  weather: {
    enabled: true,
    fields: [
      { id: 'highLow', shown: true },
      { id: 'location', shown: true },
      { id: 'sun', shown: false },
      { id: 'condition', shown: true },
      { id: 'feelsLike', shown: false },
    ],
    followDevice: false,
    place: { latitude: 48.4284, longitude: -123.3656, name: 'Victoria' },
    unit: 'celsius',
  },
}

describe('the frozen v0.2.3 reader (the four cases LR-15 ran)', () => {
  it('reads settings that carry a top-level `v` unchanged', async () => {
    const proposed = { ...SETTINGS_0_2_3, v: 1 }

    const { fellBack, settings } = await asV023({ settings: proposed })

    expect(fellBack).toBe(false)
    expect(settings).toEqual(proposed)
  })

  it('keeps `v` when v0.2.3 saves a change of its own', async () => {
    const after = await saveLikeV023({ settings: { ...SETTINGS_0_2_3, v: 1 } }, { font: 'system' })

    expect(after.settings).toEqual({ ...SETTINGS_0_2_3, font: 'system', v: 1 })
  })

  it('falls back to the defaults when `clock` is missing', async () => {
    const withoutClock = Object.fromEntries(
      Object.entries(SETTINGS_0_2_3).filter(([key]) => key !== 'clock'),
    )

    const { fellBack, settings } = await asV023({ settings: withoutClock })

    expect(fellBack).toBe(true)
    expect(settings.clock.enabled).toBe(true)
    expect(settings.font).toBe('system')
  })

  it('falls back to the defaults for a `weather.unit` it does not know', async () => {
    const kelvin = { ...SETTINGS_0_2_3, weather: { ...SETTINGS_0_2_3.weather, unit: 'kelvin' } }

    const { fellBack, settings } = await asV023({ settings: kelvin })

    expect(fellBack).toBe(true)
    expect(settings.weather.enabled).toBe(false)
    expect(settings.font).toBe('system')
  })

  it('drops a key added inside `clock` without falling back', async () => {
    const extra = { ...SETTINGS_0_2_3, clock: { ...SETTINGS_0_2_3.clock, layoutHint: 'x' } }

    const { fellBack, settings } = await asV023({ settings: extra })

    expect(fellBack).toBe(false)
    expect(settings.clock).toEqual(SETTINGS_0_2_3.clock)
    expect(settings.font).toBe('geist')
  })
})

/**
 * What a device on the real, current code has stored before a row's write: not the defaults, so
 * that a write which resets the photo, the font or the dim shows up.
 */
const SEED: Settings = {
  ...DEFAULT_SETTINGS,
  dim: false,
  font: 'geist',
  photos: { frequency: '1h', mode: 'pinned', pinnedId: 'p1', tags: ['coast'] },
}

const SEED_ONBOARDING: Onboarding = { dismissed: ['weather'], welcomed: false }

/** Something both a person and the reader can tell a place from the defaults by. */
const VICTORIA = { latitude: 48.4284, longitude: -123.3656, name: 'Victoria' }

const changeSettings = (change: (settings: Settings) => Settings) => async () =>
  settingsItem.setValue(change(await settingsItem.getValue()))

const changeOnboarding = (change: (record: Onboarding) => Onboarding) => async () =>
  onboardingItem.setValue(change((await onboardingItem.getValue()) ?? SEED_ONBOARDING))

type PhaseTwoWrite = {
  /**
   * What photos, font and dim hold afterwards where the write changes them; whatever it does
   * not name must still be what SEED has.
   */
  changes?: Partial<Pick<Settings, 'dim' | 'font' | 'photos'>>
  name: string
  /** The write, made through the real storage items, as the page makes it. */
  write: () => Promise<void>
}

/**
 * Every write the extension can make to `sync:settings` and `sync:onboarding`, replayed through
 * the real items and read back through the frozen v0.2.3 reader. This is the standing guard
 * against resetting a device that is still on v0.2.3 (LR-15).
 *
 * What phase 2 may write to `sync:settings` is only the top-level `v: 1`, `clock.hour12`, and
 * what v0.2.3 already writes (photos, dim, font, as the panel does now). It never removes a
 * block, never gives a value v0.2.3 does not know, never adds a key inside a block. Removing a
 * Clock writes only `sync:layout`; it never writes `clock.enabled`. `sync:onboarding` only gains
 * ids in `dismissed`. `sync:layout` is not here: v0.2.3 never reads it (its own row arrives
 * with the PR that adds it).
 *
 * A PR that adds a write adds a row here, in the same change.
 */
const PHASE_2_WRITES: PhaseTwoWrite[] = [
  {
    changes: { photos: { ...SEED.photos, frequency: '6h', mode: 'cycle' } },
    name: 'choose how often photos change',
    write: changeSettings((s) => ({
      ...s,
      photos: { ...s.photos, frequency: '6h', mode: 'cycle' },
    })),
  },
  {
    changes: { photos: { ...SEED.photos, mode: 'pinned', pinnedId: 'p2' } },
    name: 'pin a photo (from the gallery, or the arrow while pinned)',
    write: changeSettings((s) => ({
      ...s,
      photos: { ...s.photos, mode: 'pinned', pinnedId: 'p2' },
    })),
  },
  {
    changes: { photos: { ...SEED.photos, mode: 'cycle' } },
    name: 'resume cycling',
    write: changeSettings((s) => ({ ...s, photos: { ...s.photos, mode: 'cycle' } })),
  },
  {
    changes: { photos: { ...SEED.photos, tags: ['city', 'coast'] } },
    name: 'filter photos by tag',
    write: changeSettings((s) => ({ ...s, photos: { ...s.photos, tags: ['city', 'coast'] } })),
  },
  {
    changes: { dim: true },
    name: 'turn the dimming on',
    write: changeSettings((s) => ({ ...s, dim: true })),
  },
  {
    changes: { font: 'instrument-serif' },
    name: 'choose a font',
    write: changeSettings((s) => ({ ...s, font: 'instrument-serif' })),
  },
  {
    name: 'switch the clock to 24-hour time (clock.hour12)',
    write: changeSettings((s) => ({ ...s, clock: { ...s.clock, hour12: !s.clock.hour12 } })),
  },
  {
    name: 'switch the clock off (settings panel until the Clock moves to the page)',
    write: changeSettings((s) => ({ ...s, clock: { ...s.clock, enabled: false } })),
  },
  {
    name: 'show the date and seconds on the clock (settings panel)',
    write: changeSettings((s) => ({
      ...s,
      clock: { ...s.clock, showDate: true, showSeconds: true },
    })),
  },
  {
    name: 'switch the weather on at a place (settings panel)',
    write: changeSettings((s) => ({
      ...s,
      weather: { ...s.weather, enabled: true, place: VICTORIA },
    })),
  },
  {
    name: 'follow the device, and choose the unit and lines (settings panel)',
    write: changeSettings((s) => ({
      ...s,
      weather: {
        ...s.weather,
        fields: s.weather.fields.map((field) => ({ ...field, shown: field.id !== 'sun' })),
        followDevice: true,
        unit: 'fahrenheit',
      },
    })),
  },
  {
    name: 'answer the welcome',
    write: changeOnboarding((record) => ({ ...record, welcomed: true })),
  },
  {
    name: 'dismiss a callout (an id gained in `dismissed`)',
    write: changeOnboarding((record) => ({
      ...record,
      dismissed: [...record.dismissed, 'a-later-callout'],
    })),
  },
  {
    name: 'record an update from a version that kept no record',
    write: async () => {
      await fakeBrowser.storage.sync.remove('onboarding')
      await recordInstall('update')
    },
  },
]

describe('what phase 2 may write, read by the frozen v0.2.3 reader', () => {
  beforeEach(async () => {
    await settingsItem.setValue(SEED)
    await onboardingItem.setValue(SEED_ONBOARDING)
  })

  it.each(PHASE_2_WRITES)('$name', async ({ changes, write }) => {
    await write()
    const stored = await fakeBrowser.storage.sync.get(null)

    const { fellBack, onboarding, settings } = await asV023(stored)

    expect(fellBack).toBe(false)
    // Photos, font and dim survive: the new ones where the write changed them, else the seed's.
    expect(settings).toMatchObject({
      dim: SEED.dim,
      font: SEED.font,
      photos: SEED.photos,
      ...changes,
    })
    // And v0.2.3 draws everything that was written, with nothing dropped or added.
    expect(settings).toEqual(stored.settings)
    expect(onboarding).toEqual(stored.onboarding)
  })
})
