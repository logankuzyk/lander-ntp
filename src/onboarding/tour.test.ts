import { describe, expect, it } from 'vitest'

import { planTour } from './tour'

const ids = (stops: readonly { id: string }[]) => stops.map(({ id }) => id)

describe('planTour', () => {
  it('has Edit, move and resize, options, Add and Done on the page, then Photos and the font, for a page with a widget', () => {
    const plan = planTour({ setup: false, widget: 'widget:clock' })

    expect(ids(plan.page)).toEqual([
      'tour-edit',
      'tour-move',
      'tour-options',
      'tour-add',
      'tour-done',
    ])
    expect(ids(plan.settings)).toEqual(['tour-photos', 'tour-general'])
    expect(plan.total).toBe(7)
  })

  it('has a stop of its own for the setup button only when a widget is waiting for setup', () => {
    const plan = planTour({ setup: true, widget: 'widget:weather' })

    expect(ids(plan.page)).toEqual([
      'tour-edit',
      'tour-move',
      'tour-options',
      'tour-setup',
      'tour-add',
      'tour-done',
    ])
    expect(plan.total).toBe(8)
  })

  it('folds the setup button into the Add stop when there is no stop for it, and not otherwise', () => {
    const without = planTour({ setup: false, widget: 'widget:clock' })
    const withStop = planTour({ setup: true, widget: 'widget:clock' })

    const addWithout = without.page.find(({ id }) => id === 'tour-add')
    const addWith = withStop.page.find(({ id }) => id === 'tour-add')
    expect(addWithout?.body).toMatch(/needs something from you/)
    expect(addWith?.body).not.toMatch(/needs something from you/)
    expect(addWith?.body.length).toBeLessThan(addWithout?.body.length ?? 0)
  })

  it('points the move and resize stop at the first widget, whichever type it is', () => {
    const plan = planTour({ setup: false, widget: 'widget:weather' })

    expect(plan.page.find(({ id }) => id === 'tour-move')?.target).toBe('widget:weather')
    expect(plan.page.find(({ id }) => id === 'tour-options')?.target).toBe('options')
  })

  it('leaves out the stops about a widget when the page has none (an empty Grid)', () => {
    const plan = planTour({ setup: false, widget: null })

    expect(ids(plan.page)).toEqual(['tour-edit', 'tour-add', 'tour-done'])
    expect(plan.total).toBe(5)
  })

  it('says what the page is doing while each stop is up', () => {
    const plan = planTour({ setup: true, widget: 'widget:clock' })
    const shown = Object.fromEntries(plan.page.map(({ id, show }) => [id, show]))

    // Edit mode starts on Next from the first stop, and the Add menu is open only on its stop.
    expect(shown['tour-edit']).toEqual({ adding: false, editing: false })
    expect(shown['tour-move']).toEqual({ adding: false, editing: true })
    expect(shown['tour-options']).toEqual({ adding: false, editing: true })
    expect(shown['tour-setup']).toEqual({ adding: false, editing: true })
    expect(shown['tour-add']).toEqual({ adding: true, editing: true })
    expect(shown['tour-done']).toEqual({ adding: false, editing: true })
  })

  it('numbers the stops across the page and the settings panel', () => {
    const plan = planTour({ setup: false, widget: 'widget:clock' })

    expect(plan.page.map(({ number }) => number)).toEqual([1, 2, 3, 4, 5])
    expect(plan.settings).toHaveLength(2)
    expect(plan.page.length + plan.settings.length).toBe(plan.total)
  })
})
