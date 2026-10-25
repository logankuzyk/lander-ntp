import { describe, expect, it } from 'vitest'

import { clockDefinition } from '@/widgets/Clock/definition'
import { weatherDefinition } from '@/widgets/Weather/definition'
import { defaultOptions } from '@/widgetSystem/options'

import { checkLayout, storedLayout } from './check'
import { collides, drawnRects, isOnGrid } from './geometry'
import { addWidget, moveWidget, type Refusal, removeWidget, resizeWidget, setOptions } from './ops'
import type { Layout, PlacedWidget } from './types'

const CLOCK_OPTIONS = { showDate: false, showSeconds: false }

const clock = (id: string, col: number, row: number, extra: Partial<PlacedWidget> = {}) => ({
  col,
  h: 2,
  id,
  options: { ...CLOCK_OPTIONS },
  row,
  type: 'clock',
  w: 4,
  ...extra,
})

const weather = (id: string, col: number, row: number, extra: Partial<PlacedWidget> = {}) => ({
  col,
  h: 2,
  id,
  options: {},
  row,
  type: 'weather',
  w: 2,
  ...extra,
})

const layoutOf = (...widgets: unknown[]): Layout => checkLayout({ v: 1, widgets })

/** What a Layout is stored as, as JSON, so that two can be compared whole. */
const stored = (layout: Layout) =>
  JSON.parse(JSON.stringify(storedLayout(layout))) as Record<string, unknown> & {
    widgets: unknown[]
  }

const editable = (layout: Layout) => ({ layout, readOnly: false })

/** The next Layout of an operation that must succeed. */
function accepted(result: { layout: Layout; ok: true } | { ok: false; reason: Refusal }): Layout {
  if (!result.ok) throw new Error(`refused: ${result.reason}`)
  return result.layout
}

const refusal = (result: { ok: boolean; reason?: Refusal }) =>
  result.ok ? 'accepted' : result.reason

const placedOf = (layout: Layout, id: string): PlacedWidget => {
  const found = layout.widgets.find(
    (widget) => widget.kind !== 'malformed' && widget.placed.id === id,
  )
  if (!found || found.kind === 'malformed') throw new Error(`no Widget ${id}`)
  return found.placed
}

