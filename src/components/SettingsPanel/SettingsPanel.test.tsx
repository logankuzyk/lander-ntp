import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { favouritesItem } from '@/backdrop/favourites'
import { type Background, DEFAULT_BACKGROUND } from '@/backdrop/storage'
import type { SettingsStop } from '@/onboarding/callouts'
import type { PhotoSettings } from '@/photos/rotation'
import type { Photo } from '@/photos/schema'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { makePhoto } from '@/test/fixtures'

import { SettingsPanel } from './SettingsPanel'

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  clock: { enabled: true, hour12: true, showDate: false, showSeconds: false },
  photos: { frequency: '1h', mode: 'cycle', pinnedId: null, tags: [] },
  weather: { ...DEFAULT_SETTINGS.weather, unit: 'celsius' },
}

const PHOTOS = [
  makePhoto('a', { alt: 'Waterfall', tags: [{ name: 'Water', optIn: false, slug: 'water' }] }),
  makePhoto('b', { alt: 'Tide pools', tags: [{ name: 'Beach', optIn: false, slug: 'beach' }] }),
]

const renderPanel = ({
  background = DEFAULT_BACKGROUND,
  backgroundLoaded = true,
  backgroundReadOnly = false,
  overrides = {},
  photos = PHOTOS,
}: {
  background?: Background
  backgroundLoaded?: boolean
  backgroundReadOnly?: boolean
  overrides?: Partial<Settings>
  photos?: Photo[]
} = {}) => {
  const onChange = vi.fn()
  const onBackgroundChange = vi.fn()
  const onPreviewColour = vi.fn()
  const onClose = vi.fn()
  const view = render(
    <SettingsPanel
      background={background}
      backgroundLoaded={backgroundLoaded}
      backgroundReadOnly={backgroundReadOnly}
      currentId="a"
      onBackgroundChange={onBackgroundChange}
      onChange={onChange}
      onClose={onClose}
      onPreviewColour={onPreviewColour}
      photos={photos}
      settings={{ ...settings, ...overrides }}
    />,
  )
  return { ...view, onBackgroundChange, onChange, onClose, onPreviewColour }
}

const withPhotos = (changes: Partial<PhotoSettings>): Settings => ({
  ...settings,
  photos: { ...settings.photos, ...changes },
})

const openSection = (name: string) => fireEvent.click(screen.getByRole('tab', { name }))

