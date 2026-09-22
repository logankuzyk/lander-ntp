import { fireEvent, render, screen, within } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import type { PhotoSettings } from '@/photos/rotation'
import type { Photo } from '@/photos/schema'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { makePhoto } from '@/test/fixtures'

import { SettingsPanel } from './SettingsPanel'

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  photos: { mode: 'cycle', frequency: '1h', tags: [], pinnedId: null },
  clock: { enabled: true, hour12: true, showDate: false, showSeconds: false },
}

const PHOTOS = [
  makePhoto('a', { alt: 'Waterfall', tags: [{ slug: 'water', name: 'Water' }] }),
  makePhoto('b', { alt: 'Tide pools', tags: [{ slug: 'beach', name: 'Beach' }] }),
]

const renderPanel = ({
  overrides = {},
  photos = PHOTOS,
}: { overrides?: Partial<Settings>; photos?: Photo[] } = {}) => {
  const onChange = vi.fn()
  const onClose = vi.fn()
  render(
    <SettingsPanel
      settings={{ ...settings, ...overrides }}
      onChange={onChange}
      photos={photos}
      currentId="a"
      onClose={onClose}
    />,
  )
  return { onChange, onClose }
}

const withPhotos = (changes: Partial<PhotoSettings>): Settings => ({
  ...settings,
  photos: { ...settings.photos, ...changes },
})

const openSection = (name: string) => fireEvent.click(screen.getByRole('tab', { name }))

