import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'
import type { Layout } from '@/layout/types'
import { placeBeside } from '@/onboarding/placeBeside'
import type { CalloutTarget } from '@/onboarding/target'

import { Callout } from './Callout'

// The real function, counted: the placement is worked out once for each thing that moves a
// callout, never once a frame.
vi.mock('@/onboarding/placeBeside', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/onboarding/placeBeside')>()
  return { ...original, placeBeside: vi.fn(original.placeBeside) }
})

type Edges = [left: number, top: number, right: number, bottom: number]

const drawAt = (element: HTMLElement, [left, top, right, bottom]: Edges) => {
  element.getBoundingClientRect = () => new DOMRect(left, top, right - left, bottom - top)
}

/** Something on the page for a callout to point at (the test DOM has no layout of its own). */
function addTarget(name: string, edges: Edges, parent: ParentNode = document.body) {
  const element = document.createElement('button')
  element.setAttribute('data-callout-target', name)
  drawAt(element, edges)
  parent.append(element)
  return element
}

/** An open menu or popover, at these edges. */
function addOpen(className: string, edges: Edges, role?: string) {
  const element = document.createElement('div')
  element.className = className
  if (role) element.setAttribute('role', role)
  drawAt(element, edges)
  document.body.append(element)
  return element
}

/** Gives the callout the size a browser would measure for it. */
const sizeOf = (width: number, height: number) => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height)
}

/** The ResizeObservers the page made, so a test can say that something was resized. */
class FakeResizeObserver {
  static all: FakeResizeObserver[] = []
  observed = new Set<Element>()
  constructor(private callback: ResizeObserverCallback) {
    FakeResizeObserver.all.push(this)
  }
  /** What a browser does when `element` changes size, and once when it starts to be watched. */
  static fire(element: Element) {
    for (const observer of FakeResizeObserver.all) {
      if (observer.observed.has(element)) {
        observer.callback([{ target: element } as ResizeObserverEntry], observer as never)
      }
    }
  }
  disconnect() {
    this.observed.clear()
  }
  observe(element: Element) {
    this.observed.add(element)
  }
  unobserve(element: Element) {
    this.observed.delete(element)
  }
}

// Two Layouts: all the callout asks is whether it is the same one as before.
const LAYOUT_A: Layout = { extra: {}, widgets: [] }
const LAYOUT_B: Layout = { extra: {}, widgets: [] }

const props = {
  action: { label: 'Next', onClick: vi.fn() },
  body: 'Press this to change the page.',
  onDismiss: vi.fn(),
  title: 'Edit',
}

const draw = (target: CalloutTarget, extra: { layout?: Layout } = {}) =>
  render(<Callout {...props} layout={extra.layout} target={target} />)

const note = () => screen.queryByRole('note')
const placed = () => {
  const element = note()
  if (!element) throw new Error('no callout')
  return element
}
const counted = vi.mocked(placeBeside)

