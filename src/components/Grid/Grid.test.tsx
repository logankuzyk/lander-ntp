import { render, screen } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { checkLayout } from '@/layout/check'
import { deriveLayout } from '@/layout/derive'
import type { Layout } from '@/layout/types'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'

import { Grid } from './Grid'

const PAGE = { hour12: false }

const PLACE = { latitude: 48.43, longitude: -123.37, name: 'Victoria' }

const settingsWith = (changes: {
  clock?: Partial<Settings['clock']>
  weather?: Partial<Settings['weather']>
}): Settings => ({
  ...DEFAULT_SETTINGS,
  clock: { ...DEFAULT_SETTINGS.clock, ...changes.clock },
  weather: { ...DEFAULT_SETTINGS.weather, ...changes.weather },
})

/** A Widget as `sync:layout` stores it. */
const stored = (
  id: string,
  type: string,
  place: [col: number, row: number, w: number, h: number],
  options: Record<string, unknown> = {},
) => ({ col: place[0], h: place[3], id, options, row: place[1], type, w: place[2] })

const layoutOf = (...widgets: unknown[]): Layout => checkLayout({ v: 1, widgets })

const drawnGrid = (layout: Layout) => {
  const { container } = render(<Grid layout={layout} page={PAGE} />)
  const grid = container.querySelector('.grid')
  if (!grid) throw new Error('no Grid was drawn')
  return grid
}

/** Each box as [type, column, row]: where CSS grid is told to put it, in document order. */
const boxes = (grid: Element) =>
  [...grid.querySelectorAll<HTMLElement>('.widget-box')].map((box) => [
    box.dataset.widget,
    box.style.gridColumn,
    box.style.gridRow,
  ])

describe('Grid', () => {
  it('draws the Clock of a new install in the middle: column 5, row 4, 4 by 2', () => {
    const grid = drawnGrid(deriveLayout(DEFAULT_SETTINGS))
    expect(boxes(grid)).toEqual([['clock', '5 / span 4', '4 / span 2']])
  })

  it('draws the Clock with seconds 6 by 2 from column 4', () => {
    const grid = drawnGrid(deriveLayout(settingsWith({ clock: { showSeconds: true } })))
    expect(boxes(grid)).toEqual([['clock', '4 / span 6', '4 / span 2']])
  })

  it("draws an updated user's Weather in the top right corner, at the Weather's own size", () => {
    const grid = drawnGrid(
      deriveLayout(settingsWith({ weather: { enabled: true, place: PLACE, unit: 'celsius' } })),
    )
    expect(boxes(grid)).toEqual([
      // Reading order: the Weather's row is above the Clock's.
      ['weather', '11 / span 2', '1 / span 2'],
      ['clock', '5 / span 4', '4 / span 2'],
    ])
  })

  it('draws the Weather alone when the Clock is off, and nothing when both are', () => {
    const weatherOnly = settingsWith({ clock: { enabled: false }, weather: { enabled: true } })
    expect(boxes(drawnGrid(deriveLayout(weatherOnly)))).toEqual([
      ['weather', '11 / span 2', '1 / span 2'],
    ])
    const neither = settingsWith({ clock: { enabled: false } })
    const empty = drawnGrid(deriveLayout(neither))
    expect(boxes(empty)).toEqual([])
    // The Grid itself is still there, empty.
    expect(empty.children).toHaveLength(0)
  })

  it('draws a Widget stored over another in the free place nearest the middle, and leaves the other', () => {
    const grid = drawnGrid(
      layoutOf(
        stored('aaaaaaaa', 'clock', [5, 4, 4, 2]),
        stored('bbbbbbbb', 'clock', [5, 4, 4, 2]),
      ),
    )
    // Row 2 and row 6 are equally near the middle; the tie goes to the row nearer the top.
    expect(boxes(grid)).toEqual([
      ['clock', '5 / span 4', '2 / span 2'],
      ['clock', '5 / span 4', '4 / span 2'],
    ])
  })

  it('draws a Widget stored off the Grid on it', () => {
    const grid = drawnGrid(layoutOf(stored('aaaaaaaa', 'clock', [11, 4, 4, 2])))
    expect(boxes(grid)).toEqual([['clock', '5 / span 4', '4 / span 2']])
  })

  it('leaves out a Widget with no free place, and one that is not well-formed', () => {
    const grid = drawnGrid(
      layoutOf(
        stored('aaaaaaaa', 'clock', [1, 1, 12, 8]),
        stored('bbbbbbbb', 'clock', [1, 1, 12, 8]),
        { id: 'cccccccc', type: 'clock' },
        'nonsense',
      ),
    )
    expect(boxes(grid)).toEqual([['clock', '1 / span 12', '1 / span 8']])
  })

  it('puts the boxes in reading order, whatever order they are stored in: row, then column, then id', () => {
    const grid = drawnGrid(
      layoutOf(
        stored('zzzzzzzz', 'clock', [1, 6, 3, 2]),
        stored('bbbbbbbb', 'clock', [7, 2, 3, 2]),
        stored('aaaaaaaa', 'clock', [1, 2, 3, 2]),
        stored('yyyyyyyy', 'weather', [11, 1, 2, 2]),
      ),
    )
    expect(boxes(grid)).toEqual([
      ['weather', '11 / span 2', '1 / span 2'],
      ['clock', '1 / span 3', '2 / span 2'],
      ['clock', '7 / span 3', '2 / span 2'],
      ['clock', '1 / span 3', '6 / span 2'],
    ])
  })

  it('keeps a box where it is when the Layout is stored in another order', () => {
    const clock = stored('aaaaaaaa', 'clock', [5, 4, 4, 2])
    const weather = stored('bbbbbbbb', 'weather', [11, 1, 2, 2])
    const view = render(<Grid layout={layoutOf(clock, weather)} page={PAGE} />)
    const before = view.container.querySelector('[data-widget="clock"]')

    view.rerender(<Grid layout={layoutOf(weather, clock)} page={PAGE} />)

    expect(view.container.querySelector('[data-widget="clock"]')).toBe(before)
  })

  it('draws a Widget of a type it does not know, in its place, and says it needs a newer version', () => {
    const grid = drawnGrid(layoutOf(stored('aaaaaaaa', 'bookmarks', [1, 3, 3, 4])))
    expect(boxes(grid)).toEqual([['bookmarks', '1 / span 3', '3 / span 4']])
    expect(screen.getByText('Needs a newer version of Lander')).toBeTruthy()
  })

  it("draws a Widget from its stored options, and the page's values", () => {
    const grid = drawnGrid(
      layoutOf(stored('aaaaaaaa', 'clock', [5, 4, 4, 2], { showDate: true, showSeconds: true })),
    )
    expect(grid.querySelector('.clock__date')).not.toBeNull()
    expect(grid.querySelector('.clock__time')?.textContent).toMatch(/^\d{1,2}:\d{2}:\d{2}$/)
  })

  it('draws no Weather reading by itself: a box with no place holds nothing', () => {
    const grid = drawnGrid(layoutOf(stored('aaaaaaaa', 'weather', [11, 1, 2, 2])))
    expect(boxes(grid)).toEqual([['weather', '11 / span 2', '1 / span 2']])
    expect(grid.querySelector('.widget-box')?.children).toHaveLength(0)
  })
})
