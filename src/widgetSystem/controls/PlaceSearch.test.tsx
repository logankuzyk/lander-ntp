import { act, fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PlaceSearch } from './PlaceSearch'

// The search box on its own: what it asks for, what it suggests, and how the keys work it. These
// were the settings panel's tests of the place search until the panel lost the Weather's options.

/** What the search finds is kept to two decimals (see weather/openMeteo). */
const VICTORIA = { latitude: 48.44, longitude: -123.35, name: 'Victoria' }

const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)))
/** Longer than the pause before a search goes out. */
const PAUSE = 350

const answer = (names: readonly string[]) => ({
  json: () =>
    Promise.resolve({
      results: names.map((name, id) => ({
        country: 'Canada',
        id,
        latitude: 48.4359,
        longitude: -123.35155,
        name,
      })),
    }),
  ok: true,
})

const found = (...names: string[]) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer(names)))

const draw = () => {
  const onSelect = vi.fn()
  const onLocate = vi.fn()
  render(<PlaceSearch locateFailed={false} onLocate={onLocate} onSelect={onSelect} />)
  return {
    box: screen.getByRole<HTMLInputElement>('combobox', { name: 'Search for a place' }),
    onLocate,
    onSelect,
  }
}

const type = (box: HTMLElement, value: string) => {
  fireEvent.focus(box)
  fireEvent.input(box, { target: { value } })
}

/** Two suggestions for "Vic", with the box focused and the list open. */
const searched = async () => {
  found('Victoria', 'Victoriaville')
  const drawn = draw()
  type(drawn.box, 'Vic')
  await screen.findByRole('option', { name: 'Victoria, Canada' })
  return drawn
}

const active = () =>
  screen.queryAllByRole('option').find((option) => option.getAttribute('aria-selected') === 'true')
    ?.textContent

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PlaceSearch', () => {
  it('searches for a place and gives the one picked', async () => {
    found('Victoria')
    const { box, onSelect } = draw()

    type(box, 'Victoria')
    fireEvent.click(await screen.findByRole('option', { name: 'Victoria, Canada' }))

    expect(onSelect).toHaveBeenCalledWith(VICTORIA)
  })

  it('searches once the typing pauses, for the text as it then is', async () => {
    found('Victoria')
    const { box } = draw()

    fireEvent.focus(box)
    for (const value of ['V', 'Vi', 'Vic']) fireEvent.input(box, { target: { value } })
    await screen.findByRole('option', { name: 'Victoria, Canada' })

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('name=Vic')
  })

  it('puts each suggestion in the box as the arrow keys reach it, and the typed text between', async () => {
    const { box } = await searched()

    fireEvent.keyDown(box, { key: 'ArrowDown' })
    expect(box.value).toBe('Victoria, Canada')
    expect(active()).toBe('Victoria, Canada')
    expect(box.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: 'Victoria, Canada' }).id,
    )

    fireEvent.keyDown(box, { key: 'ArrowDown' })
    expect(box.value).toBe('Victoriaville, Canada')
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    expect(box.value).toBe('Vic')
    expect(active()).toBeUndefined()

    fireEvent.keyDown(box, { key: 'ArrowUp' })
    expect(box.value).toBe('Victoriaville, Canada')
  })

  it('takes the suggestion in the box with Enter, and nothing when there is none', async () => {
    const { box, onSelect } = await searched()

    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSelect).not.toHaveBeenCalled()

    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(VICTORIA)
    expect(screen.queryByRole('listbox', { name: 'Places' })).toBeNull()
  })

  it('offers the current location only until there are places to show', async () => {
    const { box, onLocate } = await searched()
    expect(screen.queryByRole('option', { name: 'Current location' })).toBeNull()

    fireEvent.input(box, { target: { value: '' } })
    fireEvent.click(screen.getByRole('option', { name: 'Current location' }))

    expect(screen.queryByRole('option', { name: 'Victoria, Canada' })).toBeNull()
    expect(onLocate).toHaveBeenCalledTimes(1)
  })

  it('closes only the suggestions with Escape, leaving the typed text, and lets nothing else see it', async () => {
    const { box } = await searched()
    fireEvent.keyDown(box, { key: 'ArrowDown' })

    // `fireEvent` says false when the page's handler stopped it: the popover around the box
    // closes on an Escape that nobody has used, and this one is used.
    const unused = fireEvent.keyDown(box, { key: 'Escape' })

    expect(unused).toBe(false)
    expect(screen.queryByRole('listbox', { name: 'Places' })).toBeNull()
    expect(box.value).toBe('Vic')
    expect(box.getAttribute('aria-expanded')).toBe('false')
  })

  it('leaves Escape for whatever the box sits in when no suggestions are open', () => {
    found()
    const { box } = draw()

    expect(fireEvent.keyDown(box, { key: 'Escape' })).toBe(true)
  })

  it('says when nothing matches', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({}), ok: true }))
    const { box } = draw()

    type(box, 'qqq')

    expect(await screen.findByText('No places found.')).toBeTruthy()
  })

  it('says when the search fails, and not before it has', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { box } = draw()
    expect(screen.queryByText('Couldn’t search just now.')).toBeNull()

    type(box, 'qqq')

    expect(await screen.findByText('Couldn’t search just now.')).toBeTruthy()
    expect(screen.queryByText('No places found.')).toBeNull()
  })

  it('shows the answer to the text as it is now, not a slower one to text since typed over', async () => {
    let slow: (value: unknown) => void = () => {}
    const fetch = vi
      .fn()
      .mockReturnValueOnce(new Promise((resolve) => (slow = resolve)))
      .mockResolvedValueOnce(answer(['Vancouver']))
    vi.stubGlobal('fetch', fetch)
    const { box } = draw()

    type(box, 'Vic')
    await wait(PAUSE)
    fireEvent.input(box, { target: { value: 'Vanc' } })
    await wait(PAUSE)
    expect(await screen.findByRole('option', { name: 'Vancouver, Canada' })).toBeTruthy()

    // The answer to "Vic" arrives last, and is not wanted.
    await act(async () => slow(answer(['Victoria'])))
    // Long enough for the answer to have gone through the search and been looked at.
    await wait(50)

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('option', { name: 'Victoria, Canada' })).toBeNull()
    expect(screen.getByRole('option', { name: 'Vancouver, Canada' })).toBeTruthy()
  })
})
