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

  describe('when its target is hidden after it was shown', () => {
    // A resize is the first thing that makes it look again; nothing was added to the page.
    it('goes when the target is not drawn any more, such as display: none on it or on what it is in', () => {
      const target = addTarget('widget:clock', [600, 200, 800, 400])
      draw('widget:clock')
      expect(note()).not.toBeNull()

      drawAt(target, [0, 0, 0, 0])
      act(() => {
        fireEvent(window, new Event('resize'))
      })

      expect(note()).toBeNull()
    })

    it('goes when the target is made invisible but still takes room', () => {
      const target = addTarget('widget:clock', [600, 200, 800, 400])
      draw('widget:clock')

      target.style.visibility = 'hidden'
      act(() => {
        fireEvent(window, new Event('resize'))
      })

      expect(note()).toBeNull()
    })

    it('comes back when it is drawn again', () => {
      const target = addTarget('widget:clock', [600, 200, 800, 400])
      draw('widget:clock')
      drawAt(target, [0, 0, 0, 0])
      act(() => {
        fireEvent(window, new Event('resize'))
      })

      drawAt(target, [600, 200, 800, 400])
      act(() => {
        fireEvent(window, new Event('resize'))
      })

      // Nothing is listening for it while it is not drawn but the page's own changes.
      document.body.append(document.createElement('span'))
      return waitFor(() => expect(note()).not.toBeNull())
    })
  })

  describe('when the component goes', () => {
    it('stops listening: the window, the page’s elements and the sizes it watched', () => {
      const added: [string, unknown][] = []
      const removed: [string, unknown][] = []
      const add = window.addEventListener.bind(window)
      const remove = window.removeEventListener.bind(window)
      vi.spyOn(window, 'addEventListener').mockImplementation(((type: string, handler: never) => {
        added.push([type, handler])
        add(type, handler)
      }) as never)
      vi.spyOn(window, 'removeEventListener').mockImplementation(((
        type: string,
        handler: never,
      ) => {
        removed.push([type, handler])
        remove(type, handler)
      }) as never)
      const disconnected: boolean[] = []
      const RealMutationObserver = MutationObserver
      vi.stubGlobal(
        'MutationObserver',
        class extends RealMutationObserver {
          mine: number
          constructor(callback: MutationCallback) {
            super(callback)
            disconnected.push(false)
            this.mine = disconnected.length - 1
          }
          override disconnect() {
            disconnected[this.mine] = true
            super.disconnect()
          }
        },
      )
      addTarget('widget:clock', [600, 200, 800, 400])
      const { unmount } = draw('widget:clock')
      expect(disconnected.length).toBeGreaterThan(0)

      unmount()

      // Each resize listener it added, it took away; every observer is let go.
      const resizes = added.filter(([type]) => type === 'resize')
      expect(resizes.length).toBeGreaterThan(0)
      for (const listener of resizes) expect(removed).toContainEqual(listener)
      expect(disconnected.every(Boolean)).toBe(true)
      expect(FakeResizeObserver.all.every((observer) => observer.observed.size === 0)).toBe(true)
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

    it('with a little room between: not touching it', () => {
      addTarget('widget:clock', [300, 200, 500, 400])
      // The callout would go to 512..768; this starts 4 pixels after it.
      addOpen('popover options-popover', [772, 0, 1100, 900])

      draw('widget:clock')

      expect(placed().dataset.side).toBe('left')
    })

    it('the note that a change could not be saved, which comes and goes above the Bottom bar', async () => {
      addTarget('edit', [100, 834, 140, 874])
      draw('edit')
      expect(placed().dataset.side).toBe('above')

      // 16 to 288 wide, over where the callout is, 64 up from the foot of the window.
      const notice = addOpen('notice', [24, 760, 280, 836])
      await waitFor(() => expect(placed().dataset.side).not.toBe('above'))

      notice.remove()
      await waitFor(() => expect(placed().dataset.side).toBe('above'))
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

  describe('keeping clear of the photo credit and the Bottom bar', () => {
    /** The credit, wrapped to three lines at the foot of a narrow window, and the Bottom bar. */
    function addFoot() {
      const credit = addOpen('credit', [24, 715, 138, 732])
      const controls = addOpen('controls', [150, 744, 390, 784])
      return { controls, credit }
    }

    it('lifts a note above the Edit button clear of the credit instead of covering it', () => {
      vi.stubGlobal('innerWidth', 390)
      vi.stubGlobal('innerHeight', 800)
      const { controls } = addFoot()
      addTarget('edit', [200, 744, 240, 784], controls)

      draw('edit')

      const { dataset, style } = placed()
      expect([dataset.side, style.left, style.top]).toEqual(['above', '92px', `${715 - 8 - 140}px`])
    })

    it('is where it was without a credit, when there is none on the page', () => {
      vi.stubGlobal('innerWidth', 390)
      vi.stubGlobal('innerHeight', 800)
      const controls = addOpen('controls', [150, 744, 390, 784])
      addTarget('edit', [200, 744, 240, 784], controls)

      draw('edit')

      expect(placed().style.top).toBe(`${744 - 12 - 140}px`)
    })

    it('keeps a note for something else clear of the Bottom bar, not only the credit', () => {
      vi.stubGlobal('innerWidth', 390)
      vi.stubGlobal('innerHeight', 800)
      addOpen('controls', [150, 744, 390, 784])
      // A widget near the foot of the window, with its note going below it, over the Bottom bar.
      addTarget('widget:clock', [100, 560, 160, 700])

      draw('widget:clock')

      const box = placed().style
      const top = Number.parseFloat(box.top)
      expect(top + 140 <= 744 - 8 || top >= 784 + 8).toBe(true)
    })

    it('does not treat the Bottom bar as in the way of a note for one of its own buttons', () => {
      vi.stubGlobal('innerWidth', 1440)
      vi.stubGlobal('innerHeight', 900)
      const controls = addOpen('controls', [1100, 844, 1440, 884])
      addTarget('edit', [1100, 844, 1140, 884], controls)

      draw('edit')

      expect(placed().style.top).toBe(`${844 - 12 - 140}px`)
    })
  })

  describe('beside a setup button, which is inside its widget', () => {
    it('goes beside the widget’s frame, not over the frame with the button', () => {
      const frame = addOpen('widget-box', [200, 100, 400, 300])
      addTarget('setup', [260, 180, 340, 220], frame)

      draw('setup')

      const { dataset, style } = placed()
      expect([dataset.side, style.left, style.top]).toEqual(['right', `${400 + 12}px`, '130px'])
    })
  })

  describe('beside the Add menu (the tour opens it by itself)', () => {
    /** The menu as the page draws it: a card with a title, and the list of items under that. */
    function addAddMenu(card: Edges, items: Edges) {
      const element = addOpen('add-menu', card)
      const list = document.createElement('div')
      list.setAttribute('role', 'menu')
      drawAt(list, items)
      element.append(list)
      return list
    }

    it('goes above the whole card, its title included, when there is no room beside it', () => {
      vi.stubGlobal('innerWidth', 390)
      vi.stubGlobal('innerHeight', 800)
      // The card is 100 to 290 wide and its title is the top 40 pixels, over the list.
      const list = addAddMenu([100, 640, 290, 760], [100, 680, 290, 760])
      addTarget('menu:clock', [110, 700, 280, 730], list)

      draw('menu:clock')

      const { dataset, style } = placed()
      expect([dataset.side, style.top]).toEqual(['above', `${640 - 12 - 140}px`])
    })

    it('goes beside the card, level with the item, when there is room', () => {
      const list = addAddMenu([1000, 640, 1200, 760], [1000, 680, 1200, 760])
      addTarget('menu:clock', [1010, 700, 1190, 730], list)

      draw('menu:clock')

      const { dataset, style } = placed()
      expect([dataset.side, style.left, style.top]).toEqual([
        'left',
        `${1000 - 12 - 256}px`,
        `${715 - 70}px`,
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
