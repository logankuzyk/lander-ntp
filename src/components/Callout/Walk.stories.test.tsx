import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AddMenuControlProvider } from '@/components/AddMenu/useAddMenuControl'
import { onboardingItem } from '@/onboarding/storage'

import * as stories from './Walk.stories'

type StoryName = Exclude<keyof typeof stories, 'default'>
type Seeded = { beforeEach: () => Promise<void> }

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(1100, 834, 40, 40),
  )
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(256)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(140)
})

async function open(name: StoryName) {
  await (stories[name] as unknown as Seeded).beforeEach()
  const Component = stories.default.component
  const { container } = render(
    <AddMenuControlProvider>
      <Component />
    </AddMenuControlProvider>,
  )
  fireEvent.click(await screen.findByRole('button', { name: 'Show me' }))
  await act(async () => {})
  return container
}

async function advance() {
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
  await act(async () => {})
}

afterEach(async () => {
  await onboardingItem.setValue(null)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the update note walk stories', () => {
  it('shows the first stop', async () => {
    await open('FirstStop')
    expect(screen.getByRole('note').textContent).toContain('First stop')
  })

  it('opens the Add menu and keeps the Next action available', async () => {
    await open('WithMenuOpen')
    await advance()
    expect(await screen.findByRole('button', { name: 'Clock' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy()
  })

  it('opens photo details without closing the note or taking focus', async () => {
    await open('WithDetailsOpen')
    await advance()
    await advance()
    expect(await screen.findByRole('dialog', { name: 'Photo details' })).toBeTruthy()
    const next = screen.getByRole('button', { name: 'Next' })
    expect(document.activeElement).toBe(next)
    fireEvent.pointerDown(next)
    await waitFor(() => expect(screen.getByRole('note')).toBeTruthy())
  })
})
