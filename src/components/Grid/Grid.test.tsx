import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'
import { checkLayout } from '@/layout/check'
import { deriveLayout } from '@/layout/derive'
import type { Layout } from '@/layout/types'
import { DEFAULT_SETTINGS, type Settings } from '@/settings/schema'
import { makeWeather } from '@/test/fixtures'
import { css, rule } from '@/test/styles'
import { cacheKey } from '@/weather/openMeteo'
import { weatherSource } from '@/weather/weatherSource'
import { RemovalProvider } from '@/widgetSystem/useRemoval'

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

describe('Grid, the names of the boxes', () => {
  const weatherAt = (id: string, col: number, options: Record<string, unknown>) =>
    stored(id, 'weather', [col, 1, 2, 2], options)

  it('names each box for its Widget and what tells it from another of its kind', () => {
    const grid = drawnGrid(
      layoutOf(
        stored('clock0001', 'clock', [5, 4, 4, 2]),
        weatherAt('wthr0001', 1, { followDevice: false, place: PLACE }),
        weatherAt('wthr0002', 4, {
          followDevice: false,
          place: { latitude: 49.28, longitude: -123.12, name: 'Vancouver' },
        }),
        weatherAt('wthr0003', 7, { followDevice: true }),
        weatherAt('wthr0004', 10, { followDevice: false, place: null }),
      ),
    )
    expect(
      [...grid.querySelectorAll('.widget-box')].map((box) => [
        box.getAttribute('role'),
        box.getAttribute('aria-label'),
      ]),
    ).toEqual([
      ['group', 'Weather, Victoria'],
      ['group', 'Weather, Vancouver'],
      ['group', 'Weather, Current location'],
      ['group', 'Weather'],
      ['group', 'Clock'],
    ])
  })

  it('calls a Widget this version does not know by the name edit mode gives it', () => {
    const grid = drawnGrid(layoutOf(stored('what0001', 'tomorrow', [1, 1, 2, 2])))
    const box = grid.querySelector('.widget-box')
    expect(box?.getAttribute('aria-label')).toBe('Unknown widget')
    expect(box?.getAttribute('role')).toBe('group')
  })
})

