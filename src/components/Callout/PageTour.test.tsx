import { act, fireEvent, render, screen, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AddMenuControlProvider } from '@/components/AddMenu/useAddMenuControl'
import { EditModeProvider } from '@/components/EditMode/useEditMode'
import type { Layout } from '@/layout/types'
import type { TourStop } from '@/onboarding/callouts'

import { MISSING_MS, PageTour } from './PageTour'

// A tour of a few stops on a bare page, to see what it does with a stop whose target is not
// there. The page here has an Edit button and nothing else.

const STOPS: readonly TourStop[] = [
  {
    body: 'First.',
    id: 'first',
    show: { adding: false, editing: false },
    target: 'edit',
    title: 'First',
  },
  {
    body: 'Second, pointing at a thing that is never drawn.',
    id: 'second',
    show: { adding: false, editing: false },
    target: 'menu:nothing',
    title: 'Second',
  },
  {
    body: 'Third.',
    id: 'third',
    show: { adding: false, editing: false },
    target: 'edit',
    title: 'Third',
  },
  { body: 'In the panel.', id: 'panel', section: 'photos', title: 'Panel' },
]

const EMPTY_LAYOUT: Layout = { extra: {}, widgets: [] }

const onEnd = vi.fn()
const onFinish = vi.fn()
const openInfo = vi.fn()
const closeInfo = vi.fn()

function renderTour(
  stops: readonly TourStop[] = STOPS,
  info: { closeInfo?: () => void; openInfo?: () => void } = {},
) {
  return render(
    <EditModeProvider>
      <AddMenuControlProvider>
        <button data-callout-target="edit" data-edit-toggle type="button">
          Edit
        </button>
        <PageTour
          closeInfo={info.closeInfo}
          layout={EMPTY_LAYOUT}
          onEnd={onEnd}
          onFinish={onFinish}
          openInfo={info.openInfo}
          stops={stops}
        />
      </AddMenuControlProvider>
    </EditModeProvider>,
  )
}

beforeEach(() => {
  onEnd.mockReset()
  onFinish.mockReset()
  openInfo.mockReset()
  closeInfo.mockReset()
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(100, 800, 40, 40),
  )
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(256)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(140)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const title = () => screen.getByRole('note').querySelector('strong')?.textContent
const next = () =>
  fireEvent.click(within(screen.getByRole('note')).getByRole('button', { name: 'Next' }))

describe('focus when the tour starts', () => {
  it('goes to the Next button when it was dropped to the page', async () => {
    renderTour()
    await act(async () => {})

    expect(document.activeElement).toBe(
      within(screen.getByRole('note')).getByRole('button', { name: 'Next' }),
    )
  })

  it('stays where it is when it was on something', async () => {
    const view = render(<button type="button">a control</button>)
    const control = view.getByRole('button', { name: 'a control' })
    control.focus()

    renderTour()
    await act(async () => {})

    expect(document.activeElement).toBe(control)
  })
})

describe('photo details during a tour', () => {
  it('closes details when the run ends', async () => {
    const view = renderTour(
      [
        STOPS[0]!,
        {
          body: 'Look at the photo details.',
          id: 'details',
          show: { adding: false, editing: false, info: true },
          target: 'edit',
          title: 'Photo details',
        },
      ],
      { closeInfo, openInfo },
    )
    await act(async () => {})
    next()
    await act(async () => {})
    expect(openInfo).toHaveBeenCalledTimes(1)

    view.unmount()

    expect(closeInfo).toHaveBeenCalledTimes(1)
  })
})

describe('a stop whose target is not on the page', () => {
  it('is planned with the stops that have one: it is left to the page to say it is missing', async () => {
    renderTour()
    await act(async () => {})

    // Three stops on the page, and the panel's: a tour does not know what the page will draw.
    expect(screen.getByRole('note').querySelector('.callout__progress')?.textContent).toBe('1 of 4')
  })

  it('draws no note while it waits, then goes on to the next stop instead of holding the tour', async () => {
    renderTour()
    await act(async () => {})
    next()
    await act(async () => {})
    expect(screen.queryByRole('note')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MISSING_MS + 50)
    })

    expect(title()).toBe('Third')
  })

  it('waits one and a half seconds for a target, and no more: not a second less, not ten seconds more', async () => {
    renderTour()
    await act(async () => {})
    next()
    await act(async () => {})

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_400)
    })
    // Still waiting: no note, and the tour has not moved.
    expect(screen.queryByRole('note')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(title()).toBe('Third')
  })

  it('keeps its stop when the target arrives in time', async () => {
    const { container } = renderTour()
    await act(async () => {})
    next()
    await act(async () => {})

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MISSING_MS / 2)
    })
    const late = document.createElement('div')
    late.setAttribute('data-callout-target', 'menu:nothing')
    container.append(late)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(MISSING_MS)
    })

    expect(title()).toBe('Second')
  })

  it('goes on to the panel when no stop is left on the page', async () => {
    renderTour([STOPS[0]!, STOPS[1]!, STOPS[3]!])
    await act(async () => {})
    next()
    await act(async () => {})

    await act(async () => {
      await vi.advanceTimersByTimeAsync(MISSING_MS + 50)
    })

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onEnd).not.toHaveBeenCalled()
  })
})
