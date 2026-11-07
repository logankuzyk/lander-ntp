import { afterEach, describe, expect, it } from 'vitest'

import { pageFacts } from './pageFacts'

/** Something on the page with this callout target; the test DOM has no layout, so give it a box. */
function addTarget(name: string, drawn = true) {
  const element = document.createElement('div')
  element.setAttribute('data-callout-target', name)
  element.getBoundingClientRect = () => (drawn ? new DOMRect(10, 10, 50, 30) : new DOMRect())
  document.body.append(element)
  return element
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('pageFacts', () => {
  it('is an empty Grid with nothing waiting when the page has neither', () => {
    expect(pageFacts(true)).toEqual({
      canChange: true,
      menu: 'menu:clock',
      setup: false,
      widget: null,
    })
  })

  it('names the first item the Add menu will have, which is the first Widget the registry lists', () => {
    expect(pageFacts(true).menu).toBe('menu:clock')
  })

  it('names the first Widget in the order of the page, whichever type it is', () => {
    addTarget('widget:weather')
    addTarget('widget:clock')

    expect(pageFacts(true).widget).toBe('widget:weather')
  })

  it('does not count a Widget that is not drawn', () => {
    addTarget('widget:clock', false)
    addTarget('widget:weather')

    expect(pageFacts(true).widget).toBe('widget:weather')
  })

  it('does not take the Options button or the Edit button for a Widget', () => {
    addTarget('edit')
    addTarget('options')

    expect(pageFacts(true).widget).toBeNull()
  })

  it('knows a Widget is waiting for setup by its setup button', () => {
    addTarget('widget:weather')
    addTarget('setup')

    expect(pageFacts(true)).toEqual({
      canChange: true,
      menu: 'menu:clock',
      setup: true,
      widget: 'widget:weather',
    })
  })

  it('says whether the Layout can be changed, as it is told', () => {
    expect(pageFacts(true).canChange).toBe(true)
    expect(pageFacts(false).canChange).toBe(false)
  })
})
