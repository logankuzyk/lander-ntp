import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { makePlace } from '@/test/fixtures'

import { SettingsPanel } from './SettingsPanel'

// What the rows say and the order of their choices, drawn through the shared controls. The
// behaviour of the panel is in SettingsPanel.test.tsx.

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  photos: { frequency: '1h', mode: 'cycle', pinnedId: null, tags: [] },
  weather: { ...DEFAULT_SETTINGS.weather, enabled: true, place: makePlace() },
}

const open = (section: string) => {
  render(
    <SettingsPanel
      currentId={null}
      onChange={vi.fn()}
      onClose={vi.fn()}
      photos={[]}
      settings={settings}
    />,
  )
  fireEvent.click(screen.getByRole('tab', { name: section }))
}

const optionsOf = (menu: string) => {
  fireEvent.click(screen.getByRole('combobox', { name: menu }))
  return screen.getAllByRole('option').map((option) => option.textContent)
}

describe('SettingsPanel rows', () => {
  it('labels the place row "Place"', () => {
    open('Weather')

    const row = screen.getByText('Victoria').closest('.settings__row')
    expect(row?.firstElementChild?.textContent).toBe('Place')
  })

  it('lists the units Celsius first, then Fahrenheit', () => {
    open('Weather')

    expect(optionsOf('Units')).toEqual(['Celsius', 'Fahrenheit'])
  })

  it('lists how often the photo changes, every new tab first and Never last', () => {
    open('Photos')

    expect(optionsOf('Change photo')).toEqual([
      'Every new tab',
      'Every 30 seconds',
      'Every minute',
      'Every 5 minutes',
      'Every 15 minutes',
      'Every hour',
      'Every 6 hours',
      'Every 12 hours',
      'Every day',
      'Never',
    ])
  })
})
