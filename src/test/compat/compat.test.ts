import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { recordInstall } from '@/onboarding/install'
import { type Onboarding, onboardingItem } from '@/onboarding/storage'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { createWriteQueue } from '@/storage/writeQueue'

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
  /**
   * The write starts from no synced onboarding record, so it has no `dismissed` ids to keep.
   */
  fromNoRecord?: boolean
  /**
   * A write only the settings panel's Clock and Weather tabs make. W17 deletes those tabs, and
   * deletes these rows with them: from then on nothing may change `clock.*` other than
   * `hour12`, or `weather.*` at all.
   */
  legacyPanel?: boolean
  name: string
  /**
   * The write must leave `v: 1` at the top of the settings, which stored settings from v0.2.3
   * (the row starts from those) do not have.
   */
  stampsVersion?: boolean
  /** The write, made through the real storage items, as the page makes it. */
  write: () => Promise<void>
}

/**
 * Every write the extension can make to `sync:settings` and `sync:onboarding`, replayed through
 * the real items and read back through the frozen v0.2.3 reader. This is the standing guard
 * against resetting a device that is still on v0.2.3 (LR-15). Two things are checked for each
 * row: that v0.2.3 still reads what was written, and that the write changed only what phase 2
 * is allowed to change (see below), which the reader alone would not catch.
 *
 * What v0.2.3 does with what it reads: the settings are a loose object, so it keeps a top-level
 * key it does not know (`v`, `layout`) and writes it back on its own saves. It falls back to the
 * defaults only when a known block is missing or wrong. A key added inside `clock`, `photos` or
 * `place` is stripped, silently, the next time v0.2.3 saves.
 *
 * What phase 2 may write to `sync:settings` is only the top-level `v: 1`, `clock.hour12`, and
 * what v0.2.3 already writes (photos, dim, font, as the panel does now). It never removes a
 * block, never gives a value v0.2.3 does not know, never adds a key inside a block. Removing a
 * Clock writes only `sync:layout`; it never writes `clock.enabled`. `sync:onboarding` only gains
 * ids in `dismissed`. `sync:layout` is not here: v0.2.3 never reads it (its own row arrives
 * with the PR that adds it).
 *
 * `recordInstall('install')` writes only `local:onboarding`, which is not synced, so it is
 * correctly not a row. The "answer the welcome" row starts from a synced record, where a real
 * new install starts from `local:onboarding`; the shape is the same.
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
    legacyPanel: true, // W17 deletes this row
    name: 'switch the clock off (settings panel until the Clock moves to the page)',
    write: changeSettings((s) => ({ ...s, clock: { ...s.clock, enabled: false } })),
  },
  {
    legacyPanel: true, // W17 deletes this row
    name: 'show the date and seconds on the clock (settings panel)',
    write: changeSettings((s) => ({
      ...s,
      clock: { ...s.clock, showDate: true, showSeconds: true },
    })),
  },
  {
    legacyPanel: true, // W17 deletes this row
    name: 'switch the weather on at a place (settings panel)',
    write: changeSettings((s) => ({
      ...s,
      weather: { ...s.weather, enabled: true, place: VICTORIA },
    })),
  },
  {
    legacyPanel: true, // W17 deletes this row
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
    changes: { font: 'instrument-serif' },
    name: 'the first save after an update from v0.2.3 adds the top-level `v: 1` (W3)',
    stampsVersion: true,
    write: async () => {
      // Settings as v0.2.3 left them: the current shape, and no `v`.
      const settings = (await fakeBrowser.storage.sync.get('settings')).settings as Settings
      await fakeBrowser.storage.sync.set({
        settings: Object.fromEntries(Object.entries(settings).filter(([key]) => key !== 'v')),
      })
      await changeSettings((s) => ({ ...s, font: 'instrument-serif' }))()
    },
  },
  {
    changes: { dim: true },
    name: 'a burst of saves through the write queue (W2: it writes nothing new; the last value wins)',
    write: async () => {
      const queue = createWriteQueue((value: Settings) => settingsItem.setValue(value))
      const base = await settingsItem.getValue()
      // Twenty flicks of Dim, the way the page makes them: the last of them leaves it on.
      await Promise.all(
        Array.from({ length: 20 }, (_, i) => queue.save({ ...base, dim: i % 2 === 1 })),
      )
    },
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
    fromNoRecord: true,
    name: 'record an update from a version that kept no record',
    write: async () => {
      await fakeBrowser.storage.sync.remove('onboarding')
      await recordInstall('update')
    },
  },
]

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The paths at which `after` differs from `before`, one block deep: `dim`, `photos.mode`,
 * `clock.hour12`. A key that is added or removed counts, at the top level or inside a block.
 */
const changedPaths = (before: unknown, after: unknown): string[] => {
  const was = isObject(before) ? before : {}
  const now = isObject(after) ? after : {}
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  return [...new Set([...Object.keys(was), ...Object.keys(now)])].flatMap((key) => {
    const [a, b] = [was[key], now[key]]
    if (isObject(a) && isObject(b)) {
      return [...new Set([...Object.keys(a), ...Object.keys(b)])]
        .filter((inner) => !same(a[inner], b[inner]))
        .map((inner) => `${key}.${inner}`)
    }
    return same(a, b) ? [] : [key]
  })
}

/** Everything phase 2 may change in `sync:settings`; see PHASE_2_WRITES. */
const ALLOWED_PATHS = /^dim$|^font$|^photos\.|^clock\.hour12$|^v$/
const LEGACY_PANEL_PATHS = /^clock\.|^weather\./

describe('what phase 2 may write, read by the frozen v0.2.3 reader', () => {
  beforeEach(async () => {
    await settingsItem.setValue(SEED)
    await onboardingItem.setValue(SEED_ONBOARDING)
  })

  it.each(PHASE_2_WRITES)(
    '$name',
    async ({ changes, fromNoRecord, legacyPanel, stampsVersion, write }) => {
      await write()
      const stored = await fakeBrowser.storage.sync.get(null)

      // Only what phase 2 is allowed to change has changed, and `v` is 1 where there is one.
      const disallowed = changedPaths(SEED, stored.settings).filter(
        (path) => !ALLOWED_PATHS.test(path) && !(legacyPanel && LEGACY_PANEL_PATHS.test(path)),
      )
      expect(disallowed).toEqual([])
      if (isObject(stored.settings) && 'v' in stored.settings) expect(stored.settings.v).toBe(1)
      if (stampsVersion) expect(stored.settings).toHaveProperty('v', 1)
      // `dismissed` only gains ids.
      if (!fromNoRecord) {
        expect((stored.onboarding as Onboarding).dismissed).toEqual(
          expect.arrayContaining(SEED_ONBOARDING.dismissed),
        )
      }

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
    },
  )
})
