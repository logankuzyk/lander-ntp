import { act, render } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EXAMPLE_SIZES } from '@/test/fixtures'

import type { StateMessages, WidgetDefinition } from './definition'
import type { Need } from './needs'
import {
  type Reading,
  type ReadingCache,
  reportNeed,
  type Source,
  type WatchedSource,
} from './source'
import { LOADING_DELAY_MS, WidgetBox } from './WidgetBox'

const RECT = { col: 5, h: 2, row: 4, w: 4 }
const PAGE = { hour12: false }

const MAX_AGE_MS = 60_000
const MAX_STALE_MS = 600_000
const RETRY_MS = 10_000

type Options = { name: string; on: boolean }

/** A cache kept in memory, one reading per key. */
function memory() {
  const readings = new Map<string, Reading<number>>()
  const cache: ReadingCache<number> = {
    get: (key) => Promise.resolve(readings.get(key) ?? null),
    set: (key, reading) => {
      readings.set(key, reading)
      return Promise.resolve()
    },
  }
  return { cache, readings }
}

function setup({
  enabled,
  fetch = () => Promise.resolve(7),
  messages,
  needs,
}: {
  enabled?: () => Promise<boolean>
  fetch?: () => Promise<number | null>
  messages?: StateMessages
  needs?: readonly Need<Options>[]
} = {}) {
  const { cache, readings } = memory()
  const source: Source<number> = {
    cache,
    enabled,
    maxAgeMs: MAX_AGE_MS,
    maxStaleMs: MAX_STALE_MS,
    retryMs: RETRY_MS,
  }
  const definition: WidgetDefinition<Options, number, string> = {
    messages,
    name: 'Example',
    needs,
    options: [
      {
        choices: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
        control: 'choice',
        default: 'a',
        id: 'name',
        label: 'Name',
      },
      { control: 'switch', default: false, id: 'on', label: 'On' },
    ],
    sizes: EXAMPLE_SIZES,
    source: {
      source,
      useQuery: (options) => ({
        context: options.name,
        query: { fetch, key: options.name },
      }),
    },
    type: 'example',
    View: ({ reading }) => <p class="example">{reading}</p>,
  }
  return { definition, readings }
}

const draw = (definition: WidgetDefinition<Options, number, string>, options: unknown = {}) => (
  <WidgetBox definition={definition} options={options} page={PAGE} rect={RECT} />
)

/** Lets promises, and timers due within `ms` from now, run, inside `act`. */
const pass = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

const panel = (container: ParentNode) => container.querySelector('.widget-state')
const words = (container: ParentNode) =>
  [...(panel(container)?.children ?? [])].map((line) => line.textContent)
const view = (container: ParentNode) => container.querySelector('.example')?.textContent

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** Says whether the tab is in view, and tells the page it changed. */
const seen = (hidden: boolean, spy: { mockReturnValue: (value: boolean) => unknown }) => {
  spy.mockReturnValue(hidden)
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('WidgetBox states: a tab out of view', () => {
  it('does not count the wait while the tab is hidden, so a tab opened in the background does not flash loading when it is looked at', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    const { definition } = setup({ fetch: () => new Promise<number>(() => undefined) })
    const { container } = render(draw(definition))

    await pass(LOADING_DELAY_MS * 5)
    expect(panel(container)).toBeNull()

    await act(async () => seen(false, hidden))
    await pass(LOADING_DELAY_MS - 1)
    expect(panel(container)).toBeNull()

    await pass(1)
    expect(words(container)).toEqual(['Example', 'Loading'])
  })

  it('starts the wait again when the tab is looked at, whatever had passed in view before', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    const { definition } = setup({ fetch: () => new Promise<number>(() => undefined) })
    const { container } = render(draw(definition))
    await pass(LOADING_DELAY_MS - 100)

    await act(async () => seen(true, hidden))
    await pass(LOADING_DELAY_MS * 5)
    expect(panel(container)).toBeNull()

    await act(async () => seen(false, hidden))
    await pass(LOADING_DELAY_MS - 1)
    expect(panel(container)).toBeNull()
    await pass(1)
    expect(panel(container)?.getAttribute('data-state')).toBe('loading')
  })

  it('hides a loading panel that is showing when the tab goes out of view, and waits again on its return', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    const { definition } = setup({ fetch: () => new Promise<number>(() => undefined) })
    const { container } = render(draw(definition))
    await pass(LOADING_DELAY_MS)
    expect(panel(container)).not.toBeNull()

    await act(async () => seen(true, hidden))
    expect(panel(container)).toBeNull()

    await act(async () => seen(false, hidden))
    expect(panel(container)).toBeNull()
    await pass(LOADING_DELAY_MS)
    expect(panel(container)).not.toBeNull()
  })
})

