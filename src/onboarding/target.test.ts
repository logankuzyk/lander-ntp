import { afterEach, describe, expect, it } from 'vitest'

import { findTarget, nextShown, type PageStop } from './target'

/** Something on the page with this callout target, drawn at these edges (the test DOM has no layout). */
function addTarget(
  name: string,
  edges: [left: number, top: number, right: number, bottom: number] = [10, 10, 60, 40],
  parent: ParentNode = document.body,
) {
  const element = document.createElement('button')
  element.setAttribute('data-callout-target', name)
  const [left, top, right, bottom] = edges
  element.getBoundingClientRect = () => new DOMRect(left, top, right - left, bottom - top)
  parent.append(element)
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('findTarget', () => {
  it('finds what carries the attribute', () => {
    const edit = addTarget('edit')
    addTarget('add')

    expect(findTarget('edit')).toBe(edit)
  })

  it('is null when nothing on the page has it', () => {
    addTarget('add')

    expect(findTarget('edit')).toBeNull()
  })

  it('takes the whole value, so one Widget’s type is not another’s', () => {
    addTarget('widget:clocks')
    const clock = addTarget('widget:clock')

    expect(findTarget('widget:clock')).toBe(clock)
  })

  it('takes the first of several, in the order of the page', () => {
    const first = addTarget('widget:weather')
    addTarget('widget:weather')

    expect(findTarget('widget:weather')).toBe(first)
  })

  it('does not take what is not drawn: no size, such as inside something hidden', () => {
    addTarget('options', [0, 0, 0, 0])
    const drawn = addTarget('options')

    expect(findTarget('options')).toBe(drawn)
  })

  it('is null when every one there is hidden', () => {
    addTarget('edit', [0, 0, 0, 0])

    expect(findTarget('edit')).toBeNull()
  })

  it('does not take what is invisible but still takes room', () => {
    const element = addTarget('edit')
    element.style.visibility = 'hidden'

    expect(findTarget('edit')).toBeNull()
  })

  it('finds a value with a quote or a backslash in it, which would end the selector’s quote', () => {
    const quoted = addTarget('widget:a"b')
    const slashed = addTarget('widget:a\\b')
    addTarget('widget:ab')

    expect(findTarget('widget:a"b')).toBe(quoted)
    expect(findTarget('widget:a\\b')).toBe(slashed)
  })

  it('looks only inside the root it is given', () => {
    const inside = document.createElement('div')
    document.body.append(inside)
    addTarget('edit')
    const mine = addTarget('edit', [10, 10, 60, 40], inside)

    expect(findTarget('edit', inside)).toBe(mine)
  })
})

describe('nextShown', () => {
  const stops: PageStop[] = [
    { target: 'edit' },
    { target: 'widget:clock' },
    { target: 'options' },
    { target: 'add' },
  ]

  it('is the stop asked for when its target is there', () => {
    addTarget('edit')
    addTarget('widget:clock')

    expect(nextShown(stops, 0)).toBe(0)
    expect(nextShown(stops, 1)).toBe(1)
  })

  it('skips a stop whose target is missing, to the next with one', () => {
    addTarget('edit')
    addTarget('add')

    expect(nextShown(stops, 1)).toBe(3)
  })

  it('is null when no stop from there has its target', () => {
    addTarget('edit')

    expect(nextShown(stops, 1)).toBeNull()
  })

  it('is null past the end', () => {
    addTarget('edit')

    expect(nextShown(stops, 4)).toBeNull()
  })

  it('always shows a stop that points at nothing on the page', () => {
    expect(nextShown([{}, { target: 'edit' }], 0)).toBe(0)
  })
})