describe('Grid', () => {
  it('draws the Clock of a new install in the middle: column 5, row 4, 4 by 2', () => {
    const grid = drawnGrid(deriveLayout(DEFAULT_SETTINGS))
    expect(boxes(grid)).toEqual([['clock', '5 / span 4', '4 / span 2']])
  })

  it('draws the Clock with seconds 6 by 2 from column 4', () => {
    const grid = drawnGrid(deriveLayout(settingsWith({ clock: { showSeconds: true } })))
    expect(boxes(grid)).toEqual([['clock', '4 / span 6', '4 / span 2']])
  })

  it("draws an updated user's Weather in the top right corner, at the Weather's own size", async () => {
    // A reading is cached, so the Weather asks nothing of the forecast.
    await weatherSource.cache.set(cacheKey(PLACE, 'celsius'), {
      data: makeWeather(),
      fetchedAt: Date.now(),
    })
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

  it('draws no Weather reading by itself: a box with no place holds only its setup button', () => {
    const grid = drawnGrid(layoutOf(stored('aaaaaaaa', 'weather', [11, 1, 2, 2])))
    expect(boxes(grid)).toEqual([['weather', '11 / span 2', '1 / span 2']])
    expect(grid.querySelector('.widget-box')?.children).toHaveLength(1)
    expect(grid.querySelector('.widget-box > .widget-setup')?.textContent).toBe(
      'WeatherChoose a place',
    )
    expect(grid.querySelector('.weather')).toBeNull()
  })

  it("keeps a Widget's element when another is drawn before it in reading order", () => {
    const clock = stored('cccccccc', 'clock', [5, 4, 4, 2])
    const view = render(<Grid layout={layoutOf(clock)} page={PAGE} />)
    const before = view.container.querySelector('[data-widget="clock"]')

    view.rerender(
      <Grid layout={layoutOf(stored('aaaaaaaa', 'weather', [11, 1, 2, 2]), clock)} page={PAGE} />,
    )

    expect(view.container.querySelector('[data-widget="clock"]')).toBe(before)
  })

  it('keeps the element of a Widget it cannot draw too, when another comes before it', () => {
    const unknown = stored('cccccccc', 'bookmarks', [1, 4, 3, 2])
    const view = render(<Grid layout={layoutOf(unknown)} page={PAGE} />)
    const before = view.container.querySelector('[data-widget="bookmarks"]')

    view.rerender(
      <Grid layout={layoutOf(stored('aaaaaaaa', 'calendar', [1, 1, 3, 2]), unknown)} page={PAGE} />,
    )

    expect(view.container.querySelector('[data-widget="bookmarks"]')).toBe(before)
  })

  it('hands the Widgets the page values it is given, not its own', () => {
    // Local time, so the assertion does not depend on the machine's timezone.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 21, 5, 9))
    try {
      const layout = layoutOf(stored('aaaaaaaa', 'clock', [5, 4, 4, 2]))
      const twelve = render(<Grid layout={layout} page={{ hour12: true }} />)
      expect(twelve.container.querySelector('.clock__time')?.textContent).toBe('9:05')
      const twentyFour = render(<Grid layout={layout} page={{ hour12: false }} />)
      expect(twentyFour.container.querySelector('.clock__time')?.textContent).toBe('21:05')
    } finally {
      vi.useRealTimers()
    }
  })

  it('has its columns and rows from the Grid geometry, as custom properties the styles use', () => {
    const grid = drawnGrid(layoutOf()) as HTMLElement
    expect(grid.style.getPropertyValue('--cols')).toBe('12')
    expect(grid.style.getPropertyValue('--rows')).toBe('8')
  })
})

/** The Grid in edit mode, entered and left with these two buttons. */
function EditToggles() {
  const { enter, leave } = useEditMode()
  return (
    <>
      <button onClick={enter} type="button">
        enter
      </button>
      <button onClick={leave} type="button">
        leave
      </button>
    </>
  )
}

const renderEditable = (layout: Layout) => {
  const view = render(
    <EditModeProvider>
      <EditToggles />
      <Grid layout={layout} page={PAGE} />
    </EditModeProvider>,
  )
  const grid = view.container.querySelector('.grid')
  if (!grid) throw new Error('no Grid was drawn')
  return { ...view, grid }
}

const edit = () => fireEvent.click(screen.getByText('enter'))

describe('Grid in edit mode', () => {
  const THREE_OUT_OF_ORDER = layoutOf(
    stored('zzzzzzzz', 'clock', [1, 6, 3, 2]),
    stored('aaaaaaaa', 'clock', [7, 2, 3, 2]),
    stored('yyyyyyyy', 'weather', [11, 1, 2, 2]),
  )

  it('is drawn as it was before outside edit mode: no frames, dots, tab stops or words', () => {
    const { grid } = renderEditable(THREE_OUT_OF_ORDER)

    expect(grid.classList.contains('grid--editing')).toBe(false)
    expect(grid.querySelector('.grid__dots')).toBeNull()
    expect(grid.querySelectorAll('[tabindex]')).toHaveLength(0)
    expect(grid.querySelectorAll('.widget-box__name')).toHaveLength(0)
    // Changed by W20: each box is a named group outside edit mode too (it has a tab stop and a
    // drawn name only in edit mode).
    expect(screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual([
      'Weather',
      'Clock',
      'Clock',
    ])
  })

  it('draws a dot at every cell corner: 13 by 9, from edge to edge of the Grid', () => {
    const { grid } = renderEditable(layoutOf())
    edit()

    expect(grid.classList.contains('grid--editing')).toBe(true)
    const dots = grid.querySelector('.grid__dots')
    expect(dots?.getAttribute('aria-hidden')).toBe('true')
    const corners = [...(dots?.querySelectorAll('circle') ?? [])].map((dot) => [
      dot.getAttribute('cx'),
      dot.getAttribute('cy'),
    ])
    expect(corners).toHaveLength(13 * 9)
    const columns = new Set(corners.map(([cx]) => cx))
    const rows = new Set(corners.map(([, cy]) => cy))
    expect(columns.size).toBe(13)
    expect(rows.size).toBe(9)
    // The outermost corners are the Grid's own edges.
    expect(columns).toContain('0%')
    expect(columns).toContain('100%')
    expect(rows).toContain('0%')
    expect(rows).toContain('100%')
  })

  it('takes the dots away again on leaving', () => {
    const { grid } = renderEditable(layoutOf())
    edit()
    fireEvent.click(screen.getByText('leave'))

    expect(grid.classList.contains('grid--editing')).toBe(false)
    expect(grid.querySelector('.grid__dots')).toBeNull()
  })

  it('gives each Widget a frame with its name, as a tab stop in a group of that name', () => {
    const { grid } = renderEditable(THREE_OUT_OF_ORDER)
    edit()

    const groups = screen.getAllByRole('group')
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Weather',
      'Clock',
      'Clock',
    ])
    for (const group of groups) {
      expect(group.getAttribute('tabindex')).toBe('0')
      expect(group.classList.contains('widget-box')).toBe(true)
    }
    // The name is drawn as well, but not read twice.
    const names = [...grid.querySelectorAll('.widget-box__name')]
    expect(names.map((name) => name.textContent)).toEqual(['Weather', 'Clock', 'Clock'])
    expect(names.every((name) => name.getAttribute('aria-hidden') === 'true')).toBe(true)
  })

  it('says the same in the frame as the box did: two Weathers are told apart by their places', () => {
    const { grid } = renderEditable(
      layoutOf(
        stored('wthr0001', 'weather', [1, 1, 2, 2], { followDevice: false, place: PLACE }),
        stored('wthr0002', 'weather', [4, 1, 2, 2], { followDevice: true }),
      ),
    )
    const before = screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))
    edit()

    const groups = screen.getAllByRole('group')
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual(before)
    expect(before).toEqual(['Weather, Victoria', 'Weather, Current location'])
    expect([...grid.querySelectorAll('.widget-box__name')].map((name) => name.textContent)).toEqual(
      before,
    )
  })

  it('goes row by row, left to right, for Tab: three Widgets stored out of order', () => {
    const { grid } = renderEditable(THREE_OUT_OF_ORDER)
    edit()

    // Tab visits tab stops in document order (none has a positive tabindex), and the boxes are
    // in the document in reading order.
    const stops = [...grid.querySelectorAll<HTMLElement>('[tabindex]')]
    expect(stops.every((stop) => stop.tabIndex === 0)).toBe(true)
    expect(
      stops.map((stop) => [stop.dataset.widget, stop.style.gridColumn, stop.style.gridRow]),
    ).toEqual([
      ['weather', '11 / span 2', '1 / span 2'],
      ['clock', '7 / span 3', '2 / span 2'],
      ['clock', '1 / span 3', '6 / span 2'],
    ])
  })

  it('frames a Widget it does not know too, so it can be reached', () => {
    renderEditable(layoutOf(stored('aaaaaaaa', 'bookmarks', [1, 3, 3, 4])))
    edit()

    const group = screen.getByRole('group', { name: 'Unknown widget' })
    expect(group.getAttribute('tabindex')).toBe('0')
    expect(screen.getByText('Needs a newer version of Lander')).toBeTruthy()
  })

  it('lets a person remove an unknown Widget, but has no options or resize handle for it', () => {
    const remove = vi.fn()
    const layout = layoutOf(stored('future01', 'bookmarks', [1, 3, 3, 4]))
    render(
      <EditModeProvider>
        <EditToggles />
        <RemovalProvider value={{ available: true, remove }}>
          <Grid layout={layout} page={PAGE} />
        </RemovalProvider>
      </EditModeProvider>,
    )
    edit()

    expect(screen.getByText('Needs a newer version of Lander')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove Unknown widget' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Unknown widget options' })).toBeNull()
    expect(document.querySelector('.widget-box__resize')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Unknown widget' }))

    expect(remove).toHaveBeenCalledWith('future01')
  })

  it('says how to move between Widgets, politely, when edit mode starts', () => {
    renderEditable(THREE_OUT_OF_ORDER)
    const status = document.querySelector('[aria-live="polite"]')
    if (!status) throw new Error('no live region')
    // The region is on the page before there is anything to say, so the words are announced.
    expect(status.textContent).toBe('')
    expect(status.classList.contains('visually-hidden')).toBe(true)

    edit()
    expect(status.textContent).toBe('Editing widgets. Tab moves between widgets.')

    fireEvent.click(screen.getByText('leave'))
    expect(status.textContent).toBe('')
  })

  it('keeps a Widget element when edit mode starts, so its state is not lost', () => {
    const { grid } = renderEditable(THREE_OUT_OF_ORDER)
    const before = grid.querySelector('[data-widget="weather"]')

    edit()

    expect(grid.querySelector('[data-widget="weather"]')).toBe(before)
  })

  it('draws an empty Grid with the dots and nothing to reach', () => {
    const { grid } = renderEditable(layoutOf())
    edit()

    expect(grid.querySelector('.grid__dots')).not.toBeNull()
    expect(screen.queryByRole('group')).toBeNull()
  })
})

