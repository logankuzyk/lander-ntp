import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { settingsItem } from '@/settings/storage'
import { asV023 } from '@/test/compat/compat'

import { App } from './App'

// The Clock and the Weather are set up on their widgets now. The settings panel keeps the photo
// and the font, and points to Edit for the rest; it must write nothing of theirs, because
// devices still on v0.2.3 read `clock.enabled`, `showDate`, `showSeconds` and `weather` from the
// same synced settings.

/** A Clock that is off and a Weather that is set up, which no write here may touch. */
const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  clock: { enabled: false, hour12: false, showDate: true, showSeconds: true },
  v: 1,
  weather: {
    ...DEFAULT_SETTINGS.weather,
    enabled: true,
    followDevice: false,
    place: { latitude: 48.4284, longitude: -123.3656, name: 'Victoria' },
    unit: 'fahrenheit',
  },
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

async function openSettings(settings: Settings = SETTINGS) {
  await settingsItem.setValue(settings)
  const view = render(<App />)
  await waitFor(() => expect(view.container.querySelector('.grid')).not.toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  return within(await screen.findByRole('dialog', { name: 'Settings' }))
}

const synced = () => fakeBrowser.storage.sync.get(null)

describe('App, with the settings panel open', () => {
  it('has Photos, Account and General sections, whatever the Clock and the Weather are set to', async () => {
    const panel = await openSettings()

    expect(panel.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Photos',
      'Account',
      'General',
    ])
    expect(panel.queryByLabelText('Show weather')).toBeNull()
    expect(panel.queryByLabelText('Show clock')).toBeNull()
  })

  it('points to Edit in General, and the Edit button closes the panel and enters edit mode', async () => {
    const panel = await openSettings()
    fireEvent.click(panel.getByRole('tab', { name: 'General' }))
    expect(panel.getByText('Clock and Weather options are on the widgets now.')).toBeTruthy()
    // The Bottom bar's button, which the panel's shares its name with.
    const toggle = document.querySelector<HTMLElement>('[data-edit-toggle]')
    expect(toggle?.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(panel.getByRole('button', { name: 'Edit' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull())
    const done = screen.getByRole('button', { name: 'Done' })
    expect(done.getAttribute('aria-pressed')).toBe('true')
    // Focus is on the button that now reads Done, not dropped on the page.
    expect(document.activeElement).toBe(done)
    expect(screen.getByText('Editing widgets. Tab moves between widgets.')).toBeTruthy()
  })

  it('writes nothing when the Edit button is used', async () => {
    const panel = await openSettings()
    const before = await synced()
    fireEvent.click(panel.getByRole('tab', { name: 'General' }))

    fireEvent.click(panel.getByRole('button', { name: 'Edit' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull())

    expect(await synced()).toEqual(before)
  })

  it.each([
    [
      'Dim the photo',
      async (panel: ReturnType<typeof within>) => {
        fireEvent.click(panel.getByRole('switch', { name: 'Dim the photo' }))
      },
      (settings: Settings) => expect(settings.dim).toBe(!SETTINGS.dim),
    ],
    [
      'the font',
      async (panel: ReturnType<typeof within>) => {
        fireEvent.click(panel.getByRole('tab', { name: 'General' }))
        fireEvent.click(await panel.findByRole('combobox', { name: 'Font' }))
        fireEvent.click(screen.getByRole('option', { name: 'Geist' }))
      },
      (settings: Settings) => expect(settings.font).toBe('geist'),
    ],
    [
      'how often the photo changes',
      async (panel: ReturnType<typeof within>) => {
        fireEvent.click(panel.getByRole('combobox', { name: 'Change photo' }))
        fireEvent.click(screen.getByRole('option', { name: 'Every day' }))
      },
      (settings: Settings) => expect(settings.photos.frequency).toBe('daily'),
    ],
  ])(
    'leaves the Clock and the Weather blocks exactly as stored when %s changes, and writes no Layout',
    async (_, change, expectChanged) => {
      const panel = await openSettings()

      await change(panel)

      await waitFor(async () => expectChanged((await synced()).settings as Settings))
      const stored = await synced()
      const { clock, weather } = stored.settings as Settings
      // Byte for byte, in key order: v0.2.3 devices still read these blocks.
      expect(JSON.stringify(clock)).toBe(JSON.stringify(SETTINGS.clock))
      expect(JSON.stringify(weather)).toBe(JSON.stringify(SETTINGS.weather))
      // And nothing of the Layout: the panel has no part in it.
      expect(stored).not.toHaveProperty('layout')
      expect((await asV023(stored)).fellBack).toBe(false)
    },
  )

  it('saves once for one change', async () => {
    const panel = await openSettings()
    const set = vi.spyOn(fakeBrowser.storage.sync, 'set')

    fireEvent.click(panel.getByRole('switch', { name: 'Dim the photo' }))
    await waitFor(async () =>
      expect(((await synced()).settings as Settings).dim).toBe(!SETTINGS.dim),
    )
    await new Promise((resolve) => setTimeout(resolve, 30))

    expect(set).toHaveBeenCalledTimes(1)
  })
})