describe('WidgetBox states: loading', () => {
  it('waits about 400 ms before saying it is loading', () => {
    expect(LOADING_DELAY_MS).toBe(400)
  })

  it('draws nothing at first, then a loading panel once the wait has passed with no reading', async () => {
    const { definition } = setup({ fetch: () => new Promise<number>(() => undefined) })
    const { container } = render(draw(definition))

    await pass(LOADING_DELAY_MS - 1)
    expect(panel(container)).toBeNull()

    await pass(1)
    expect(words(container)).toEqual(['Example', 'Loading'])
  })

  it('draws the panel in the box, as its only child, which has not changed', async () => {
    const { definition } = setup({ fetch: () => new Promise<number>(() => undefined) })
    const { container } = render(draw(definition))
    const box = container.querySelector('.widget-box') as HTMLElement
    const place = [box.style.gridColumn, box.style.gridRow]

    await pass(LOADING_DELAY_MS)

    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).toBe(box)
    expect(box.children).toHaveLength(1)
    expect(box.firstElementChild).toBe(panel(container))
    expect([box.style.gridColumn, box.style.gridRow]).toEqual(place)
  })

  it('says what state the panel is in, for the styles and for a test to find', async () => {
    const { definition } = setup({ fetch: () => new Promise<number>(() => undefined) })
    const { container } = render(draw(definition))
    await pass(LOADING_DELAY_MS)
    expect(panel(container)?.getAttribute('data-state')).toBe('loading')
    expect(panel(container)?.getAttribute('role')).toBe('status')
  })

  it('never flashes loading when a cached reading is there: ready, with no loading in between', async () => {
    const { definition, readings } = setup()
    readings.set('a', { data: 3, fetchedAt: Date.now() })
    const { container } = render(draw(definition))
    expect(panel(container)).toBeNull()

    await pass()
    expect(view(container)).toBe('3')

    await pass(LOADING_DELAY_MS * 2)
    expect(view(container)).toBe('3')
    expect(panel(container)).toBeNull()
  })

  it('never flashes loading when a fetch answers within the wait', async () => {
    const { definition } = setup({
      fetch: () => new Promise<number>((resolve) => setTimeout(() => resolve(7), 100)),
    })
    const { container } = render(draw(definition))

    await pass(100)
    expect(view(container)).toBe('7')

    await pass(LOADING_DELAY_MS * 2)
    expect(panel(container)).toBeNull()
  })

  it('replaces the loading panel with the View when the reading arrives', async () => {
    let answer!: (data: number) => void
    const { definition } = setup({ fetch: () => new Promise<number>((r) => (answer = r)) })
    const { container } = render(draw(definition))
    await pass(LOADING_DELAY_MS)
    expect(panel(container)).not.toBeNull()

    answer(7)
    await pass()

    expect(panel(container)).toBeNull()
    expect(view(container)).toBe('7')
  })

  it('waits again, from the new options, when they ask for another reading and nothing is cached', async () => {
    const { definition, readings } = setup({ fetch: () => new Promise<number>(() => undefined) })
    readings.set('a', { data: 3, fetchedAt: Date.now() })
    const shown = render(draw(definition, { name: 'a' }))
    await pass()
    expect(view(shown.container)).toBe('3')

    shown.rerender(draw(definition, { name: 'b' }))
    await pass(LOADING_DELAY_MS - 1)
    expect(view(shown.container)).toBeUndefined()
    expect(panel(shown.container)).toBeNull()

    await pass(1)
    expect(words(shown.container)).toEqual(['Example', 'Loading'])
  })

  it('draws no panel for a Widget without a source', () => {
    const plain: WidgetDefinition<Options> = {
      name: 'Plain',
      options: [],
      sizes: EXAMPLE_SIZES,
      type: 'plain',
      View: () => <p class="example">plain</p>,
    }
    const { container } = render(
      <WidgetBox definition={plain} options={{}} page={PAGE} rect={RECT} />,
    )
    expect(view(container)).toBe('plain')
    expect(panel(container)).toBeNull()
  })
})