/**
 * A browser lays this out and happy-dom cannot, so these read two rules out of the stylesheet,
 * as a guard on what was measured to matter. The measurements are in the pull request.
 */
describe('the Grid styles', () => {
  it("centres a box's content when it is wider or taller than the box, not only when it fits", () => {
    // `place-items` aligns the item inside its track, and the implicit track grows from the
    // left edge, so overflow runs only right. The tracks have to be centred too.
    expect(rule('.widget-box')).toMatch(/justify-content:\s*center/)
    expect(rule('.widget-box')).toMatch(/align-content:\s*center/)
  })

  it('fades the dots and the wash in, and not under reduced motion', () => {
    expect(rule('.grid__dots')).toMatch(/animation:\s*edit-appear/)
    expect(rule('.grid--editing::before')).toMatch(/animation:\s*edit-appear/)
    const reduced = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .grid--editing'),
    )
    expect(reduced.slice(0, reduced.indexOf('\n}\n'))).toMatch(
      /\.grid--editing::before,\s*\.grid__dots\s*{\s*animation:\s*none/,
    )
  })

  it('lets presses through the wash and the dots to the Widgets under them', () => {
    expect(rule('.grid--editing::before')).toMatch(/pointer-events:\s*none/)
    expect(rule('.grid__dots')).toMatch(/pointer-events:\s*none/)
  })

  it('positions the frames, so they paint above the wash and the dots, which come first', () => {
    expect(rule('.grid--editing .widget-box')).toMatch(/position:\s*relative/)
  })

  it('rings a focused frame in white with a dark line outside it, to show on a bright photo', () => {
    const focused = rule('.grid--editing .widget-box:focus-visible')
    expect(focused).toMatch(/outline:\s*2px solid var\(--color-fg\)/)
    expect(focused).toMatch(/box-shadow:\s*0 0 0 1px rgb\(0 0 0 \/ 60%\)/)
  })

  it('keeps a long credit clear of the buttons on a narrow window', () => {
    expect(css).toMatch(
      /@media \(max-width: 48rem\) {\s*\.credit {\s*max-width: max\(8rem, calc\(100% - 17rem\)\);/,
    )
  })

  it("lays the cells out from the Grid's custom properties", () => {
    expect(rule('.grid')).toContain('repeat(var(--cols)')
    expect(rule('.grid')).toContain('repeat(var(--rows)')
  })
})