describe('SettingsPanel', () => {
  describe('Favourites only', () => {
    it('needs an on-site favourite, hides Tags while on, and reports when favourites leave the site', async () => {
      await fakeBrowser.storage.sync.clear()
      const { onBackgroundChange, rerender } = renderPanel()

      const toggle = (await screen.findByRole('switch', {
        name: 'Favourites only',
      })) as HTMLInputElement
      expect(toggle.disabled).toBe(true)
      expect(await screen.findByText('Mark photos with the heart to use this.')).toBeTruthy()
      expect(screen.getByRole('combobox', { name: 'Tags' })).toBeTruthy()

      await act(async () => {
        await fakeBrowser.storage.sync.set({ favourites: { ids: ['a'], v: 1 } })
      })
      await waitFor(() => expect(toggle.disabled).toBe(false))
      fireEvent.click(toggle)
      expect(onBackgroundChange).toHaveBeenCalledWith({
        ...DEFAULT_BACKGROUND,
        favouritesOnly: true,
      })
      rerender(
        <SettingsPanel
          background={{ ...DEFAULT_BACKGROUND, favouritesOnly: true }}
          currentId="a"
          onBackgroundChange={onBackgroundChange}
          onChange={vi.fn()}
          onClose={vi.fn()}
          photos={PHOTOS}
          settings={settings}
        />,
      )
      expect(screen.queryByRole('combobox', { name: 'Tags' })).toBeNull()
      fireEvent.click(screen.getByRole('switch', { name: 'Favourites only' }))
      rerender(
        <SettingsPanel
          currentId="a"
          onBackgroundChange={onBackgroundChange}
          onChange={vi.fn()}
          onClose={vi.fn()}
          photos={PHOTOS}
          settings={settings}
        />,
      )
      expect(screen.getByRole('combobox', { name: 'Tags' })).toBeTruthy()

      rerender(
        <SettingsPanel
          background={{ ...DEFAULT_BACKGROUND, favouritesOnly: true }}
          currentId="a"
          onBackgroundChange={onBackgroundChange}
          onChange={vi.fn()}
          onClose={vi.fn()}
          photos={[PHOTOS[1]!]}
          settings={settings}
        />,
      )
      expect(
        screen.getByText(
          'None of your favourites are on the site right now, so every photo is cycled.',
        ),
      ).toBeTruthy()
      expect(await favouritesItem.getValue()).toEqual({ ids: ['a'], v: 1 })
    })

    it('uses stored favourites with the bundled fallback list without showing the missing-favourites note', async () => {
      await fakeBrowser.storage.sync.clear()
      await fakeBrowser.storage.sync.set({ favourites: { ids: ['a'], v: 1 } })
      const photos = [{ ...PHOTOS[0]!, id: 'fallback' }]
      const { container, rerender } = renderPanel({ photos })

      const panel = within(container as HTMLElement)
      const toggle = (await panel.findByRole('switch', {
        name: 'Favourites only',
      })) as HTMLInputElement
      await waitFor(() => expect(toggle.disabled).toBe(false))
      rerender(
        <SettingsPanel
          background={{ ...DEFAULT_BACKGROUND, favouritesOnly: true }}
          currentId="a"
          onBackgroundChange={vi.fn()}
          onChange={vi.fn()}
          onClose={vi.fn()}
          photos={photos}
          settings={settings}
        />,
      )
      expect(
        within(panel.getByRole('dialog', { name: 'Settings' }) as HTMLElement).queryByText(
          /None of your favourites are on the site/,
        ),
      ).toBeNull()
    })
  })

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

    fireEvent.pointerDown(screen.getByRole('tab', { name: 'General' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Tide pools' }))

    expect(onClose).not.toHaveBeenCalled()
  })

  describe('sections', () => {
    it('lists photos and general settings, starting on photos', () => {
      renderPanel()

      const tabs = screen.getAllByRole('tab')
      expect(tabs.map((tab) => tab.textContent)).toEqual(['Background', 'General'])
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Background')
      expect(screen.getByRole('tabpanel', { name: 'Background' })).toBeTruthy()
    })

    it('switches section from the sidebar', () => {
      renderPanel()

      openSection('General')

      expect(screen.getByRole('tabpanel', { name: 'General' })).toBeTruthy()
      expect(screen.getByRole('combobox', { name: 'Font' })).toBeTruthy()
      expect(screen.queryByLabelText('Change photo')).toBeNull()
    })

    it('moves between sections with the arrow keys', () => {
      renderPanel()
      const photos = screen.getByRole('tab', { name: 'Background' })

      fireEvent.keyDown(photos, { key: 'ArrowDown' })
      expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'General' }))
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('General')

      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' })
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Background')

      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' })
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('General')

      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' })
      expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Background')
    })

    it('prompts the user to mark a photo when none are favourites', async () => {
      renderPanel()

      expect(screen.queryByRole('tab', { name: 'Favourites' })).toBeNull()
      expect(await screen.findByText('Mark photos with the heart to use this.')).toBeTruthy()
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
        withPhotos({ frequency: 'daily', mode: 'cycle', pinnedId: 'b', tags: ['water'] }),
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
      openSection('General')

      fireEvent.click(screen.getByRole('combobox', { name: 'Font' }))
      fireEvent.click(screen.getByRole('option', { name: 'Instrument Serif' }))

      expect(onChange).toHaveBeenCalledWith({
        ...settings,
        font: 'instrument-serif',
        photos: { ...settings.photos, tags: [] },
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

      const first = new WheelEvent('wheel', { cancelable: true, deltaY: 450 })
      body.dispatchEvent(first)

      expect(first.defaultPrevented).toBe(true)
      expect(grown()).toBe(450)
      expect(body.scrollTop).toBe(0)

      // 50px short of the cap: the rest of the wheel scrolls.
      body.dispatchEvent(new WheelEvent('wheel', { cancelable: true, deltaY: 100 }))
      expect(grown()).toBe(500)
      expect(body.scrollTop).toBe(50)

      // At the cap, and scrolling up, the browser scrolls as usual.
      const atCap = new WheelEvent('wheel', { cancelable: true, deltaY: 100 })
      body.dispatchEvent(atCap)
      const up = new WheelEvent('wheel', { cancelable: true, deltaY: -100 })
      body.dispatchEvent(up)
      expect(atCap.defaultPrevented).toBe(false)
      expect(up.defaultPrevented).toBe(false)
      expect(grown()).toBe(500)

      // Another section starts at rest again.
      openSection('General')
      expect(grown()).toBe(0)
      expect(body.scrollTop).toBe(0)
    })
  })

  describe('background', () => {
    const choose = (field: string, option: string) => {
      fireEvent.click(screen.getByRole('combobox', { name: field }))
      fireEvent.click(screen.getByRole('option', { name: option }))
    }

    it('switches between Photo and Colour without changing photo settings', () => {
      const { onBackgroundChange, onChange, unmount } = renderPanel()

      expect(screen.getByRole('combobox', { name: 'Background' }).textContent).toBe('Photo')
      choose('Background', 'Colour')

      expect(onBackgroundChange).toHaveBeenCalledWith({ ...DEFAULT_BACKGROUND, kind: 'colour' })
      expect(onChange).not.toHaveBeenCalled()
      unmount()
      renderPanel({ background: { ...DEFAULT_BACKGROUND, kind: 'colour' } })
      expect(screen.getByRole('radiogroup', { name: 'Background colour' })).toBeTruthy()
      expect(screen.queryByRole('heading', { name: 'Cycling' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Tide pools' })).toBeNull()
    })

    it('shows today’s photo controls in Photo mode', () => {
      renderPanel({ background: { ...DEFAULT_BACKGROUND, kind: 'photo' } })

      expect(screen.getByRole('heading', { name: 'Cycling' })).toBeTruthy()
      expect(screen.getByRole('combobox', { name: 'Tags' })).toBeTruthy()
      expect(screen.getByLabelText('Dim the photo')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Tide pools' })).toBeTruthy()
    })

    it('keeps background controls disabled until the stored choice loads', () => {
      const { onBackgroundChange } = renderPanel({ backgroundLoaded: false })

      expect(
        screen
          .getByRole('combobox', { name: 'Background' })
          .closest('fieldset')
          ?.hasAttribute('disabled'),
      ).toBe(true)
      choose('Background', 'Colour')

      expect(onBackgroundChange).not.toHaveBeenCalled()
    })

    it('offers eight named presets and opens the native picker from Custom colour', () => {
      renderPanel({ background: { ...DEFAULT_BACKGROUND, kind: 'colour' } })
      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(9)
      expect(screen.getByRole('radio', { name: 'Colour 1' })).toBeTruthy()
      expect(screen.getByRole('radio', { name: 'Custom colour' })).toBeTruthy()
      const picker = screen.getByLabelText('Choose custom colour')
      const openPicker = vi.spyOn(picker, 'click')

      fireEvent.click(screen.getByRole('radio', { name: 'Custom colour' }))

      expect(openPicker).toHaveBeenCalledOnce()
      openPicker.mockRestore()
    })

    it('previews and saves a selected preset', () => {
      const { onBackgroundChange, onPreviewColour } = renderPanel({
        background: { ...DEFAULT_BACKGROUND, kind: 'colour' },
      })

      fireEvent.click(screen.getByRole('radio', { name: 'Colour 2' }))

      expect(onPreviewColour).toHaveBeenNthCalledWith(1, '#f2e8cf')
      expect(onBackgroundChange).toHaveBeenCalledWith({
        ...DEFAULT_BACKGROUND,
        colour: '#f2e8cf',
        kind: 'colour',
      })
      expect(onPreviewColour).toHaveBeenLastCalledWith(null)
    })

    it('previews a dragged colour, then commits once when the picker changes', () => {
      const { onBackgroundChange, onPreviewColour } = renderPanel({
        background: { ...DEFAULT_BACKGROUND, kind: 'colour' },
      })
      const picker = screen.getByLabelText('Choose custom colour')

      fireEvent.input(picker, { target: { value: '#123456' } })
      expect(onPreviewColour).toHaveBeenCalledWith('#123456')
      expect(onBackgroundChange).not.toHaveBeenCalled()
      fireEvent.change(picker, { target: { value: '#123456' } })
      expect(onBackgroundChange).toHaveBeenCalledTimes(1)
      expect(onBackgroundChange).toHaveBeenCalledWith({
        ...DEFAULT_BACKGROUND,
        colour: '#123456',
        kind: 'colour',
      })
      expect(onPreviewColour).toHaveBeenLastCalledWith(null)
    })

    it('clears an uncommitted page preview when the native colour picker is cancelled', () => {
      const { onBackgroundChange, onPreviewColour } = renderPanel({
        background: { ...DEFAULT_BACKGROUND, kind: 'colour' },
      })
      const picker = screen.getByLabelText('Choose custom colour')

      fireEvent.input(picker, { target: { value: '#123456' } })
      fireEvent(picker, new Event('cancel', { bubbles: true }))

      expect(onBackgroundChange).not.toHaveBeenCalled()
      expect(onPreviewColour).toHaveBeenLastCalledWith(null)
    })

    it('clears the preview when changing background modes', () => {
      const { onBackgroundChange, onPreviewColour } = renderPanel({
        background: { ...DEFAULT_BACKGROUND, kind: 'colour' },
      })
      fireEvent.input(screen.getByLabelText('Choose custom colour'), {
        target: { value: '#123456' },
      })

      choose('Background', 'Photo')

      expect(onBackgroundChange).toHaveBeenCalledWith({ ...DEFAULT_BACKGROUND, kind: 'photo' })
      expect(onPreviewColour).toHaveBeenLastCalledWith(null)
    })

    it('shows the update message and disables background controls when its item is newer', () => {
      renderPanel({ backgroundReadOnly: true })

      expect(screen.getByText('Update Lander to change this.')).toBeTruthy()
      expect(
        screen
          .getByRole('combobox', { name: 'Background' })
          .closest('fieldset')
          ?.hasAttribute('disabled'),
      ).toBe(true)
    })

    it('accepts a valid hex value and explains an invalid one', () => {
      const { onBackgroundChange } = renderPanel({
        background: { ...DEFAULT_BACKGROUND, kind: 'colour' },
      })
      const hex = screen.getByRole('textbox', { name: 'Hex colour' })

      fireEvent.input(hex, { target: { value: '1a2b3c' } })
      fireEvent.keyDown(hex, { key: 'Enter' })
      expect(onBackgroundChange).toHaveBeenLastCalledWith({
        ...DEFAULT_BACKGROUND,
        colour: '#1a2b3c',
        kind: 'colour',
      })
      fireEvent.input(hex, { target: { value: '12345g' } })
      fireEvent.keyDown(hex, { key: 'Enter' })
      expect(screen.getByText('Use six digits, like 1a2b3c')).toBeTruthy()
    })

    it('commits a valid hex value when the field loses focus', () => {
      const { onBackgroundChange } = renderPanel({
        background: { ...DEFAULT_BACKGROUND, kind: 'colour' },
      })
      const hex = screen.getByRole('textbox', { name: 'Hex colour' })

      fireEvent.input(hex, { target: { value: '#a1b2c3' } })
      fireEvent.blur(hex)

      expect(onBackgroundChange).toHaveBeenCalledWith({
        ...DEFAULT_BACKGROUND,
        colour: '#a1b2c3',
        kind: 'colour',
      })
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

  describe('tour', () => {
    const TOUR: SettingsStop[] = [
      { body: 'About the font.', id: 'tour-general', section: 'general', title: 'Font stop' },
      { body: 'About the photos.', id: 'tour-photos', section: 'photos', title: 'Photos stop' },
    ]

    const renderTour = () => {
      const onClose = vi.fn()
      render(
        <SettingsPanel
          currentId="a"
          onChange={vi.fn()}
          onClose={onClose}
          photos={PHOTOS}
          settings={settings}
          tour={TOUR}
        />,
      )
      return { onClose }
    }

    const selectedTab = () => screen.getByRole('tab', { selected: true }).textContent

    it('opens on the section named by initialSection', () => {
      render(
        <SettingsPanel
          currentId="a"
          initialSection="general"
          onChange={vi.fn()}
          onClose={vi.fn()}
          photos={PHOTOS}
          settings={settings}
        />,
      )

      expect(selectedTab()).toBe('General')
      expect(screen.queryByRole('note')).toBeNull()
    })

    it('starts on the first stop and its section', () => {
      renderTour()

      expect(selectedTab()).toBe('General')
      const note = screen.getByRole('note')
      expect(within(note).getByText('Font stop')).toBeTruthy()
      expect(within(note).getByText('About the font.')).toBeTruthy()
      expect(within(note).getByText('1 of 2')).toBeTruthy()
    })

    it('moves to the next stop and its section, and ends after the last', async () => {
      renderTour()

      fireEvent.click(screen.getByRole('button', { name: 'Next' }))

      // The note fades out first, and comes back as the next stop.
      expect(screen.getByRole('note').classList.contains('callout--leaving')).toBe(true)
      await waitFor(() => expect(selectedTab()).toBe('Background'))
      expect(within(screen.getByRole('note')).getByText('2 of 2')).toBeTruthy()
      expect(screen.getByRole('note').classList.contains('callout--leaving')).toBe(false)

      fireEvent.click(screen.getByRole('button', { name: 'Done' }))

      await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
      expect(selectedTab()).toBe('Background')
    })

    it('follows a section opened by hand, and stays put on one it has no stop for', () => {
      renderTour()

      openSection('Background')
      expect(within(screen.getByRole('note')).getByText('Photos stop')).toBeTruthy()

      openSection('General')
      expect(within(screen.getByRole('note')).getByText('Font stop')).toBeTruthy()
    })

    it('counts the stops with the ones on the page when it carries on from them', () => {
      render(
        <SettingsPanel
          currentId="a"
          onChange={vi.fn()}
          onClose={vi.fn()}
          photos={PHOTOS}
          settings={settings}
          tour={TOUR}
          tourProgress={{ before: 5, total: 7 }}
        />,
      )

      expect(within(screen.getByRole('note')).getByText('6 of 7')).toBeTruthy()
    })

    it('has focus on the Close button when it is opened alone, and on its Next button when it carries on from the page', () => {
      const { unmount } = render(
        <SettingsPanel
          currentId="a"
          onChange={vi.fn()}
          onClose={vi.fn()}
          photos={PHOTOS}
          settings={settings}
          tour={TOUR}
        />,
      )
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close settings' }))
      unmount()

      render(
        <SettingsPanel
          currentId="a"
          onChange={vi.fn()}
          onClose={vi.fn()}
          photos={PHOTOS}
          settings={settings}
          tour={TOUR}
          tourProgress={{ before: 5, total: 7 }}
        />,
      )
      // Where the page's Next button had it: the next press goes on with the tour.
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }))
    })

    it('puts focus on the Close button when the last stop is done, or the note dismissed', async () => {
      renderTour()
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      await waitFor(() => expect(selectedTab()).toBe('Background'))
      const done = screen.getByRole('button', { name: 'Done' })
      done.focus()

      fireEvent.click(done)

      await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close settings' }))
    })

    it('leaves focus alone when the tour ends with it on something else', async () => {
      renderTour()
      const tab = screen.getByRole('tab', { name: 'Background' })
      tab.focus()

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

      await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
      expect(document.activeElement).toBe(tab)
    })

    it('ends when dismissed, without closing the settings', async () => {
      const { onClose } = renderTour()

      // A press on the note is inside the panel, not a click outside it.
      fireEvent.pointerDown(screen.getByRole('note'))
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

      await waitFor(() => expect(screen.queryByRole('note')).toBeNull())
      expect(onClose).not.toHaveBeenCalled()

      // And it doesn't come back with the next section.
      openSection('General')
      expect(screen.queryByRole('note')).toBeNull()
    })
  })
})

describe('SettingsPanel, when the settings are from a newer version', () => {
  const LINE = 'Update Lander to change this.'

  const renderReadOnly = (readOnly: boolean, shown: Settings = settings) => {
    const onChange = vi.fn()
    render(
      <SettingsPanel
        currentId="a"
        onChange={onChange}
        onClose={() => {}}
        photos={PHOTOS}
        readOnly={readOnly}
        settings={shown}
      />,
    )
    return { onChange }
  }

  /**
   * Every control in the open section, which the browser turns off with the fieldset around them
   * (the test DOM does not, so this looks for the fieldset).
   */
  const controlsInDisabledFieldset = () => {
    const section = screen.getByRole('tabpanel')
    const fieldset = section.querySelector('fieldset[disabled]')
    // The Edit button in General is not one of them: it changes no setting (see below).
    const controls = [...section.querySelectorAll('button, input, select')].filter(
      (control) => control.textContent !== 'Edit',
    )
    return { all: controls, inside: controls.filter((control) => fieldset?.contains(control)) }
  }

  it('says to update, at the top, and puts every control in the section in a disabled fieldset', () => {
    renderReadOnly(true)

    expect(screen.getByText(LINE)).toBeTruthy()
    const { all, inside } = controlsInDisabledFieldset()
    expect(all.length).toBeGreaterThan(0)
    expect(inside).toEqual(all)
  })

  it('describes the disabled fieldset with the line, so a screen reader hears why', () => {
    renderReadOnly(true)

    const fieldset = screen.getByRole('tabpanel').querySelector('fieldset[disabled]')
    const describedBy = fieldset?.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(LINE)
  })

  it('has no description on the fieldset when the settings can be changed', () => {
    renderReadOnly(false)

    expect(
      screen.getByRole('tabpanel').querySelector('fieldset')?.hasAttribute('aria-describedby'),
    ).toBe(false)
  })

  it('does so in every section, and keeps the tabs enabled to look around', () => {
    renderReadOnly(true)

    for (const name of ['General', 'Background']) {
      openSection(name)
      const { all, inside } = controlsInDisabledFieldset()
      expect(all.length).toBeGreaterThan(0)
      expect(inside).toEqual(all)
    }
    expect(screen.getByRole('tab', { name: 'General' }).closest('fieldset')).toBeNull()
  })

  it('is as it was, with no line, when the settings can be changed', () => {
    renderReadOnly(false)

    expect(screen.queryByText(LINE)).toBeNull()
    expect(screen.getByRole('tabpanel').querySelector('fieldset[disabled]')).toBeNull()
  })
})
