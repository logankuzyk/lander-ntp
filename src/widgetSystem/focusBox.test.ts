import { describe, expect, it } from 'vitest'

import { focusBox } from './focusBox'

const makeBox = () => {
  const box = document.createElement('div')
  document.body.append(box)
  return box
}

describe('focusBox', () => {
  it('lets a box that is not a tab stop take focus, and returns the box', () => {
    const box = makeBox()

    expect(focusBox(box)).toBe(box)
    box.focus()

    expect(box.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(box)
  })

  it('takes that away when focus moves on', () => {
    const box = makeBox()
    focusBox(box).focus()

    box.blur()

    expect(box.hasAttribute('tabindex')).toBe(false)
  })

  it('leaves a box that is already a tab stop as it is', () => {
    const box = makeBox()
    box.tabIndex = 0

    focusBox(box).focus()
    box.blur()

    expect(box.getAttribute('tabindex')).toBe('0')
  })

  it('keeps the tab stop edit mode gives the box while it holds focus, when focus then moves on', () => {
    const box = makeBox()
    focusBox(box).focus()
    // Edit mode starts (E is pressed) with focus still on the box: it becomes a tab stop.
    box.tabIndex = 0

    box.blur()

    expect(box.getAttribute('tabindex')).toBe('0')
  })
})