describe('WidgetBox states: a Need reported while a watched Source is running', () => {
  it('shows an object reading that has its own need field', async () => {
    const reading = { need: 'ordinary reading data', value: 6 }
    const source: WatchedSource<typeof reading, Options> = {
      kind: 'watched',
      read: async () => reading,
      watch: () => () => undefined,
    }
    const definition: WidgetDefinition<Options, typeof reading, undefined> = {
      name: 'Example',
      options: [],
      sizes: EXAMPLE_SIZES,
      source: { kind: 'watched', source },
      type: 'example',
      View: ({ reading }) => (
        <p class="example">
          {reading.need}: {reading.value}
        </p>
      ),
    }
    const { container } = render(
      <WidgetBox
        definition={definition}
        options={{ name: 'a', on: false }}
        page={PAGE}
        rect={RECT}
      />,
    )
    await pass()

    expect(view(container)).toBe('ordinary reading data: 6')
    expect(panel(container)).toBeNull()
  })

  it('uses the existing 400 ms loading delay for a watched Source', async () => {
    const source: WatchedSource<number, Options> = {
      kind: 'watched',
      read: () => new Promise<number>(() => undefined),
      watch: () => () => undefined,
    }
    const definition: WidgetDefinition<Options, number, undefined> = {
      name: 'Example',
      options: [],
      sizes: EXAMPLE_SIZES,
      source: { kind: 'watched', source },
      type: 'example',
      View: ({ reading }) => <p class="example">{reading}</p>,
    }
    const { container } = render(
      <WidgetBox
        definition={definition}
        options={{ name: 'a', on: false }}
        page={PAGE}
        rect={RECT}
      />,
    )

    await pass(LOADING_DELAY_MS - 1)
    expect(panel(container)).toBeNull()
    await pass(1)
    expect(panel(container)?.getAttribute('data-state')).toBe('loading')
  })

  it('draws the matching Need as the Setup button', async () => {
    const source: WatchedSource<number, Options> = {
      kind: 'watched',
      read: async () => reportNeed('choose-folder'),
      watch: () => () => undefined,
    }
    const need: Need<Options> = {
      action: { kind: 'option', option: 'name' },
      id: 'choose-folder',
      label: 'Choose a folder',
      met: () => true,
    }
    const definition: WidgetDefinition<Options, number, undefined> = {
      name: 'Example',
      needs: [need],
      options: [],
      sizes: EXAMPLE_SIZES,
      source: { kind: 'watched', source },
      type: 'example',
      View: ({ reading }) => <p class="example">{reading}</p>,
    }
    const { container } = render(
      <WidgetBox
        definition={definition}
        id="example-id"
        options={{ name: 'a', on: false }}
        page={PAGE}
        rect={RECT}
      />,
    )
    await pass()

    const button = container.querySelector('.widget-setup')
    expect(button?.textContent).toBe('ExampleChoose a folder')
    expect(button?.getAttribute('aria-label')).toBe('Example, Choose a folder')
  })
})

