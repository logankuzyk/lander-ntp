import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@/entrypoints/newtab/App'
import { onboardingItem } from '@/onboarding/storage'

import * as stories from './AddMenu.stories'

type StoryName = Exclude<keyof typeof stories, 'default'>

type Seeded = { beforeEach: () => Promise<(() => void) | void> }

const fetchSpy = vi.fn()

beforeEach(() => {
  fetchSpy.mockReset()
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

/** Seeds a story's storage as Storybook does, with a stand-in for the network put back after. */
async function seed(name: StoryName) {
  const restore = await (stories[name] as unknown as Seeded).beforeEach()
  if (restore) restore()
  vi.stubGlobal('fetch', fetchSpy)
}

/** Opens the menu as the stories' `play` does. */
async function openMenu() {
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Add' }))
  return screen.getByRole('menu', { name: 'Add a widget' })
}

describe('the Add menu stories', () => {
  it('shows new marks until the menu has been opened, then stores them in one onboarding record', async () => {
    await seed('Open')
    await onboardingItem.setValue({ dismissed: [], welcomed: true })
    const write = vi.spyOn(onboardingItem, 'setValue')
    render(<App />)

    const menu = await openMenu()

    await waitFor(() => expect(menu.querySelectorAll('.new-mark')).toHaveLength(2))
    await waitFor(async () =>
      expect((await onboardingItem.getValue())?.dismissed).toEqual(['clock', 'weather-widget']),
    )
    expect(write).toHaveBeenCalledTimes(1)
    expect(menu.querySelectorAll('.new-mark')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('menu', { name: 'Add a widget' }).querySelector('.new-mark')).toBeNull()
  })

  it('Open seeds a new install whose menu offers the Clock and the Weather', async () => {
    await seed('Open')
    render(<App />)

    const menu = await openMenu()

    for (const name of ['Clock', 'Weather']) {
      expect(within(menu).getByRole('menuitem', { name }).getAttribute('aria-disabled')).toBeNull()
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('NoRoom seeds a Grid with no free cell, so that both items are unavailable', async () => {
    await seed('NoRoom')
    render(<App />)

    const menu = await openMenu()

    expect(within(menu).getByRole('menuitem', { name: /Weather/ }).textContent).toContain(
      'There is no room for a Weather.',
    )
    expect(within(menu).getByRole('menuitem', { name: /Clock/ }).textContent).toContain(
      'There is no room for a Clock.',
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('AtLimit seeds eight Widgets, so that both items are unavailable under the Widget limit line', async () => {
    await seed('AtLimit')
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelectorAll('.widget-box')).toHaveLength(8))

    const menu = await openMenu()

    expect(menu.parentElement?.querySelector('.add-menu__note')?.textContent).toBe(
      "That's all 8 widgets. Remove one to add another.",
    )
    for (const name of ['Clock', 'Weather']) {
      const item = within(menu).getByRole('menuitem', { name })
      expect(item.getAttribute('aria-disabled')).toBe('true')
      // The line is the menu's, once: not repeated in the item.
      expect(item.textContent).toBe(name)
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('OverLimit seeds nine Widgets, so that the Add menu is unavailable until one is removed', async () => {
    await seed('OverLimit')
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelectorAll('.widget-box')).toHaveLength(9))

    const menu = await openMenu()

    expect(menu.parentElement?.querySelector('.add-menu__note')?.textContent).toBe(
      "That's all 8 widgets. Remove one to add another.",
    )
    expect(
      within(menu).getByRole('menuitem', { name: 'Clock' }).getAttribute('aria-disabled'),
    ).toBe('true')
  })

  it('WaitingOptions seeds an update with the Weather off, whose add starts from its kept place', async () => {
    await seed('WaitingOptions')
    render(<App />)

    const menu = await openMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Weather' }))

    const weather = await screen.findByRole('group', { name: 'Weather, Victoria' })
    await waitFor(() => expect(weather.textContent).toContain('13°'))
    // The kept place: no setup button.
    expect(screen.queryByRole('button', { name: /Choose a place/ })).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('AddedWeather seeds a new install whose added Weather shows its setup button', async () => {
    await seed('AddedWeather')
    render(<App />)

    const menu = await openMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Weather' }))

    expect(await screen.findByRole('button', { name: /Choose a place/ })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('EmptyGrid seeds an update with the Clock and the Weather off, and a Clock can be added', async () => {
    await seed('EmptyGrid')
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.grid')).not.toBeNull())
    expect(container.querySelectorAll('.widget-box')).toHaveLength(0)

    const menu = await openMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Clock' }))

    await waitFor(() => expect(container.querySelector('[data-widget="clock"]')).not.toBeNull())
  })
})

it('NewerLayout shows the update note and disables each Add choice', async () => {
  await seed('NewerLayout')
  render(<App />)
  const menu = await openMenu()
  expect(menu.parentElement?.querySelector('.add-menu__note')?.textContent).toBe(
    'Update Lander to change this.',
  )
  for (const name of ['Clock', 'Weather']) {
    expect(within(menu).getByRole('menuitem', { name }).getAttribute('aria-disabled')).toBe('true')
  }
})
