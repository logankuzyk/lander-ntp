import { fireEvent, render, screen } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { clockDefinition } from '@/widgets/Clock/definition'

import { OptionsPopover } from './OptionsPopover'

const OPTIONS = { showDate: false, showSeconds: false }

/** A Widget's box, in the page, at these edges (the test DOM has no layout of its own). */
function widgetBox(edges: { bottom: number; left: number; right: number; top: number }) {
  const box = document.createElement('div')
  box.tabIndex = 0
  document.body.append(box)
  box.getBoundingClientRect = () =>
    new DOMRect(edges.left, edges.top, edges.right - edges.left, edges.bottom - edges.top)
  return box
}

const draw = (
  box: HTMLElement | null,
  props: Partial<Parameters<typeof OptionsPopover>[0]> = {},
) => {
  const onClose = vi.fn()
  const view = render(
    <OptionsPopover
      box={() => box}
      definition={clockDefinition}
      name="Clock"
      onChange={vi.fn()}
      onClose={onClose}
      onPageValueChange={vi.fn()}
      options={OPTIONS}
      page={{ hour12: false }}
      {...props}
    />,
  )
  return { ...view, onClose }
}

/** Gives the popover a size, as a browser would measure it. */
const sizeOf = (width: number, height: number) => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height)
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
  vi.stubGlobal('innerWidth', 1024)
  vi.stubGlobal('innerHeight', 768)
})

describe('OptionsPopover', () => {
  it('is a dialog named for the Widget that is not modal, with the form in it', () => {
    draw(widgetBox({ bottom: 300, left: 100, right: 300, top: 200 }))

    const dialog = screen.getByRole('dialog', { name: 'Clock options' })
    expect(dialog.getAttribute('aria-modal')).toBeNull()
    expect(dialog.classList.contains('popover')).toBe(true)
    expect(screen.getByRole('switch', { name: 'Show date' })).toBeTruthy()
  })

  it('sits to the right of the Widget, level with its top, as placeBeside says', () => {
    sizeOf(320, 240)
    draw(widgetBox({ bottom: 300, left: 100, right: 300, top: 200 }))

    const { dataset, style } = screen.getByRole('dialog')
    expect([style.left, style.top, style.maxHeight, dataset.side]).toEqual([
      '312px',
      '200px',
      '240px',
      'right',
    ])
  })

  it('takes only the room a short window has, to be scrolled inside', () => {
    vi.stubGlobal('innerHeight', 300)
    sizeOf(320, 500)
    draw(widgetBox({ bottom: 200, left: 100, right: 300, top: 100 }))

    const { style } = screen.getByRole('dialog')
    expect([style.top, style.maxHeight]).toEqual(['8px', '284px'])
  })

  it('is placed again when the window changes size', () => {
    sizeOf(320, 240)
    draw(widgetBox({ bottom: 300, left: 500, right: 600, top: 200 }))
    expect(screen.getByRole('dialog').dataset.side).toBe('right')

    vi.stubGlobal('innerWidth', 700)
    fireEvent(window, new Event('resize'))

    expect(screen.getByRole('dialog').dataset.side).toBe('left')
  })

  it('puts focus on the first option', () => {
    draw(widgetBox({ bottom: 300, left: 100, right: 300, top: 200 }))

    expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Show date' }))
  })

  it('puts focus on the option asked for', () => {
    draw(widgetBox({ bottom: 300, left: 100, right: 300, top: 200 }), {
      focusOption: 'showSeconds',
    })

    expect(document.activeElement).toBe(screen.getByRole('switch', { name: 'Show seconds' }))
  })

  it('puts focus on the ×, with every option off', () => {
    draw(widgetBox({ bottom: 300, left: 100, right: 300, top: 200 }), { disabled: true })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close Clock options' }))
  })

  it('gives focus back to the Widget’s box when it goes', () => {
    const box = widgetBox({ bottom: 300, left: 100, right: 300, top: 200 })
    const { unmount } = draw(box)

    unmount()

    expect(document.activeElement).toBe(box)
  })

  it('leaves focus alone if it has moved on by then', () => {
    const box = widgetBox({ bottom: 300, left: 100, right: 300, top: 200 })
    const elsewhere = document.createElement('button')
    document.body.append(elsewhere)
    const { unmount } = draw(box)

    elsewhere.focus()
    unmount()

    expect(document.activeElement).toBe(elsewhere)
  })

  it('closes with Escape, and says it was heard so that edit mode stays', () => {
    const { onClose } = draw(widgetBox({ bottom: 300, left: 100, right: 300, top: 200 }))
    const escape = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })

    document.body.dispatchEvent(escape)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(escape.defaultPrevented).toBe(true)
  })

  it('does not close for Escape that a menu inside it already used', () => {
    const { onClose } = draw(widgetBox({ bottom: 300, left: 100, right: 300, top: 200 }))
    const escape = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })
    escape.preventDefault()

    document.body.dispatchEvent(escape)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('draws nothing out of place when the Widget’s box is not on the page', () => {
    draw(null)

    expect(screen.getByRole('dialog').style.left).toBe('')
  })
})