describe('WidgetBox states: failed', () => {
  it('draws the failed panel as soon as the fetch fails with no reading, with no wait and no loading first', async () => {
    const { definition } = setup({ fetch: () => Promise.resolve(null) })
    const { container } = render(draw(definition))

    await pass()

    expect(panel(container)?.getAttribute('data-state')).toBe('failed')
    expect(words(container)).toEqual(['Example', "Can't load this"])
  })

  it('goes from loading to failed when a slow fetch fails', async () => {
    const { definition } = setup({
      fetch: () => new Promise<number | null>((resolve) => setTimeout(() => resolve(null), 2_000)),
    })
    const { container } = render(draw(definition))
    await pass(LOADING_DELAY_MS)
    expect(panel(container)?.getAttribute('data-state')).toBe('loading')

    await pass(2_000)

    expect(panel(container)?.getAttribute('data-state')).toBe('failed')
  })

  it('uses the words the definition gives for it', async () => {
    const { definition } = setup({
      fetch: () => Promise.resolve(null),
      messages: { failed: "Can't reach the forecast" },
    })
    const { container } = render(draw(definition))
    await pass()
    expect(words(container)).toEqual(['Example', "Can't reach the forecast"])
  })

  it('shows a stale reading, silently, when a refresh fails: no panel while it is inside the stale limit', async () => {
    const { definition, readings } = setup({ fetch: () => Promise.resolve(null) })
    readings.set('a', { data: 3, fetchedAt: Date.now() - MAX_AGE_MS - 1 })
    const { container } = render(draw(definition))

    await pass()
    expect(view(container)).toBe('3')
    expect(panel(container)).toBeNull()

    await pass(RETRY_MS)
    expect(view(container)).toBe('3')
    expect(panel(container)).toBeNull()
  })

  it('draws failed once the kept reading is older than the stale limit and a refresh fails', async () => {
    const { definition, readings } = setup({ fetch: () => Promise.resolve(null) })
    readings.set('a', { data: 3, fetchedAt: Date.now() - MAX_STALE_MS + RETRY_MS * 2 })
    const { container } = render(draw(definition))
    await pass()
    expect(view(container)).toBe('3')

    await pass(RETRY_MS * 3)

    expect(view(container)).toBeUndefined()
    expect(panel(container)?.getAttribute('data-state')).toBe('failed')
  })

  it('does not show a reading too old to show: failed', async () => {
    const { definition, readings } = setup({ fetch: () => Promise.resolve(null) })
    readings.set('a', { data: 3, fetchedAt: Date.now() - MAX_STALE_MS - 1 })
    const { container } = render(draw(definition))

    await pass()

    expect(view(container)).toBeUndefined()
    expect(panel(container)?.getAttribute('data-state')).toBe('failed')
  })

  it('keeps the failed panel while the retry is under way, and draws the View when a retry succeeds', async () => {
    const results: (number | null)[] = [null, 5]
    const { definition } = setup({ fetch: () => Promise.resolve(results.shift() ?? null) })
    const { container } = render(draw(definition))
    await pass()
    expect(panel(container)?.getAttribute('data-state')).toBe('failed')

    await pass(RETRY_MS)

    expect(panel(container)).toBeNull()
    expect(view(container)).toBe('5')
  })
})

describe('WidgetBox states: off', () => {
  it('draws the off panel as soon as the source is switched off, with no wait', async () => {
    const { definition } = setup({ enabled: () => Promise.resolve(false) })
    const { container } = render(draw(definition))

    await pass()

    expect(panel(container)?.getAttribute('data-state')).toBe('off')
    expect(words(container)).toEqual(['Example', 'Switched off for now'])
  })

  it('draws off, not the reading, when there is a fresh one cached', async () => {
    const { definition, readings } = setup({ enabled: () => Promise.resolve(false) })
    readings.set('a', { data: 3, fetchedAt: Date.now() })
    const { container } = render(draw(definition))

    await pass()

    expect(view(container)).toBeUndefined()
    expect(panel(container)?.getAttribute('data-state')).toBe('off')
  })

  it('uses the words the definition gives for it', async () => {
    const { definition } = setup({
      enabled: () => Promise.resolve(false),
      messages: { off: 'The forecast is paused' },
    })
    const { container } = render(draw(definition))
    await pass()
    expect(words(container)).toEqual(['Example', 'The forecast is paused'])
  })

  it('takes a message of its own for each state, and the default for the rest', async () => {
    const { definition } = setup({
      fetch: () => new Promise<number>(() => undefined),
      messages: { failed: 'Nope' },
    })
    const { container } = render(draw(definition))
    await pass(LOADING_DELAY_MS)
    expect(words(container)).toEqual(['Example', 'Loading'])
  })
})

