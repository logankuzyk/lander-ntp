import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Favourite } from '@/favourites/schema'

import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { DATA_COLLECTION } from '@/telemetry/consent'
import { fakePermissions } from '@/test/permissions'

import { SettingsPanel } from './SettingsPanel'

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  clock: { enabled: true, hour12: true, showDate: false, showSeconds: false },
  // Both features on, so their settings are on screen; collapsing has its own tests.
  favourites: { ...DEFAULT_SETTINGS.favourites, enabled: true },
}

const favourites: Favourite[] = [{ id: '1', title: 'Portfolio', url: 'https://logankuzyk.com/' }]

const renderPanel = (overrides: Partial<Settings> = {}) => {
  const onChange = vi.fn()
  const onClose = vi.fn()
  const onFavouritesChange = vi.fn()
  render(
    <SettingsPanel
      settings={{ ...settings, ...overrides }}
      onChange={onChange}
      favourites={favourites}
      onFavouritesChange={onFavouritesChange}
      onClose={onClose}
    />,
  )
  return { onChange, onClose, onFavouritesChange }
}

describe('SettingsPanel', () => {
  it('opens as a labelled dialog with focus inside it', () => {
    renderPanel()
    const dialog = screen.getByRole('dialog', { name: 'Settings' })

    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('changes how often the photo changes', () => {
    const { onChange } = renderPanel()

    fireEvent.change(screen.getByLabelText('New photo'), { target: { value: 'daily' } })

    expect(onChange).toHaveBeenCalledWith({ ...settings, frequency: 'daily' })
  })

  it('switches the photo wash off', () => {
    const { onChange } = renderPanel()

    fireEvent.click(screen.getByLabelText('Dim the photo'))

    expect(onChange).toHaveBeenCalledWith({ ...settings, dim: false })
  })

  it('switches to 24-hour time', () => {
    const { onChange } = renderPanel()
    const toggle = screen.getByLabelText('24-hour time') as HTMLInputElement

    expect(toggle.checked).toBe(false)
    fireEvent.click(toggle)

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      clock: { ...settings.clock, hour12: false },
    })
  })

  it.each([
    ['Show clock', 'enabled', false],
    ['Show date', 'showDate', true],
    ['Show seconds', 'showSeconds', true],
  ])('toggles %s', (label, key, expected) => {
    const { onChange } = renderPanel()

    fireEvent.click(screen.getByLabelText(label))

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      clock: { ...settings.clock, [key]: expected },
    })
  })

  it('changes the font', () => {
    const { onChange } = renderPanel()

    fireEvent.change(screen.getByLabelText('Font'), { target: { value: 'instrument-serif' } })

    expect(onChange).toHaveBeenCalledWith({ ...settings, font: 'instrument-serif' })
  })

  it.each([
    ['Show favourites', 'enabled', false],
    ['Style', 'style', 'grid'],
    ['Size', 'size', 'l'],
  ])('changes the favourites %s setting', (label, key, value) => {
    const { onChange } = renderPanel()
    const control = screen.getByLabelText(label)

    if (typeof value === 'boolean') fireEvent.click(control)
    else fireEvent.change(control, { target: { value } })

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      favourites: { ...settings.favourites, [key]: value },
    })
  })

  it('edits the favourites list', () => {
    const { onFavouritesChange } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Portfolio' }))

    expect(onFavouritesChange).toHaveBeenCalledWith([])
  })

  it('has no widget switches: the credit and details panel are always available', () => {
    renderPanel()

    expect(screen.queryByLabelText('Show photo credit')).toBeNull()
    expect(screen.queryByLabelText('Show photo details')).toBeNull()
  })

  it('closes with the button, the backdrop and Escape', () => {
    const { onClose } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    fireEvent.click(document.querySelector('.settings__backdrop') as HTMLElement)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('keeps Tab inside the dialog', () => {
    renderPanel()
    const focusable = [
      ...screen.getByRole('dialog').querySelectorAll<HTMLElement>('button, select, input'),
    ]
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    last?.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('puts a feature switch in line with its heading', () => {
    renderPanel()

    const clock = screen.getByLabelText('Show clock').closest('.settings__section-header')
    const favourites = screen.getByLabelText('Show favourites').closest('.settings__section-header')

    expect(clock?.querySelector('h3')?.textContent).toBe('Clock')
    expect(favourites?.querySelector('h3')?.textContent).toBe('Favourites')
  })

  it('collapses the clock settings when the clock is off', () => {
    renderPanel({ clock: { ...settings.clock, enabled: false } })

    expect((screen.getByLabelText('Show clock') as HTMLInputElement).checked).toBe(false)
    expect(screen.queryByLabelText('24-hour time')).toBeNull()
    expect(screen.queryByLabelText('Show date')).toBeNull()
    expect(screen.queryByLabelText('Show seconds')).toBeNull()
  })

  it('collapses the favourites settings, editor included, when favourites are off', () => {
    renderPanel({ favourites: { ...settings.favourites, enabled: false } })

    expect(screen.queryByLabelText('Style')).toBeNull()
    expect(screen.queryByLabelText('Size')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove Portfolio' })).toBeNull()
  })

  it('switches a collapsed feature back on from its heading', () => {
    const { onChange } = renderPanel({ clock: { ...settings.clock, enabled: false } })

    fireEvent.click(screen.getByLabelText('Show clock'))

    expect(onChange).toHaveBeenCalledWith({
      ...settings,
      clock: { ...settings.clock, enabled: true },
    })
  })

  it('keeps collapsed settings out of the Tab order', () => {
    renderPanel({
      clock: { ...settings.clock, enabled: false },
      favourites: { ...settings.favourites, enabled: false },
    })
    const focusable = [
      ...screen.getByRole('dialog').querySelectorAll<HTMLElement>('button, select, input'),
    ]

    // `type` as a property, not an attribute: the editor's inputs leave it off and default
    // to text, so reading the attribute would find nothing whether they are rendered or not.
    expect(focusable.some((element) => (element as HTMLInputElement).type === 'text')).toBe(false)
    // Choice names its select through the wrapping label, so look it up the same way.
    expect(screen.queryByLabelText('Style')).toBeNull()
  })

  describe('usage data', () => {
    const usageData = () => screen.getByLabelText('Share anonymous usage data') as HTMLInputElement

    /** Firefox, with its usage data switch as given. */
    const firefox = (granted: boolean) =>
      vi.spyOn(fakePermissions, 'getAll').mockResolvedValue({
        data_collection: granted ? [DATA_COLLECTION] : [],
      })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('switches usage data off on Chrome and Edge, where only the setting decides', async () => {
      const getAll = vi.spyOn(fakePermissions, 'getAll').mockResolvedValue({})
      const { onChange } = renderPanel()
      await waitFor(() => expect(getAll).toHaveBeenCalled())

      expect(usageData().checked).toBe(true)
      fireEvent.click(usageData())

      expect(onChange).toHaveBeenCalledWith({ ...settings, telemetry: false })
    })

    it("shows the switch off while Firefox's own consent is withheld", async () => {
      firefox(false)
      renderPanel()

      await waitFor(() => expect(usageData().checked).toBe(false))
    })

    it('asks Firefox for consent when switched on there', async () => {
      firefox(false)
      const request = vi.spyOn(fakePermissions, 'request').mockResolvedValue(true)
      renderPanel()
      await waitFor(() => expect(usageData().checked).toBe(false))

      fireEvent.click(usageData())

      expect(request).toHaveBeenCalledWith({ data_collection: [DATA_COLLECTION] })
      await waitFor(() => expect(usageData().checked).toBe(true))
    })

    it("withdraws Firefox's consent too when switched off there", async () => {
      firefox(true)
      const remove = vi.spyOn(fakePermissions, 'remove').mockResolvedValue(true)
      const { onChange } = renderPanel()
      await waitFor(() => expect(fakePermissions.getAll).toHaveBeenCalled())

      fireEvent.click(usageData())

      expect(onChange).toHaveBeenCalledWith({ ...settings, telemetry: false })
      expect(remove).toHaveBeenCalledWith({ data_collection: [DATA_COLLECTION] })
    })
  })
})
