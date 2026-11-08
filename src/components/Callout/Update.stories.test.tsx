import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from '@/entrypoints/newtab/App'
import { onboardingItem } from '@/onboarding/storage'
import { PAGE_SEEDS, seedPage } from '@/test/seed'

import * as noteStories from './PhaseThreeNote.stories'
import * as stories from './Update.stories'

type StoryName = Exclude<keyof typeof stories, 'default'>
type Seeded = { beforeEach: () => Promise<(() => void) | void> }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('matchMedia', () => ({
    addEventListener: () => {},
    matches: true,
    removeEventListener: () => {},
  }))
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(1100, 834, 40, 40),
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('style')
})

async function seed(name: StoryName) {
  const restore = await (stories[name] as unknown as Seeded).beforeEach()
  restore?.()
  vi.stubGlobal('fetch', vi.fn())
}

async function startWalk() {
  fireEvent.click(await screen.findByRole('button', { name: 'Show me' }))
  await screen.findByText('Four new Widgets')
}

describe('the phase three update stories', () => {
  it('PhaseThreeNote draws the note after the Layout note and starts its walk', async () => {
    const restore = await (noteStories.Note as unknown as Seeded).beforeEach()
    if (typeof restore === 'function') restore()
    vi.stubGlobal('fetch', vi.fn())
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Show me' }))

    expect(await screen.findByText('Four new Widgets')).toBeTruthy()
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('WidgetsInAdd opens Add and marks the four new Widget choices', async () => {
    await seed('WidgetsInAdd')
    const { container } = render(<App />)
    await startWalk()

    await waitFor(() =>
      expect(document.querySelector('[data-edit-toggle]')?.getAttribute('aria-pressed')).toBe(
        'true',
      ),
    )
    const menu = await screen.findByRole('menu', { name: 'Add a widget' })
    await waitFor(() => expect(menu.querySelectorAll('.new-mark')).toHaveLength(6))
    for (const type of ['date', 'analog-clock', 'bookmarks', 'quick-dial']) {
      expect(menu.querySelector(`[data-callout-target="menu:${type}"] .new-mark`)).toBeTruthy()
    }
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    expect(container.querySelector('.grid')).toBeTruthy()
  })

  it('WidgetsAtLimit still opens Add and shows the Widget limit line', async () => {
    await seed('WidgetsAtLimit')
    render(<App />)
    await startWalk()

    expect(await screen.findByRole('menu', { name: 'Add a widget' })).toBeTruthy()
    expect(screen.getByText(/That's all 8 widgets\. Remove one to add another\./)).toBeTruthy()
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('Heart opens photo details quietly and points at the favourite heart', async () => {
    await seed('Heart')
    render(<App />)
    await startWalk()
    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Next' }))

    const details = await screen.findByRole('dialog', { name: 'Photo details' })
    expect(details.querySelector('[data-callout-target="photo-heart"]')).toBeTruthy()
    expect(screen.getByRole('note').textContent).toContain('Favourite photos')
    expect(document.querySelector('[data-edit-toggle]')?.getAttribute('aria-pressed')).toBe('false')
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('Background opens Settings on its Background tab after the heart stop', async () => {
    await seed('Background')
    render(<App />)
    await startWalk()
    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Next' }))
    fireEvent.click(within(await screen.findByRole('note')).getByRole('button', { name: 'Next' }))

    const settings = await screen.findByRole('dialog', { name: 'Settings' })
    await waitFor(() =>
      expect(
        within(settings)
          .getByRole('tab', { name: /Background/ })
          .getAttribute('aria-selected'),
      ).toBe('true'),
    )
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('a colour background skips the missing heart stop and continues to Background', async () => {
    await seedPage(PAGE_SEEDS.colourDark)
    await onboardingItem.setValue({ dismissed: ['layout'], welcomed: true })
    render(<App />)
    await startWalk()
    vi.useFakeTimers()
    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Next' }))
    await act(async () => {})
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500)
    })

    const settings = screen.getByRole('dialog', { name: 'Settings' })
    expect(
      within(settings)
        .getByRole('tab', { name: /Background/ })
        .getAttribute('aria-selected'),
    ).toBe('true')
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })
})
