import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { devicePosition } from '@/weather/deviceLocation'
import { clockDefinition } from '@/widgets/Clock/definition'
import { weatherDefinition } from '@/widgets/Weather/definition'

import type { PageValues, WidgetDefinition } from './definition'
import { OptionsForm } from './OptionsForm'

const VICTORIA = { latitude: 48.44, longitude: -123.35, name: 'Victoria' }

/** A Widget with one option of every control, made up for these tests. */
const example: WidgetDefinition<Record<string, unknown>> = {
  credit: { href: 'https://example.com/', text: 'Data by Example' },
  name: 'Example',
  options: [
    { control: 'switch', default: true, id: 'flag', label: 'Flag' },
    {
      choices: [
        { label: 'Small', value: 'small' },
        { label: 'Large', value: 'large' },
      ],
      control: 'choice',
      default: 'small',
      id: 'size',
      label: 'Size',
    },
    {
      control: 'place',
      default: { followDevice: false, place: null },
      id: 'place',
      label: 'Place',
    },
    {
      control: 'orderedList',
      default: [
        { id: 'a', shown: true },
        { id: 'b', shown: false },
      ],
      id: 'rows',
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Bravo' },
      ],
      label: 'Rows',
    },
    { control: 'switch', id: 'hour12', label: 'Twelve-hour time', shared: 'hour12' },
  ],
  type: 'example',
  View: () => null,
}

const stored = {
  flag: false,
  followDevice: false,
  place: VICTORIA,
  rows: [
    { id: 'b', shown: true },
    { id: 'a', shown: false },
  ],
  size: 'large',
}

const PAGE: PageValues = { hour12: false }

type Props = Parameters<typeof OptionsForm>[0]

const draw = (props: Partial<Props> = {}) => {
  const onChange = vi.fn()
  const onPageValueChange = vi.fn()
  const view = (given: Partial<Props>) => (
    <OptionsForm
      definition={example}
      onChange={onChange}
      onPageValueChange={onPageValueChange}
      options={stored}
      page={PAGE}
      {...props}
      {...given}
    />
  )
  const rendered = render(view({}))
  return {
    ...rendered,
    onChange,
    onPageValueChange,
    rerender: (given: Partial<Props>) => rendered.rerender(view(given)),
  }
}

