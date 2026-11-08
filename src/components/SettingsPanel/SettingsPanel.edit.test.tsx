import { fireEvent, render, screen, within } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { makePlace } from '@/test/fixtures'

import { SettingsPanel } from './SettingsPanel'

// The Clock and the Weather are set up on their widgets. The panel keeps the photo and the font,
// and says where the rest went.

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  weather: { ...DEFAULT_SETTINGS.weather, enabled: true, place: makePlace() },
}

/** Says whether the page is in edit mode, as the Bottom bar's Edit button would. */
function Page({ onClose, readOnly = false }: { onClose: () => void; readOnly?: boolean }) {
  const { editing } = useEditMode()
  return (
    <>
      <button aria-pressed={editing} data-edit-toggle type="button">
        Edit mode
      </button>
      <SettingsPanel
        currentId={null}
        onChange={vi.fn()}
        onClose={onClose}
        photos={[]}
        readOnly={readOnly}
        settings={settings}
      />
    </>
  )
}

const open = (props: { readOnly?: boolean } = {}) => {
  const onClose = vi.fn()
  render(
    <EditModeProvider>
      <Page onClose={onClose} {...props} />
    </EditModeProvider>,
  )
  fireEvent.click(screen.getByRole('tab', { name: 'General' }))
  return { onClose }
}

const panel = () => within(screen.getByRole('dialog', { name: 'Settings' }))

describe('SettingsPanel, now the Clock and the Weather are on their widgets', () => {
  it('has the pointer line and an Edit button in General', () => {
    open()

    const section = within(screen.getByRole('tabpanel', { name: 'General' }))
    expect(section.getByText('Clock and Weather options are on the widgets now.')).toBeTruthy()
    expect(section.getByRole('button', { name: 'Edit' })).toBeTruthy()
  })

  it('has the pointer line in General only', () => {
    open()
    fireEvent.click(screen.getByRole('tab', { name: 'Background' }))

    expect(screen.queryByText(/options are on the widgets now/)).toBeNull()
  })

  it('closes the panel and enters edit mode with the Edit button', () => {
    const { onClose } = open()
    expect(screen.getByRole('button', { name: 'Edit mode' }).getAttribute('aria-pressed')).toBe(
      'false',
    )

    fireEvent.click(panel().getByRole('button', { name: 'Edit' }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Edit mode' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('leaves focus on the page button that now reads Done, not on the panel that closed', () => {
    open()

    fireEvent.click(panel().getByRole('button', { name: 'Edit' }))

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit mode' }))
  })

  it('still lets the Edit button be used when the settings are from a newer version', () => {
    // It changes no setting, so the fieldset that turns the others off does not hold it.
    const { onClose } = open({ readOnly: true })
    const edit = panel().getByRole('button', { name: 'Edit' })

    expect(edit.closest('fieldset')).toBeNull()
    fireEvent.click(edit)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Edit mode' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('has no section, switch or control for the Clock or the Weather, even with the Weather on', () => {
    open()

    for (const name of ['Background', 'General']) {
      fireEvent.click(screen.getByRole('tab', { name }))
      const section = within(screen.getByRole('tabpanel'))
      for (const label of [
        'Show clock',
        'Show weather',
        '24-hour time',
        'Show date',
        'Show seconds',
        'Units',
        'Place',
        'Search for a place',
      ]) {
        expect(section.queryByLabelText(label)).toBeNull()
      }
      expect(section.queryByRole('link', { name: /Open-Meteo/ })).toBeNull()
    }
    expect(screen.queryByRole('tab', { name: 'Clock' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Weather' })).toBeNull()
  })
})