describe('SettingsPanel', () => {
  it('opens as a labelled popover with the close button focused', () => {
    renderPanel()

    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close settings' }))
  })

  it('closes with the button, with Escape and with a click outside', () => {
    const { onClose } = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.pointerDown(document.body)

    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('stays open for clicks inside it', () => {
    const { onClose } = renderPanel()

    fireEvent.pointerDown(screen.getByRole('tab', { name: 'Clock' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Tide pools' }))

    expect(onClose).not.toHaveBeenCalled()
  })

  describe('sections', () => {
    it('lists photos, clock and general settings, starting on photos', () => {
      renderPanel()

      const tabs = screen.getAllByRole('tab')
      expect(tabs.map((tab) => tab.textContent)).toEqual(['Photos', 'Clock', 'General'])
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Photos')
      expect(screen.getByRole('tabpanel', { name: 'Photos' })).toBeTruthy()
    })

    it('switches section from the sidebar', () => {
      renderPanel()

      openSection('Clock')

      expect(screen.getByRole('tabpanel', { name: 'Clock' })).toBeTruthy()
      expect(screen.getByLabelText('Show clock')).toBeTruthy()
      expect(screen.queryByLabelText('Change photo')).toBeNull()
    })

    it('moves between sections with the arrow keys', () => {
      renderPanel()
      const photos = screen.getByRole('tab', { name: 'Photos' })

      fireEvent.keyDown(photos, { key: 'ArrowDown' })
      expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Clock' }))
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Clock')

      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' })
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('General')

      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' })
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Photos')
    })

    it('has no favourites', () => {
      renderPanel()

      expect(screen.queryByRole('tab', { name: 'Favourites' })).toBeNull()
      expect(screen.queryByText(/favourite/i)).toBeNull()
    })
  })

  describe('photos', () => {
    /** Open a dropdown by its label and pick an option. */
    const choose = (field: string, option: string) => {
      fireEvent.click(screen.getByRole('combobox', { name: field }))
      fireEvent.click(screen.getByRole('option', { name: option }))
    }

    it('changes how often the photo changes', () => {
      const { onChange } = renderPanel()

      expect(screen.getByRole('combobox', { name: 'Change photo' }).textContent).toBe('Every hour')
      choose('Change photo', 'Every day')

      expect(onChange).toHaveBeenCalledWith(withPhotos({ frequency: 'daily' }))
      // A choice closes the menu.
      expect(screen.queryByRole('listbox')).toBeNull()
    })

    it('closes only the menu with Escape, not the settings', () => {
      const { onClose } = renderPanel()

      fireEvent.click(screen.getByRole('combobox', { name: 'Change photo' }))
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })

      expect(screen.queryByRole('listbox')).toBeNull()
      expect(onClose).not.toHaveBeenCalled()
    })

    it('keeps the photo on screen when set to never, remembering the frequency', () => {
      const { onChange } = renderPanel()

      choose('Change photo', 'Never')

      expect(onChange).toHaveBeenCalledWith(withPhotos({ mode: 'pinned', pinnedId: 'a' }))
    })

    it('cycles tags chosen from the multi-select', () => {
      const { onChange } = renderPanel()
      const field = screen.getByRole('combobox', { name: 'Tags' })

      expect(field.textContent).toBe('All')
      fireEvent.click(field)
      const menu = within(screen.getByRole('dialog', { name: 'Tags' }))
      expect(menu.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Beach',
        'Water',
      ])
      fireEvent.click(menu.getByRole('option', { name: 'Water' }))

      expect(onChange).toHaveBeenCalledWith(withPhotos({ tags: ['water'] }))
    })

    it('shows the cycled tags as chips, and removes or resets them from the menu', () => {
      const { onChange } = renderPanel({ overrides: withPhotos({ tags: ['water', 'beach'] }) })
      const field = screen.getByRole('combobox', { name: 'Tags' })

      expect(field.textContent).toBe('WaterBeach')
      fireEvent.click(field)
      const menu = within(screen.getByRole('dialog', { name: 'Tags' }))
      // Only the tags not already chosen are offered.
      expect(menu.queryAllByRole('option')).toEqual([])

      fireEvent.click(menu.getByRole('button', { name: 'Remove Water' }))
      expect(onChange).toHaveBeenLastCalledWith(withPhotos({ tags: ['beach'] }))

      fireEvent.click(menu.getByRole('button', { name: 'Reset to all' }))
      expect(onChange).toHaveBeenLastCalledWith(withPhotos({ tags: [] }))
    })

    it('offers the tags only while cycling, and keeps them for when it resumes', () => {
      const { onChange } = renderPanel({
        overrides: withPhotos({ mode: 'pinned', pinnedId: 'b', tags: ['water'] }),
      })

      expect(screen.getByRole('combobox', { name: 'Change photo' }).textContent).toBe('Never')
      expect(screen.queryByRole('combobox', { name: 'Tags' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Resume cycling' }))

      expect(onChange).toHaveBeenCalledWith(
        withPhotos({ mode: 'cycle', pinnedId: 'b', tags: ['water'] }),
      )
    })

    it('keeps the tags when cycling is set to a frequency again', () => {
      const { onChange } = renderPanel({
        overrides: withPhotos({ mode: 'pinned', pinnedId: 'b', tags: ['water'] }),
      })

      choose('Change photo', 'Every day')

      expect(onChange).toHaveBeenCalledWith(
        withPhotos({ mode: 'cycle', frequency: 'daily', pinnedId: 'b', tags: ['water'] }),
      )
    })

    it('filters the gallery to the tag being cycled, when there is one', () => {
      renderPanel({ overrides: withPhotos({ tags: ['beach'] }) })

      const filters = within(screen.getByRole('group', { name: 'Filter photos' }))
      expect(filters.getByRole('button', { name: 'Beach' }).getAttribute('aria-pressed')).toBe(
        'true',
      )
    })

    it('pins a photo picked from the gallery', () => {
      const { onChange } = renderPanel()

      fireEvent.click(screen.getByRole('button', { name: 'Tide pools' }))

      expect(onChange).toHaveBeenCalledWith(withPhotos({ mode: 'pinned', pinnedId: 'b' }))
    })

    it('reads tags no photo has as all photos, and clears them on the next change', () => {
      const { onChange } = renderPanel({ overrides: withPhotos({ tags: ['mountains'] }) })

      expect(screen.getByRole('combobox', { name: 'Tags' }).textContent).toBe('All')
      const filters = within(screen.getByRole('group', { name: 'Filter photos' }))
      expect(filters.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
      fireEvent.click(screen.getByLabelText('Dim the photo'))

      expect(onChange).toHaveBeenCalledWith({ ...settings, dim: false })
    })

    it('clears tags the photos lack from other sections too, such as with the fallback photo', () => {
      const { onChange } = renderPanel({
        overrides: withPhotos({ tags: ['water'] }),
        photos: [makePhoto('fallback')],
      })
      openSection('Clock')

      fireEvent.click(screen.getByLabelText('Show date'))

      expect(onChange).toHaveBeenCalledWith({
        ...settings,
        clock: { ...settings.clock, showDate: true },
      })
    })

    it('keeps the tags while the photos are loading', () => {
      const { onChange } = renderPanel({ overrides: withPhotos({ tags: ['water'] }), photos: [] })

      expect(screen.getByText('Loading photos…')).toBeTruthy()
      fireEvent.click(screen.getByLabelText('Dim the photo'))

      expect(onChange).toHaveBeenCalledWith({ ...withPhotos({ tags: ['water'] }), dim: false })
    })

    it('has no gallery or tags with only one photo', () => {
      renderPanel({ photos: [makePhoto('fallback')] })

      expect(screen.queryByRole('heading', { name: 'Gallery' })).toBeNull()
      expect(screen.queryByRole('combobox', { name: 'Tags' })).toBeNull()
    })

    it('switches the photo wash off', () => {
      const { onChange } = renderPanel()

      fireEvent.click(screen.getByLabelText('Dim the photo'))

      expect(onChange).toHaveBeenCalledWith({ ...settings, dim: false })
    })

    it('grows before it scrolls, holding the top in place', () => {
      renderPanel()
      const dialog = screen.getByRole('dialog', { name: 'Settings' })
      const body = screen.getByRole('tabpanel')
      // No layout here: a 1000px section showing 200px, in a popover capped at 800px.
      const grown = () => parseFloat(body.style.getPropertyValue('--popover-grow') || '0')
      dialog.style.maxHeight = '800px'
      Object.defineProperty(dialog, 'offsetHeight', { get: () => 300 + grown() })
      Object.defineProperty(body, 'clientHeight', { get: () => 200 + grown() })
      Object.defineProperty(body, 'scrollHeight', { value: 1000 })
      Object.defineProperty(body, 'scrollTop', { value: 0, writable: true })

      const first = new WheelEvent('wheel', { deltaY: 450, cancelable: true })
      body.dispatchEvent(first)

      expect(first.defaultPrevented).toBe(true)
      expect(grown()).toBe(450)
      expect(body.scrollTop).toBe(0)

      // 50px short of the cap: the rest of the wheel scrolls.
      body.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true }))
      expect(grown()).toBe(500)
      expect(body.scrollTop).toBe(50)

      // At the cap, and scrolling up, the browser scrolls as usual.
      const atCap = new WheelEvent('wheel', { deltaY: 100, cancelable: true })
      body.dispatchEvent(atCap)
      const up = new WheelEvent('wheel', { deltaY: -100, cancelable: true })
      body.dispatchEvent(up)
      expect(atCap.defaultPrevented).toBe(false)
      expect(up.defaultPrevented).toBe(false)
      expect(grown()).toBe(500)

      // Another section starts at rest again.
      openSection('Clock')
      expect(grown()).toBe(0)
      expect(body.scrollTop).toBe(0)
    })
  })

  describe('clock', () => {
    it('switches to 24-hour time', () => {
      const { onChange } = renderPanel()
      openSection('Clock')
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
      openSection('Clock')

      fireEvent.click(screen.getByLabelText(label))

      expect(onChange).toHaveBeenCalledWith({
        ...settings,
        clock: { ...settings.clock, [key]: expected },
      })
    })

    it('hides the clock options while the clock is off', () => {
      renderPanel({ overrides: { clock: { ...settings.clock, enabled: false } } })
      openSection('Clock')

      const panel = within(screen.getByRole('tabpanel'))
      expect(panel.getByLabelText('Show clock')).toBeTruthy()
      expect(panel.queryByLabelText('Show seconds')).toBeNull()
    })
  })

  describe('general', () => {
    it('changes the font', () => {
      const { onChange } = renderPanel()
      openSection('General')

      fireEvent.click(screen.getByRole('combobox', { name: 'Font' }))
      fireEvent.click(screen.getByRole('option', { name: 'Instrument Serif' }))

      expect(onChange).toHaveBeenCalledWith({ ...settings, font: 'instrument-serif' })
    })
  })
})