const checked = (name: string) => (screen.getByRole('switch', { name }) as HTMLInputElement).checked

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OptionsForm', () => {
  describe('draws each kind of control from the description', () => {
    it('a switch, on or off as stored', () => {
      draw()
      expect(checked('Flag')).toBe(false)

      draw({ options: { ...stored, flag: true } })
      expect(
        screen
          .getAllByRole('switch', { name: 'Flag' })
          .map((el) => (el as HTMLInputElement).checked),
      ).toEqual([false, true])
    })

    it('a choice, showing the value stored', () => {
      draw()

      expect(screen.getByRole('combobox', { name: 'Size' }).textContent).toContain('Large')
    })

    it('a place, naming the one stored, or the search with none', () => {
      draw()
      expect(screen.getByText(/^Victoria/)).toBeTruthy()
      expect(screen.queryByRole('combobox', { name: 'Search for a place' })).toBeNull()

      draw({ options: { ...stored, place: null } })
      expect(screen.getByRole('combobox', { name: 'Search for a place' })).toBeTruthy()
    })

    it('an ordered list under a heading that names it, in the order stored', () => {
      draw()

      const list = screen.getByRole('list', { name: 'Rows' })
      expect(screen.getByRole('heading', { name: 'Rows' }).tagName).toBe('H3')
      expect(
        within(list)
          .getAllByRole('listitem')
          .map((row) => row.textContent),
      ).toEqual(['Bravo', 'Alpha'])
      expect(screen.getByRole('button', { name: 'Show Bravo' }).getAttribute('aria-pressed')).toBe(
        'true',
      )
      expect(screen.getByRole('button', { name: 'Show Alpha' }).getAttribute('aria-pressed')).toBe(
        'false',
      )
    })

    it('in the order of the description', () => {
      draw()

      const labels = [
        ...screen.getAllByRole('switch').map((el) => el.closest('label')?.textContent),
      ]
      expect(labels).toEqual(['Flag', 'Twelve-hour time'])
      const order = [
        screen.getByRole('switch', { name: 'Flag' }),
        screen.getByRole('combobox', { name: 'Size' }),
        screen.getByText(/^Victoria/),
        screen.getByRole('list', { name: 'Rows' }),
        screen.getByRole('switch', { name: 'Twelve-hour time' }),
      ]
      order.slice(1).forEach((after, index) => {
        const before = order[index] as HTMLElement
        expect(
          before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy()
      })
    })

    it('shows what the Widget draws when a stored key is bad, which is its defaults', () => {
      draw({ options: { ...stored, size: 'huge' } })

      expect(screen.getByRole('combobox', { name: 'Size' }).textContent).toContain('Small')
      expect(checked('Flag')).toBe(true)
    })

    it('shows the defaults when nothing is stored', () => {
      draw({ options: undefined })

      expect(checked('Flag')).toBe(true)
      expect(screen.getByRole('combobox', { name: 'Size' }).textContent).toContain('Small')
      expect(screen.getByRole('combobox', { name: 'Search for a place' })).toBeTruthy()
    })
  })

  describe('calls onChange once per change, with the whole options', () => {
    it('for a switch', () => {
      const { onChange, onPageValueChange } = draw()

      fireEvent.click(screen.getByRole('switch', { name: 'Flag' }))

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith({ ...stored, flag: true })
      expect(onPageValueChange).not.toHaveBeenCalled()
    })

    it('for a choice', () => {
      const { onChange } = draw()

      fireEvent.click(screen.getByRole('combobox', { name: 'Size' }))
      fireEvent.click(screen.getByRole('option', { name: 'Small' }))

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith({ ...stored, size: 'small' })
    })

    it('for a place picked, with both of its keys in the one call', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          json: () =>
            Promise.resolve({
              results: [
                {
                  admin1: 'British Columbia',
                  country: 'Canada',
                  id: 1,
                  latitude: 48.4359,
                  longitude: -123.35155,
                  name: 'Victoria',
                },
              ],
            }),
          ok: true,
        }),
      )
      const { onChange } = draw({ options: { ...stored, followDevice: true, place: null } })
      expect(screen.queryByRole('combobox', { name: 'Search for a place' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Change' }))

      fireEvent.input(screen.getByRole('combobox', { name: 'Search for a place' }), {
        target: { value: 'Victoria' },
      })
      fireEvent.click(
        await screen.findByRole('option', { name: 'Victoria, British Columbia, Canada' }),
      )

      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith({
        ...stored,
        followDevice: false,
        place: VICTORIA,
      })
    })

    it('for an ordered list, reordered or shown or hidden', () => {
      const { onChange } = draw()

      fireEvent.click(screen.getByRole('button', { name: 'Show Alpha' }))
      expect(onChange).toHaveBeenLastCalledWith({
        ...stored,
        rows: [
          { id: 'b', shown: true },
          { id: 'a', shown: true },
        ],
      })

      fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Bravo' }), {
        key: 'ArrowDown',
      })
      expect(onChange).toHaveBeenLastCalledWith({
        ...stored,
        rows: [
          { id: 'a', shown: false },
          { id: 'b', shown: true },
        ],
      })
      expect(onChange).toHaveBeenCalledTimes(2)
    })

    it('keeping keys it does not know, and putting right only the key that failed its check', () => {
      const { onChange } = draw({
        options: { ...stored, added: { by: 'a newer device' }, size: 'huge' },
      })

      fireEvent.click(screen.getByRole('switch', { name: 'Flag' }))

      expect(onChange).toHaveBeenCalledWith({
        ...stored,
        added: { by: 'a newer device' },
        // Drawn from its defaults (so on), and so switched off; only the size that failed its
        // check is put right, and the place and list stay as stored.
        flag: false,
        size: 'small',
      })
    })

    it('from the options it was given at the last render: two changes before the parent feeds the first back lose the first', () => {
      // The documented contract: whoever draws the form hands the new options back at once.
      const { onChange } = draw()

      fireEvent.click(screen.getByRole('switch', { name: 'Flag' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Size' }))
      fireEvent.click(screen.getByRole('option', { name: 'Small' }))

      expect(onChange).toHaveBeenCalledTimes(2)
      expect(onChange).toHaveBeenLastCalledWith({ ...stored, flag: false, size: 'small' })
    })

    it('from the options as they are now, when they change between two changes', () => {
      const { onChange, rerender } = draw()

      fireEvent.click(screen.getByRole('switch', { name: 'Flag' }))
      rerender({ options: { ...stored, flag: true } })
      fireEvent.click(screen.getByRole('combobox', { name: 'Size' }))
      fireEvent.click(screen.getByRole('option', { name: 'Small' }))

      expect(onChange).toHaveBeenLastCalledWith({ ...stored, flag: true, size: 'small' })
    })
  })

  describe('a shared option', () => {
    it('is shown from the page, and calls the page-value callback and not onChange', () => {
      const { onChange, onPageValueChange, rerender } = draw()
      expect(checked('Twelve-hour time')).toBe(false)

      fireEvent.click(screen.getByRole('switch', { name: 'Twelve-hour time' }))

      expect(onPageValueChange).toHaveBeenCalledTimes(1)
      expect(onPageValueChange).toHaveBeenCalledWith('hour12', true)
      expect(onChange).not.toHaveBeenCalled()

      rerender({ page: { hour12: true } })
      expect(checked('Twelve-hour time')).toBe(true)
    })

    it('says it applies to every time on the page', () => {
      draw()

      expect(screen.getByText('Applies to every time on the page.')).toBeTruthy()
    })

    it('is not read from what is stored for the Widget', () => {
      draw({ options: { ...stored, hour12: true } })

      expect(checked('Twelve-hour time')).toBe(false)
    })

    it('is not in the options a change gives back', () => {
      const { onChange } = draw({ options: { ...stored, hour12: true } })

      fireEvent.click(screen.getByRole('switch', { name: 'Flag' }))

      expect(onChange.mock.calls[0]?.[0]).not.toHaveProperty('hour12')
    })
  })

  describe('"24-hour time", which is the opposite of the hour12 it shows', () => {
    const clock = (page: PageValues) => ({
      definition: clockDefinition,
      options: { showDate: false, showSeconds: false },
      page,
    })

    it('is on when the page is not 12-hour, and off when it is', () => {
      const { rerender } = draw(clock({ hour12: false }))
      expect(checked('24-hour time')).toBe(true)

      rerender(clock({ hour12: true }))
      expect(checked('24-hour time')).toBe(false)
    })

    it('hands the page the inverse of what the switch says', () => {
      const { onPageValueChange, rerender } = draw(clock({ hour12: true }))

      fireEvent.click(screen.getByRole('switch', { name: '24-hour time' }))
      expect(onPageValueChange).toHaveBeenLastCalledWith('hour12', false)

      rerender(clock({ hour12: false }))
      fireEvent.click(screen.getByRole('switch', { name: '24-hour time' }))
      expect(onPageValueChange).toHaveBeenLastCalledWith('hour12', true)
    })

    it('does the same on a Weather', () => {
      const { onPageValueChange } = draw({
        definition: weatherDefinition,
        options: { place: VICTORIA },
        page: { hour12: true },
      })
      expect(checked('24-hour time')).toBe(false)

      fireEvent.click(screen.getByRole('switch', { name: '24-hour time' }))

      expect(onPageValueChange).toHaveBeenCalledWith('hour12', false)
    })
  })

  describe('the Clock and the Weather', () => {
    it("draw the Clock's three switches and nothing to show or hide it", () => {
      draw({ definition: clockDefinition, options: undefined })

      expect(screen.getAllByRole('switch').map((el) => el.closest('label')?.textContent)).toEqual([
        'Show date',
        'Show seconds',
        '24-hour time',
      ])
      expect(screen.queryByRole('switch', { name: /^Show (clock|weather)$/i })).toBeNull()
    })

    it("draw the Weather's place, units, lines, 24-hour time and its credit", () => {
      draw({ definition: weatherDefinition, options: undefined })

      expect(screen.getByRole('combobox', { name: 'Search for a place' })).toBeTruthy()
      expect(screen.getByRole('combobox', { name: 'Units' })).toBeTruthy()
      expect(
        within(screen.getByRole('list', { name: 'Show' }))
          .getAllByRole('listitem')
          .map((row) => row.textContent),
      ).toEqual(['High and low', 'Location', 'Sunrise and sunset', 'Conditions', 'Feels like'])
      expect(screen.getByRole('switch', { name: '24-hour time' })).toBeTruthy()
      const credit = screen.getByRole('link', { name: 'Weather data by Open-Meteo.com' })
      expect(credit.getAttribute('href')).toBe('https://open-meteo.com/')
    })
  })

  describe('the credit', () => {
    it('is a link after the last option, when the description has one', () => {
      draw()

      const link = screen.getByRole('link', { name: 'Data by Example' })
      expect(link.getAttribute('href')).toBe('https://example.com/')
      const last = screen.getByRole('switch', { name: 'Twelve-hour time' })
      expect(last.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('is left out when it has none', () => {
      draw({ definition: clockDefinition, options: undefined })

      expect(screen.queryByRole('link')).toBeNull()
    })
  })

  describe('focusOption', () => {
    it('focuses a switch with that option id on mount', async () => {
      draw({ focusOption: 'flag' })

      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Flag' })),
      )
    })

    it('focuses a choice', async () => {
      draw({ focusOption: 'size' })

      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Size' })),
      )
    })

    it('focuses the place search when there is no place, which is what setup needs', async () => {
      draw({ focusOption: 'place', options: { ...stored, place: null } })

      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('combobox', { name: 'Search for a place' }),
        ),
      )
    })

    it("focuses a place's Change button once there is a place", async () => {
      draw({ focusOption: 'place' })

      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change' })),
      )
    })

    it("focuses an ordered list's first handle", async () => {
      draw({ focusOption: 'rows' })

      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reorder Bravo' })),
      )
    })

    it("focuses a shared option's switch", async () => {
      draw({ focusOption: 'hour12' })

      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole('switch', { name: 'Twelve-hour time' }),
        ),
      )
    })

    it('focuses nothing for an id the description does not have', async () => {
      draw({ focusOption: 'nowhere' })

      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(document.activeElement).toBe(document.body)
    })

    it('focuses nothing when it is not given, and only on mount', async () => {
      const { rerender } = draw()
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(document.activeElement).toBe(document.body)

      rerender({ focusOption: 'size' })
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(document.activeElement).toBe(document.body)
    })
  })

  describe('disabled', () => {
    it('shows every control, as the options are, with none of them enabled', () => {
      draw({ disabled: true })

      expect(checked('Flag')).toBe(false)
      expect(screen.getByRole('combobox', { name: 'Size' }).textContent).toContain('Large')
      for (const control of [
        screen.getByRole('switch', { name: 'Flag' }),
        screen.getByRole('switch', { name: 'Twelve-hour time' }),
        screen.getByRole('combobox', { name: 'Size' }),
        screen.getByRole('button', { name: 'Change' }),
        screen.getByRole('button', { name: 'Show Alpha' }),
        screen.getByRole('button', { name: 'Reorder Alpha' }),
      ]) {
        expect(control.matches(':disabled')).toBe(true)
      }
    })

    it('calls neither callback when a control is pressed', () => {
      const { onChange, onPageValueChange } = draw({ disabled: true })

      fireEvent.click(screen.getByRole('switch', { name: 'Flag' }))
      fireEvent.click(screen.getByRole('switch', { name: 'Twelve-hour time' }))
      fireEvent.click(screen.getByRole('button', { name: 'Show Alpha' }))
      fireEvent.click(screen.getByRole('combobox', { name: 'Size' }))
      fireEvent.click(screen.getByRole('button', { name: 'Change' }))

      expect(screen.queryAllByRole('option')).toHaveLength(0)
      expect(screen.queryByRole('combobox', { name: 'Search for a place' })).toBeNull()
      expect(onChange).not.toHaveBeenCalled()
      expect(onPageValueChange).not.toHaveBeenCalled()
    })

    it('calls neither callback for a change that reaches a switch anyway', () => {
      const { onChange, onPageValueChange } = draw({ disabled: true })

      fireEvent.change(screen.getByRole('switch', { name: 'Flag' }))
      fireEvent.change(screen.getByRole('switch', { name: 'Twelve-hour time' }))

      expect(onChange).not.toHaveBeenCalled()
      expect(onPageValueChange).not.toHaveBeenCalled()
    })

    it('calls onChange for no change that was waiting on the browser when it became disabled', async () => {
      let answer: (position: unknown) => void = () => undefined
      vi.stubGlobal('navigator', {
        geolocation: { getCurrentPosition: (done: (position: unknown) => void) => (answer = done) },
        language: 'en-CA',
      })
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ json: () => Promise.resolve({ city: 'Victoria' }), ok: true }),
      )
      const { onChange, rerender } = draw({ options: { ...stored, place: null } })
      const search = screen.getByRole('combobox', { name: 'Search for a place' })
      fireEvent.focus(search)
      fireEvent.click(screen.getByRole('option', { name: 'Current location' }))

      rerender({ disabled: true, options: { ...stored, place: null } })
      answer({ coords: { latitude: 48.4359, longitude: -123.35155 } })
      // The position is put away just before the change would have been made.
      await waitFor(async () => expect(await devicePosition.getValue()).not.toBeNull())
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(onChange).not.toHaveBeenCalled()
    })

    it('is enabled again when it is not disabled', () => {
      const { rerender } = draw({ disabled: true })

      rerender({ disabled: false })

      expect(screen.getByRole('switch', { name: 'Flag' }).matches(':disabled')).toBe(false)
    })
  })
})