describe('WidgetBox states with needs', () => {
  it('draws no panel, and runs no source, while a need is unmet: that is the setup button, not a state', async () => {
    const fetch = vi.fn(() => Promise.resolve(null))
    const { definition } = setup({ fetch, needs: [{ id: 'a', met: () => false }] })
    const { container } = render(draw(definition))

    await pass(LOADING_DELAY_MS * 5)

    expect(fetch).not.toHaveBeenCalled()
    expect(panel(container)).toBeNull()
    expect(container.querySelector('.widget-box')?.children).toHaveLength(0)
  })

  it('draws no panel while the needs are first checked', async () => {
    const { definition } = setup({
      fetch: () => Promise.resolve(null),
      needs: [{ id: 'a', met: () => new Promise<boolean>(() => undefined) }],
    })
    const { container } = render(draw(definition))
    await pass(LOADING_DELAY_MS * 5)
    expect(container.querySelector('.widget-box')?.children).toHaveLength(0)
  })

  it('keeps a drawn Widget drawn while its needs are checked again for new options, whatever it is drawing', async () => {
    const answers: ((met: boolean) => void)[] = []
    const { definition, readings } = setup({
      fetch: () => Promise.resolve(null),
      needs: [
        {
          id: 'a',
          met: (options) =>
            options.on ? new Promise<boolean>((resolve) => answers.push(resolve)) : true,
        },
      ],
    })
    readings.set('a', { data: 3, fetchedAt: Date.now() })
    const shown = render(draw(definition, { on: false }))
    await pass()
    expect(view(shown.container)).toBe('3')

    shown.rerender(draw(definition, { on: true }))
    await pass(LOADING_DELAY_MS * 2)

    // Still there, with no panel, while the answer is awaited.
    expect(view(shown.container)).toBe('3')
    expect(panel(shown.container)).toBeNull()
  })

  it('keeps a drawn panel drawn while its needs are checked again for new options', async () => {
    const { definition } = setup({
      fetch: () => Promise.resolve(null),
      needs: [
        {
          id: 'a',
          met: (options) => (options.on ? new Promise<boolean>(() => undefined) : true),
        },
      ],
    })
    const shown = render(draw(definition, { on: false }))
    await pass()
    expect(panel(shown.container)?.getAttribute('data-state')).toBe('failed')

    shown.rerender(draw(definition, { on: true }))
    await pass(LOADING_DELAY_MS * 2)

    expect(panel(shown.container)?.getAttribute('data-state')).toBe('failed')
  })
})

describe('WidgetBox states: the wait for loading, once it has been served', () => {
  it('takes a loading panel that is showing away at once when the reading asked for changes, and waits again before it comes back', async () => {
    const { definition } = setup({ fetch: () => new Promise<number>(() => undefined) })
    const shown = render(draw(definition, { name: 'a' }))
    await pass(LOADING_DELAY_MS)
    expect(words(shown.container)).toEqual(['Example', 'Loading'])

    shown.rerender(draw(definition, { name: 'b' }))
    await pass()
    expect(panel(shown.container)).toBeNull()

    await pass(LOADING_DELAY_MS - 1)
    expect(panel(shown.container)).toBeNull()
    await pass(1)
    expect(words(shown.container)).toEqual(['Example', 'Loading'])
  })

  it('waits again for the same reading when it is loading again after it was not: what was waited for before does not count', async () => {
    let enabled = true
    let slow = true
    const { definition, readings } = setup({
      enabled: () => Promise.resolve(enabled),
      fetch: () =>
        slow
          ? new Promise<number>((resolve) => setTimeout(() => resolve(7), 1_000))
          : new Promise<number>(() => undefined),
    })
    const { container } = render(draw(definition))
    await pass(LOADING_DELAY_MS)
    expect(panel(container)?.getAttribute('data-state')).toBe('loading')
    await pass(1_000)
    expect(view(container)).toBe('7')

    // Switched off, then on again with nothing cached and a request that does not answer.
    enabled = false
    await pass(MAX_AGE_MS)
    expect(panel(container)?.getAttribute('data-state')).toBe('off')
    enabled = true
    slow = false
    readings.clear()
    await pass(MAX_AGE_MS)
    expect(panel(container)).toBeNull()

    await pass(LOADING_DELAY_MS - 1)
    expect(panel(container)).toBeNull()
    await pass(1)
    expect(panel(container)?.getAttribute('data-state')).toBe('loading')
  })
})