describe('addWidget', () => {
  it('puts a new Clock at the middle of an empty Grid at its starting size, with default options', () => {
    const result = addWidget(editable(layoutOf()), 'clock')

    expect(result.ok).toBe(true)
    const next = accepted(result)
    expect(next.widgets).toHaveLength(1)
    expect(next.widgets[0]).toMatchObject({
      definition: clockDefinition,
      kind: 'known',
      options: CLOCK_OPTIONS,
      placed: { col: 5, h: 2, options: CLOCK_OPTIONS, row: 4, type: 'clock', w: 4 },
    })
  })

  it('says which Widget it added, with an id of eight characters that is not taken', () => {
    const before = layoutOf(clock('k3f9x2ma', 1, 1))
    const result = addWidget(editable(before), 'clock')

    expect(result.ok && result.id).toMatch(/^[a-z0-9]{8}$/)
    const next = accepted(result)
    const ids = next.widgets.map((widget) => widget.kind === 'known' && widget.placed.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    expect(ids).toContain(result.ok && result.id)
  })

  it('stores the new Widget the way LR-15 shapes one, and nothing else', () => {
    const next = accepted(addWidget(editable(layoutOf()), 'weather'))

    expect(stored(next)).toEqual({
      v: 1,
      widgets: [
        {
          col: 6,
          h: 2,
          id: expect.stringMatching(/^[a-z0-9]{8}$/) as unknown,
          options: defaultOptions(weatherDefinition),
          row: 4,
          type: 'weather',
          w: 2,
        },
      ],
    })
  })

  it('does not change the Layout it was given, and keeps everything else in it as it was', () => {
    const malformed = { col: 'x', h: 1, id: 'bad', options: {}, row: 1, type: 'clock', w: 1 }
    const future = { col: 1, h: 1, id: 'fut', options: { z: 1 }, row: 1, type: 'bookmarks', w: 2 }
    const before = checkLayout({
      extra: 'yes',
      v: 1,
      waiting: { weather: defaultOptions(weatherDefinition) },
      widgets: [clock('a', 5, 4), malformed, future],
    })
    const snapshot = JSON.stringify(stored(before))

    const next = accepted(addWidget(editable(before), 'clock'))

    expect(JSON.stringify(stored(before))).toBe(snapshot)
    const after = stored(next) as { extra?: string; waiting?: unknown; widgets: unknown[] }
    expect(after.extra).toBe('yes')
    expect(after.waiting).toEqual({ weather: defaultOptions(weatherDefinition) })
    expect(after.widgets.slice(0, 3)).toEqual(
      (JSON.parse(snapshot) as { widgets: unknown[] }).widgets,
    )
    expect(after.widgets).toHaveLength(4)
  })

  it('allows any number of one type', () => {
    let layout = layoutOf()
    for (let i = 0; i < 3; i++) layout = accepted(addWidget(editable(layout), 'weather'))

    expect(layout.widgets).toHaveLength(3)
    const rects = drawnRects(layout).map(({ rect }) => rect)
    expect(rects).toHaveLength(3)
    for (const rect of rects) expect(isOnGrid(rect)).toBe(true)
    expect(
      collides(rects[0]!, rects[1]!) ||
        collides(rects[1]!, rects[2]!) ||
        collides(rects[0]!, rects[2]!),
    ).toBe(false)
  })

  it('refuses when no place of its smallest size is free, adding nothing', () => {
    const full = layoutOf(clock('all', 1, 1, { h: 8, w: 12 }))
    const result = addWidget(editable(full), 'weather')

    expect(result).toEqual({ ok: false, reason: 'no room' })
  })

  it('shrinks a Clock to fit before refusing it', () => {
    // Rows 1 to 5 taken, and the corners of rows 6 to 8: only columns 5 to 7 are free.
    const crowded = layoutOf(
      clock('top', 1, 1, { h: 5, w: 12 }),
      clock('l', 1, 6, { h: 3, w: 4 }),
      clock('r', 8, 6, { h: 3, w: 5 }),
    )

    const result = addWidget(editable(crowded), 'clock')

    expect(placedOf(accepted(result), result.ok ? result.id : '')).toMatchObject({
      col: 5,
      h: 2,
      row: 6,
      w: 3,
    })
  })

  it('refuses a type this version does not know', () => {
    expect(addWidget(editable(layoutOf()), 'bookmarks')).toEqual({
      ok: false,
      reason: 'unknown type',
    })
  })

  it('refuses while the Layout is read-only, before looking at anything else', () => {
    expect(addWidget({ layout: layoutOf(), readOnly: true }, 'clock')).toEqual({
      ok: false,
      reason: 'read only',
    })
    expect(addWidget({ layout: layoutOf(), readOnly: true }, 'bookmarks')).toEqual({
      ok: false,
      reason: 'read only',
    })
  })

  describe('with options waiting from an update', () => {
    const waitingWeather = {
      ...defaultOptions(weatherDefinition),
      followDevice: true,
      unit: 'fahrenheit',
    }
    const waitingClock = { showDate: true, showSeconds: true }

    it('starts the first Weather from them and removes them in the same step', () => {
      const before = checkLayout({ v: 1, waiting: { weather: waitingWeather }, widgets: [] })

      const next = accepted(addWidget(editable(before), 'weather'))

      expect(next.widgets[0]).toMatchObject({ kind: 'known', placed: { options: waitingWeather } })
      expect(next.waiting).toBeUndefined()
      expect('waiting' in stored(next)).toBe(false)
    })

    it('starts the next Weather from the defaults', () => {
      const before = checkLayout({ v: 1, waiting: { weather: waitingWeather }, widgets: [] })

      const once = accepted(addWidget(editable(before), 'weather'))
      const twice = accepted(addWidget(editable(once), 'weather'))

      expect(twice.widgets[1]).toMatchObject({
        placed: { options: defaultOptions(weatherDefinition) },
      })
    })

    it('uses only the options of the type added, and leaves the other waiting', () => {
      const before = checkLayout({
        v: 1,
        waiting: { clock: waitingClock, weather: waitingWeather },
        widgets: [],
      })

      const next = accepted(addWidget(editable(before), 'clock'))

      expect(next.waiting).toEqual({ weather: waitingWeather })
      // Seconds start a Clock at 6 by 2: the size follows the options it starts from.
      expect(next.widgets[0]).toMatchObject({
        placed: { col: 4, h: 2, options: waitingClock, row: 4, w: 6 },
      })
    })

    it('keeps the options it does not understand, and draws what it does', () => {
      const before = checkLayout({
        v: 1,
        waiting: { clock: { ...waitingClock, tint: 'red' } },
        widgets: [],
      })

      const next = accepted(addWidget(editable(before), 'clock'))

      expect(next.widgets[0]).toMatchObject({
        placed: { options: { ...waitingClock, tint: 'red' } },
      })
    })

    it('keeps them waiting when the add is refused', () => {
      const before = checkLayout({
        v: 1,
        waiting: { weather: waitingWeather },
        widgets: [clock('all', 1, 1, { h: 8, w: 12 })],
      })

      expect(addWidget(editable(before), 'weather')).toEqual({ ok: false, reason: 'no room' })
      expect(before.waiting).toEqual({ weather: waitingWeather })
    })
  })
})

describe('moveWidget', () => {
  const layout = layoutOf(clock('a', 5, 4), weather('b', 11, 1))

  it('moves a Widget to a free place, keeping its size and everything else about it', () => {
    const next = accepted(moveWidget(editable(layout), 'b', { col: 1, row: 7 }))

    expect(placedOf(next, 'b')).toEqual({ ...weather('b', 1, 7) })
    expect(placedOf(next, 'a')).toEqual(clock('a', 5, 4))
    expect(next.widgets.map((widget) => widget.kind === 'known' && widget.placed.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('does not change the Layout it was given', () => {
    const snapshot = JSON.stringify(stored(layout))
    moveWidget(editable(layout), 'b', { col: 1, row: 7 })
    expect(JSON.stringify(stored(layout))).toBe(snapshot)
  })

  it('keeps what a Widget has that this version does not know', () => {
    const odd = layoutOf(clock('a', 5, 4, { note: 'kept' } as Partial<PlacedWidget>))

    const next = accepted(moveWidget(editable(odd), 'a', { col: 1, row: 1 }))

    expect(placedOf(next, 'a')).toEqual({ ...clock('a', 1, 1), note: 'kept' })
  })

  it('allows touching, and a short move onto cells the Widget itself holds', () => {
    expect(accepted(moveWidget(editable(layout), 'b', { col: 9, row: 4 })).widgets).toHaveLength(2)
    expect(placedOf(accepted(moveWidget(editable(layout), 'a', { col: 6, row: 4 })), 'a').col).toBe(
      6,
    )
    expect(placedOf(accepted(moveWidget(editable(layout), 'a', { col: 5, row: 4 })), 'a').col).toBe(
      5,
    )
  })

  it.each([
    ['onto another Widget', { col: 1, row: 1 }, 'overlap'],
    ['over one corner of another', { col: 4, row: 2 }, 'overlap'],
    ['past the right edge', { col: 10, row: 4 }, 'outside'],
    ['past the bottom edge', { col: 5, row: 8 }, 'outside'],
    ['to column 0', { col: 0, row: 4 }, 'outside'],
    ['to row 0', { col: 5, row: 0 }, 'outside'],
    ['between cells', { col: 5.5, row: 4 }, 'outside'],
  ])('refuses a move %s: %s', (_name, to, reason) => {
    const crowd = layoutOf(clock('a', 5, 4), clock('b', 1, 1))

    expect(refusal(moveWidget(editable(crowd), 'a', to))).toBe(reason)
  })

  it('checks the cells the other Widgets are drawn in, not where they are stored', () => {
    // "off" is stored off the Grid and drawn at columns 5 to 8, rows 2 and 3.
    const odd = layoutOf(clock('a', 1, 7), clock('off', 10, 4), clock('mid', 5, 4))
    expect(refusal(moveWidget(editable(odd), 'a', { col: 5, row: 2 }))).toBe('overlap')
    expect(refusal(moveWidget(editable(odd), 'a', { col: 9, row: 4 }))).toBe('accepted')
  })

  it('moves a Widget that was drawn elsewhere, and stores where it was moved to', () => {
    const odd = layoutOf(clock('off', 10, 4), clock('mid', 5, 4))

    const next = accepted(moveWidget(editable(odd), 'off', { col: 1, row: 1 }))

    expect(placedOf(next, 'off')).toMatchObject({ col: 1, row: 1 })
  })

  it('moves a Widget of a type this version does not know', () => {
    const future = { col: 1, h: 1, id: 'fut', options: { z: 1 }, row: 1, type: 'bookmarks', w: 2 }

    const next = accepted(moveWidget(editable(layoutOf(future)), 'fut', { col: 3, row: 3 }))

    expect(next.widgets[0]).toMatchObject({
      kind: 'unknown',
      placed: { ...future, col: 3, row: 3 },
    })
  })

  it('refuses a Widget that is not there, or is not well-formed', () => {
    const odd = layoutOf({ col: 'x', h: 1, id: 'bad', options: {}, row: 1, type: 'clock', w: 1 })
    expect(refusal(moveWidget(editable(layout), 'nope', { col: 1, row: 1 }))).toBe('not found')
    expect(refusal(moveWidget(editable(odd), 'bad', { col: 1, row: 1 }))).toBe('not found')
  })

  it('refuses a Widget that has no place to be drawn', () => {
    const lost = layoutOf(clock('all', 1, 1, { h: 8, w: 12 }), weather('lost', 3, 3))
    expect(refusal(moveWidget(editable(lost), 'lost', { col: 1, row: 1 }))).toBe('no room')
  })

  it('refuses while the Layout is read-only', () => {
    expect(refusal(moveWidget({ layout, readOnly: true }, 'b', { col: 1, row: 7 }))).toBe(
      'read only',
    )
  })
})

describe('resizeWidget', () => {
  const layout = layoutOf(clock('a', 5, 4), weather('b', 11, 1))

  it('changes the size, keeping the place and everything else', () => {
    const next = accepted(resizeWidget(editable(layout), 'a', { h: 3, w: 6 }))

    expect(placedOf(next, 'a')).toEqual(clock('a', 5, 4, { h: 3, w: 6 }))
    expect(placedOf(next, 'b')).toEqual(weather('b', 11, 1))
  })

  it('allows exactly the smallest and the largest, and touching', () => {
    expect(
      placedOf(accepted(resizeWidget(editable(layout), 'a', { h: 2, w: 3 })), 'a'),
    ).toMatchObject({ h: 2, w: 3 })
    expect(
      placedOf(accepted(resizeWidget(editable(layout), 'a', { h: 4, w: 6 })), 'a'),
    ).toMatchObject({ h: 4, w: 6 })
    // Weather at columns 11 and 12 may grow only downwards: 2 to 4 columns would leave the Grid.
    expect(
      placedOf(accepted(resizeWidget(editable(layout), 'b', { h: 3, w: 2 })), 'b'),
    ).toMatchObject({ h: 3, w: 2 })
  })

  it.each([
    ['one column under the smallest', { h: 2, w: 2 }, 'too small'],
    ['one row under the smallest', { h: 1, w: 4 }, 'too small'],
    ['one column over the largest', { h: 2, w: 9 }, 'too large'],
    ['one row over the largest', { h: 5, w: 4 }, 'too large'],
    ['under on one side and over on the other', { h: 9, w: 1 }, 'too small'],
  ])('refuses a Clock %s', (_name, size, reason) => {
    expect(refusal(resizeWidget(editable(layout), 'a', size))).toBe(reason)
  })

  it('refuses a size that runs off the Grid, and one onto a neighbour', () => {
    expect(refusal(resizeWidget(editable(layout), 'b', { h: 2, w: 3 }))).toBe('outside')
    expect(refusal(resizeWidget(editable(layoutOf(clock('a', 5, 7))), 'a', { h: 3, w: 4 }))).toBe(
      'outside',
    )
    const beside = layoutOf(clock('a', 1, 1), clock('b', 5, 1))
    expect(refusal(resizeWidget(editable(beside), 'a', { h: 2, w: 5 }))).toBe('overlap')
    expect(refusal(resizeWidget(editable(beside), 'a', { h: 2, w: 4 }))).toBe('accepted')
  })

  it('refuses a size that is not whole cells', () => {
    expect(refusal(resizeWidget(editable(layout), 'a', { h: 2, w: 4.5 }))).toBe('outside')
  })

  it('resizes from where a Widget is drawn, which is then the place that is stored', () => {
    const odd = layoutOf(clock('off', 10, 4), clock('mid', 5, 4))
    // "off" is drawn at column 5, row 2.
    const next = accepted(resizeWidget(editable(odd), 'off', { h: 2, w: 5 }))

    expect(placedOf(next, 'off')).toMatchObject({ col: 5, h: 2, row: 2, w: 5 })
  })

  it('does not resize a Widget of a type this version does not know', () => {
    const future = { col: 1, h: 1, id: 'fut', options: {}, row: 1, type: 'bookmarks', w: 2 }
    expect(refusal(resizeWidget(editable(layoutOf(future)), 'fut', { h: 2, w: 2 }))).toBe(
      'unknown type',
    )
  })

  it('refuses a Widget that is not there, has no place, or a Layout that is read-only', () => {
    const lost = layoutOf(clock('all', 1, 1, { h: 8, w: 12 }), weather('lost', 3, 3))
    expect(refusal(resizeWidget(editable(layout), 'nope', { h: 2, w: 4 }))).toBe('not found')
    expect(refusal(resizeWidget(editable(lost), 'lost', { h: 2, w: 2 }))).toBe('no room')
    expect(refusal(resizeWidget({ layout, readOnly: true }, 'a', { h: 2, w: 4 }))).toBe('read only')
  })

  it('does not change the Layout it was given', () => {
    const snapshot = JSON.stringify(stored(layout))
    resizeWidget(editable(layout), 'a', { h: 3, w: 6 })
    expect(JSON.stringify(stored(layout))).toBe(snapshot)
  })
})

describe('removeWidget', () => {
  const future = { col: 1, h: 1, id: 'fut', options: { z: 1 }, row: 8, type: 'bookmarks', w: 2 }
  const malformed = { col: 'x', h: 1, id: 'bad', options: {}, row: 1, type: 'clock', w: 1 }
  const layout = checkLayout({
    extra: 1,
    v: 1,
    waiting: { clock: CLOCK_OPTIONS },
    widgets: [clock('a', 5, 4), future, malformed, weather('b', 11, 1)],
  })

  it('takes out one Widget and leaves the rest as they were, in the same order', () => {
    const next = accepted(removeWidget(editable(layout), 'a'))

    expect(stored(next)).toEqual({
      extra: 1,
      v: 1,
      waiting: { clock: CLOCK_OPTIONS },
      widgets: [future, malformed, weather('b', 11, 1)],
    })
  })

  it('removes a Widget of a type this version does not know', () => {
    const next = accepted(removeWidget(editable(layout), 'fut'))
    expect((stored(next) as { widgets: unknown[] }).widgets).toHaveLength(3)
  })

  it('removes a Widget that has no place to be drawn', () => {
    const lost = layoutOf(clock('all', 1, 1, { h: 8, w: 12 }), weather('lost', 3, 3))
    expect(accepted(removeWidget(editable(lost), 'lost')).widgets).toHaveLength(1)
  })

  it('can empty the Layout', () => {
    const next = accepted(removeWidget(editable(layoutOf(clock('a', 5, 4))), 'a'))
    expect(stored(next)).toEqual({ v: 1, widgets: [] })
  })

  it('refuses a Widget that is not there, or is not well-formed, or a read-only Layout', () => {
    expect(refusal(removeWidget(editable(layout), 'nope'))).toBe('not found')
    expect(refusal(removeWidget(editable(layout), 'bad'))).toBe('not found')
    expect(refusal(removeWidget({ layout, readOnly: true }, 'a'))).toBe('read only')
  })

  it('does not change the Layout it was given', () => {
    const snapshot = JSON.stringify(stored(layout))
    removeWidget(editable(layout), 'a')
    expect(JSON.stringify(stored(layout))).toBe(snapshot)
  })
})

describe('setOptions', () => {
  const layout = layoutOf(
    clock('a', 5, 4, { options: { showDate: false, showSeconds: false, tint: 'red' } }),
    weather('b', 11, 1),
  )

  it('changes the options given and keeps every other stored key, known or not', () => {
    const next = accepted(setOptions(editable(layout), 'a', { showSeconds: true }))

    expect(placedOf(next, 'a').options).toEqual({ showDate: false, showSeconds: true, tint: 'red' })
    expect(next.widgets[0]).toMatchObject({
      kind: 'known',
      options: { showDate: false, showSeconds: true, tint: 'red' },
    })
  })

  it('leaves the place, the size and the other Widgets alone', () => {
    const next = accepted(setOptions(editable(layout), 'a', { showDate: true }))

    expect(placedOf(next, 'a')).toMatchObject({ col: 5, h: 2, row: 4, type: 'clock', w: 4 })
    expect(placedOf(next, 'b')).toEqual(weather('b', 11, 1))
  })

  it('draws the checked options, so a patch that fixes what failed its check shows', () => {
    const bad = layoutOf(clock('a', 5, 4, { options: { showDate: 'yes', showSeconds: true } }))
    // Stored options that fail their check are drawn as defaults, and stay as stored...
    expect(bad.widgets[0]).toMatchObject({ options: CLOCK_OPTIONS })

    // ...until this Widget's options are set, with the whole form given.
    const next = accepted(setOptions(editable(bad), 'a', { showDate: true, showSeconds: true }))

    expect(placedOf(next, 'a').options).toEqual({ showDate: true, showSeconds: true })
    expect(next.widgets[0]).toMatchObject({ options: { showDate: true, showSeconds: true } })
  })

  it('does not change the Layout it was given', () => {
    const snapshot = JSON.stringify(stored(layout))
    setOptions(editable(layout), 'a', { showSeconds: true })
    expect(JSON.stringify(stored(layout))).toBe(snapshot)
  })

  it('refuses a Widget of a type this version does not know, one that is not there, or read-only', () => {
    const future = { col: 1, h: 1, id: 'fut', options: { z: 1 }, row: 1, type: 'bookmarks', w: 2 }
    expect(refusal(setOptions(editable(layoutOf(future)), 'fut', { z: 2 }))).toBe('unknown type')
    expect(refusal(setOptions(editable(layout), 'nope', {}))).toBe('not found')
    expect(refusal(setOptions({ layout, readOnly: true }, 'a', { showDate: true }))).toBe(
      'read only',
    )
  })
})
