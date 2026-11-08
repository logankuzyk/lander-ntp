import { act, fireEvent, render, screen, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AddMenuControlProvider } from '@/components/AddMenu/useAddMenuControl'
import { EditModeProvider } from '@/components/EditMode/useEditMode'
import type { Layout } from '@/layout/types'
import type { PageCallout } from '@/onboarding/callouts'

import { PageNews } from './PageNews'

const layout: Layout = { extra: {}, widgets: [] }
const news: PageCallout = {
  actionLabel: 'Show me',
  body: 'A three stop walk.',
  id: 'made-up-walk',
  target: 'edit',
  title: 'Walk the page',
  walk: [
    {
      body: 'First stop.',
      id: 'one',
      show: { adding: false, editing: false },
      target: 'edit',
      title: 'First',
    },
    {
      body: 'Open Add.',
      id: 'two',
      show: { adding: true, editing: true },
      target: 'menu-item',
      title: 'Second',
    },
    {
      body: 'Finish.',
      id: 'three',
      show: { adding: false, editing: true },
      target: 'edit',
      title: 'Third',
    },
  ],
}

const dismiss = vi.fn()
const openSettings = vi.fn()

function renderNews(item = news) {
  return render(
    <EditModeProvider>
      <AddMenuControlProvider>
        <button data-callout-target="edit" data-edit-toggle type="button">
          Edit
        </button>
        <button data-callout-target="menu:clock" type="button">
          Clock
        </button>
        <PageNews dismiss={dismiss} layout={layout} news={item} openSettings={openSettings} />
      </AddMenuControlProvider>
    </EditModeProvider>,
  )
}

beforeEach(() => {
  dismiss.mockReset()
  openSettings.mockReset()
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(100, 100, 40, 40),
  )
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(256)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(140)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('an update note walk', () => {
  it('runs each stop in order and dismisses the note once at the end', async () => {
    renderNews()
    fireEvent.click(screen.getByRole('button', { name: 'Show me' }))
    await act(async () => {})
    expect(screen.getByRole('note').textContent).toContain('First')

    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Next' }))
    await act(async () => {})
    expect(screen.getByRole('note').textContent).toContain('Second')
    expect(screen.getByRole('button', { name: 'Clock' })).toBeTruthy()

    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Next' }))
    await act(async () => {})
    expect(screen.getByRole('note').textContent).toContain('Third')
    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Next' }))
    await act(async () => {})
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(dismiss).toHaveBeenCalledWith('made-up-walk')
  })

  it('dismisses the entire walk with one stored id', async () => {
    renderNews()
    fireEvent.click(screen.getByRole('button', { name: 'Show me' }))
    await act(async () => {})
    fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Dismiss' }))
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(dismiss).toHaveBeenCalledWith('made-up-walk')
  })

  it('hands a settings stop to the panel tour as one stop', async () => {
    const panelWalk: PageCallout = {
      ...news,
      walk: [{ body: 'Set the font.', id: 'panel-font', section: 'general', title: 'Font' }],
    }
    renderNews(panelWalk)
    fireEvent.click(screen.getByRole('button', { name: 'Show me' }))
    await act(async () => {})

    expect(dismiss).toHaveBeenCalledWith('made-up-walk')
    expect(openSettings).toHaveBeenCalledWith('general', {
      before: 0,
      stops: [{ body: 'Set the font.', id: 'panel-font', section: 'general', title: 'Font' }],
      total: 1,
    })
  })
})