beforeEach(() => {
  FakeResizeObserver.all = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('innerWidth', 1440)
  vi.stubGlobal('innerHeight', 900)
  sizeOf(256, 140)
  counted.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('a callout beside its target', () => {
  it('is placed beside the Widget it is about, with its pointer at it', () => {
    addTarget('widget:clock', [600, 200, 800, 400])

    draw('widget:clock')

    const { dataset, style } = placed()
    expect([
      style.left,
      style.top,
      dataset.side,
      style.getPropertyValue('--callout-pointer'),
    ]).toEqual(['812px', '230px', 'right', '70px'])
    expect(placed().classList.contains('callout--beside')).toBe(true)
  })

  it('goes above the Edit button in the Bottom bar, as there is no room below it', () => {
    addTarget('edit', [1100, 834, 1140, 874])

    draw('edit')

    expect(placed().dataset.side).toBe('above')
    expect(placed().style.top).toBe(`${834 - 12 - 140}px`)
  })

  it('keeps the words, the Dismiss and the button it always has', () => {
    addTarget('edit', [1100, 834, 1140, 874])

    draw('edit')

    expect(placed().textContent).toContain('Press this to change the page.')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  })

  describe('when its target is not there', () => {
    it('draws nothing, so there is nothing to read or to tab to', () => {
      addTarget('add', [10, 10, 60, 40])

      draw('edit')

      expect(note()).toBeNull()
      expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
      expect(counted).not.toHaveBeenCalled()
    })

    it('draws nothing while its target is hidden', () => {
      addTarget('edit', [0, 0, 0, 0])

      draw('edit')

      expect(note()).toBeNull()
    })

    it('appears when its target does', async () => {
      draw('widget:clock')
      expect(note()).toBeNull()

      addTarget('widget:clock', [600, 200, 800, 400])

      await waitFor(() => expect(note()).not.toBeNull())
      expect(placed().dataset.side).toBe('right')
    })

    it('goes when its target does, and comes back with it', async () => {
      const target = addTarget('options', [100, 100, 130, 130])
      draw('options')
      expect(note()).not.toBeNull()

      target.remove()
      await waitFor(() => expect(note()).toBeNull())

      addTarget('options', [100, 100, 130, 130])
      await waitFor(() => expect(note()).not.toBeNull())
    })
  })

  describe('is placed again, once, when', () => {
    it('it shows', () => {
      addTarget('widget:clock', [600, 200, 800, 400])

      draw('widget:clock')

      expect(counted).toHaveBeenCalledTimes(1)
    })

    it('the Layout changes, and the target has moved', () => {
      const target = addTarget('widget:clock', [600, 200, 800, 400])
      const { rerender } = draw('widget:clock', { layout: LAYOUT_A })
      counted.mockClear()

      drawAt(target, [100, 200, 300, 400])
      rerender(<Callout {...props} layout={LAYOUT_B} target="widget:clock" />)

      expect(counted).toHaveBeenCalledTimes(1)
      expect(placed().style.left).toBe('312px')
    })

    it('the page draws again with the same Layout, it is not', () => {
      addTarget('widget:clock', [600, 200, 800, 400])
      const { rerender } = draw('widget:clock', { layout: LAYOUT_A })
      counted.mockClear()

      rerender(<Callout {...props} layout={LAYOUT_A} target="widget:clock" />)

      expect(counted).not.toHaveBeenCalled()
    })

    it('the window changes size', () => {
      addTarget('widget:clock', [600, 200, 800, 400])
      draw('widget:clock')
      counted.mockClear()

      vi.stubGlobal('innerWidth', 1000)
      fireEvent(window, new Event('resize'))

      expect(counted).toHaveBeenCalledTimes(1)
    })

    it('the target changes size', () => {
      const target = addTarget('edit', [1100, 834, 1140, 874])
      draw('edit')
      counted.mockClear()

      drawAt(target, [1100, 834, 1180, 874])
      act(() => FakeResizeObserver.fire(target))

      expect(counted).toHaveBeenCalledTimes(1)
    })

    it('something is added beside the target that moves it along, such as a button in its bar', async () => {
      const target = addTarget('edit', [1100, 834, 1140, 874])
      draw('edit')
      counted.mockClear()

      drawAt(target, [1052, 834, 1092, 874])
      document.body.append(document.createElement('button'))

      await waitFor(() => expect(counted).toHaveBeenCalledTimes(1))
      // Centred on the target again: its middle is 1072, and the callout 256 wide.
      expect(placed().style.left).toBe('944px')
    })

    it('the callout itself changes size, such as its words wrapping in a narrower window', () => {
      addTarget('widget:clock', [600, 200, 800, 400])
      draw('widget:clock')
      counted.mockClear()

      sizeOf(256, 200)
      act(() => FakeResizeObserver.fire(placed()))

      expect(counted).toHaveBeenCalledTimes(1)
      // Still level with the middle of the Widget: 300 less half of 200.
      expect(placed().style.top).toBe('200px')
    })

    it('edit mode begins or ends', () => {
      const target = addTarget('edit', [1100, 834, 1140, 874])
      const Switch = () => {
        const { editing, enter, leave } = useEditMode()
        return (
          <button onClick={editing ? leave : enter} type="button">
            switch
          </button>
        )
      }
      render(
        <EditModeProvider>
          <Switch />
          <Callout {...props} target="edit" />
        </EditModeProvider>,
      )
      counted.mockClear()

      // Done is wider than Edit, and the target is the same one throughout.
      drawAt(target, [1060, 834, 1140, 874])
      fireEvent.click(screen.getByRole('button', { name: 'switch' }))

      expect(counted).toHaveBeenCalledTimes(1)
    })
  })

  describe('is not placed again', () => {
    it('for the first word from the observer, which only says the size it already has', () => {
      const target = addTarget('edit', [1100, 834, 1140, 874])
      draw('edit')
      counted.mockClear()

      act(() => FakeResizeObserver.fire(target))
      act(() => FakeResizeObserver.fire(placed()))

      expect(counted).not.toHaveBeenCalled()
    })

    it('as time goes by: no timer, no frame', async () => {
      vi.useFakeTimers()
      const frames = vi.spyOn(window, 'requestAnimationFrame')
      addTarget('edit', [1100, 834, 1140, 874])
      draw('edit')
      counted.mockClear()

      await vi.advanceTimersByTimeAsync(5_000)
      vi.useRealTimers()

      expect(counted).not.toHaveBeenCalled()
      expect(frames).not.toHaveBeenCalled()
    })

    it('when something is added to the page and the target stays where it was', async () => {
      addTarget('edit', [1100, 834, 1140, 874])
      draw('edit')
      counted.mockClear()

      document.body.append(document.createElement('button'))
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(counted).not.toHaveBeenCalled()
    })

    it('for a change of text in the page, such as the Clock’s minute', async () => {
      addTarget('edit', [1100, 834, 1140, 874])
      const clock = document.createElement('time')
      clock.textContent = '10:41'
      document.body.append(clock)
      draw('edit')
      counted.mockClear()

      clock.textContent = '10:42'
      await new Promise((resolve) => setTimeout(resolve, 20))

      expect(counted).not.toHaveBeenCalled()
    })
  })

  describe('keeps clear of what is open', () => {
    it('a popover where it would go', () => {
      addTarget('widget:clock', [300, 200, 500, 400])
      addOpen('popover options-popover', [512, 0, 900, 900])

      draw('widget:clock')

      expect(placed().dataset.side).toBe('left')
    })

    it('a menu, or a list of choices, as well', () => {
      addTarget('widget:clock', [300, 200, 500, 400])
      addOpen('dropdown__menu', [512, 0, 900, 900], 'listbox')
      draw('widget:clock')
      expect(placed().dataset.side).toBe('left')
    })

    it('one that opens after it is placed, and again when that one closes', async () => {
      addTarget('widget:clock', [300, 200, 500, 400])
      draw('widget:clock')
      expect(placed().dataset.side).toBe('right')

      const popover = addOpen('popover options-popover', [512, 0, 900, 900])
      await waitFor(() => expect(placed().dataset.side).toBe('left'))

      popover.remove()
      await waitFor(() => expect(placed().dataset.side).toBe('right'))
    })

    it('one that changes size under it', () => {
      addTarget('widget:clock', [300, 200, 500, 400])
      const popover = addOpen('popover options-popover', [512, 0, 600, 100])
      draw('widget:clock')
      expect(placed().dataset.side).toBe('right')

      drawAt(popover, [512, 0, 900, 900])
      act(() => FakeResizeObserver.fire(popover))

      expect(placed().dataset.side).toBe('left')
    })

    it('goes beside a menu, not over it, when its target is an item in the menu', () => {
      const menu = addOpen('menu', [900, 500, 1100, 700], 'menu')
      addTarget('menu:clock', [910, 520, 1090, 550], menu)

      draw('menu:clock')

      const { dataset, style } = placed()
      // Level with the item, against the menu's left edge and not the item's.
      expect([dataset.side, style.left, style.top]).toEqual([
        'left',
        `${900 - 12 - 256}px`,
        '465px',
      ])
    })
  })

  describe('for a person at the keyboard or with a screen reader', () => {
    it('is a note, so it is read where it is and not announced as it arrives', () => {
      addTarget('edit', [1100, 834, 1140, 874])

      draw('edit')

      expect(placed().getAttribute('role')).toBe('note')
      expect(placed().getAttribute('aria-live')).toBeNull()
      expect(placed().getAttribute('aria-modal')).toBeNull()
    })

    it('takes no focus, when it comes or when it moves', () => {
      const target = addTarget('edit', [1100, 834, 1140, 874])
      const elsewhere = document.createElement('input')
      document.body.append(elsewhere)
      elsewhere.focus()

      const { rerender } = draw('edit', { layout: LAYOUT_A })
      drawAt(target, [1000, 834, 1040, 874])
      rerender(<Callout {...props} layout={LAYOUT_B} target="edit" />)

      expect(document.activeElement).toBe(elsewhere)
    })

    it('has only its two buttons to tab to, and draws its pointer with the styles', () => {
      addTarget('edit', [1100, 834, 1140, 874])

      draw('edit')

      expect(
        within(placed())
          .getAllByRole('button')
          .map((button) => button.getAttribute('aria-label') ?? button.textContent),
      ).toEqual(['Dismiss', 'Next'])
      expect(placed().querySelector('[tabindex]')).toBeNull()
    })

    it('draws no ring around its target', () => {
      const target = addTarget('edit', [1100, 834, 1140, 874])

      draw('edit')

      expect(document.querySelector('.callout-ring')).toBeNull()
      expect(target.className).toBe('')
      expect(target.getAttribute('style')).toBeNull()
    })
  })
})

describe('a callout with no target', () => {
  it('is drawn as it always was: not placed, and not hidden', () => {
    render(<Callout {...props} class="callout--tour" />)

    expect(placed().classList.contains('callout--beside')).toBe(false)
    expect(placed().style.left).toBe('')
    expect(counted).not.toHaveBeenCalled()
  })
})
