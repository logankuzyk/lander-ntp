import { act, render } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { EXAMPLE_SIZES } from '@/test/fixtures'
import { clockDefinition } from '@/widgets/Clock/definition'

import type { WidgetDefinition } from './definition'
import type { Need } from './needs'
import type { Query, Reading, Source } from './source'
import { WidgetHost } from './WidgetHost'

const time = (container: ParentNode) => container.querySelector('.clock__time')?.textContent

describe('WidgetHost', () => {
  it("draws the Widget's View with its options and the page's values", () => {
    const { container } = render(
      <WidgetHost
        definition={clockDefinition}
        options={{ showDate: true, showSeconds: true }}
        page={{ hour12: true }}
      />,
    )
    expect(time(container)).toMatch(/^\d{1,2}:\d{2}:\d{2}$/)
    expect(container.querySelector('.clock__date')).not.toBeNull()
  })

  it('follows the page value for 12/24-hour time', () => {
    // Local time, so the assertions don't depend on the machine's timezone.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 11, 21, 5, 9))
    try {
      const twelve = render(
        <WidgetHost definition={clockDefinition} options={{}} page={{ hour12: true }} />,
      )
      expect(time(twelve.container)).toBe('9:05')
      const twentyFour = render(
        <WidgetHost definition={clockDefinition} options={{}} page={{ hour12: false }} />,
      )
      expect(time(twentyFour.container)).toBe('21:05')
    } finally {
      vi.useRealTimers()
    }
  })

  it('adds no element of its own: the first thing in the container is the Widget', () => {
    const { container } = render(
      <WidgetHost definition={clockDefinition} options={{}} page={{ hour12: false }} />,
    )
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild?.classList.contains('clock')).toBe(true)
  })

  it('reads the options through the definition: a missing one is its default, a bad one costs the Widget its options', () => {
    const seen: unknown[] = []
    const example: WidgetDefinition<{ flag: boolean; other: boolean }> = {
      name: 'Example',
      options: [
        { control: 'switch', default: true, id: 'flag', label: 'Flag' },
        { control: 'switch', default: false, id: 'other', label: 'Other' },
      ],
      sizes: EXAMPLE_SIZES,
      type: 'example',
      View: ({ options }) => {
        seen.push(options)
        return null
      },
    }

    render(<WidgetHost definition={example} options={{ other: true }} page={{ hour12: false }} />)
    render(
      <WidgetHost
        definition={example}
        options={{ flag: false, other: 'nope' }}
        page={{ hour12: false }}
      />,
    )

    expect(seen).toEqual([
      { flag: true, other: true },
      { flag: true, other: false },
    ])
  })
})

/** Runs `give`, then lets every promise it set going finish, inside `act`. */
const settle = (give: () => void) =>
  act(async () => {
    give()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

describe('WidgetHost with needs', () => {
  type Options = { on: boolean }

  /** A Widget made up here: it draws its name, and needs whatever the test gives it. */
  const example = (needs?: readonly Need<Options>[]): WidgetDefinition<Options> => ({
    name: 'Example',
    needs,
    options: [{ control: 'switch', default: false, id: 'on', label: 'On' }],
    sizes: EXAMPLE_SIZES,
    type: 'example',
    View: ({ options }) => <p class="example">{options.on ? 'on' : 'off'}</p>,
  })
  const page = { hour12: false }

  it('draws the View in its first render when every need is met at once', () => {
    const { container } = render(
      <WidgetHost
        definition={example([{ id: 'a', met: () => true }])}
        options={{ on: true }}
        page={page}
      />,
    )
    expect(container.querySelector('.example')?.textContent).toBe('on')
  })

  it('draws nothing while a need is unmet', () => {
    const { container } = render(
      <WidgetHost
        definition={example([
          { id: 'a', met: () => true },
          { id: 'b', met: () => false },
        ])}
        options={{ on: true }}
        page={page}
      />,
    )
    expect(container.children).toHaveLength(0)
  })

  it('draws nothing while checking, then the View once every need is met', async () => {
    let answer!: (met: boolean) => void
    const definition = example([
      { id: 'a', met: () => new Promise<boolean>((resolve) => (answer = resolve)) },
    ])
    const { container } = render(
      <WidgetHost definition={definition} options={{ on: true }} page={page} />,
    )
    expect(container.children).toHaveLength(0)

    await settle(() => answer(true))

    expect(container.querySelector('.example')?.textContent).toBe('on')
  })

  it('draws nothing when a late answer says a need is unmet', async () => {
    let answer!: (met: boolean) => void
    const definition = example([
      { id: 'a', met: () => new Promise<boolean>((resolve) => (answer = resolve)) },
    ])
    const { container } = render(
      <WidgetHost definition={definition} options={{ on: true }} page={page} />,
    )

    await settle(() => answer(false))

    expect(container.children).toHaveLength(0)
  })

  it('asks the needs with the options as the definition reads them', () => {
    const met = vi.fn(() => true)
    render(<WidgetHost definition={example([{ id: 'a', met }])} options={{}} page={page} />)
    expect(met).toHaveBeenCalledWith({ on: false })
  })

  it('checks again when the stored options change, and draws once they meet the need', () => {
    const definition = example([{ id: 'on', met: (options) => options.on }])
    const view = render(<WidgetHost definition={definition} options={{}} page={page} />)
    expect(view.container.children).toHaveLength(0)

    view.rerender(<WidgetHost definition={definition} options={{ on: true }} page={page} />)

    expect(view.container.querySelector('.example')?.textContent).toBe('on')
  })

  it('does not check again when it is drawn again with the same options', () => {
    const met = vi.fn(() => true)
    const definition = example([{ id: 'a', met }])
    const view = render(<WidgetHost definition={definition} options={{}} page={page} />)
    view.rerender(<WidgetHost definition={definition} options={{}} page={{ hour12: true }} />)
    expect(met).toHaveBeenCalledTimes(1)
  })

  it('keeps a drawn Widget drawn while its needs are checked again for new options, and hides it if one is then unmet', async () => {
    const answers: ((met: boolean) => void)[] = []
    const definition = example([
      { id: 'a', met: () => new Promise<boolean>((resolve) => answers.push(resolve)) },
    ])
    const view = render(<WidgetHost definition={definition} options={{}} page={page} />)
    await settle(() => answers[0]!(true))
    expect(view.container.querySelector('.example')?.textContent).toBe('off')

    view.rerender(<WidgetHost definition={definition} options={{ on: true }} page={page} />)
    expect(view.container.querySelector('.example')?.textContent).toBe('on')

    await settle(() => answers[1]!(false))
    expect(view.container.children).toHaveLength(0)
  })

  it('hides a Widget whose need became unmet, also while its needs are checked again', async () => {
    const answers: ((met: boolean) => void)[] = []
    const definition = example([
      {
        id: 'a',
        met: (options) =>
          options.on ? new Promise<boolean>((resolve) => answers.push(resolve)) : false,
      },
    ])
    const view = render(<WidgetHost definition={definition} options={{ on: true }} page={page} />)
    await settle(() => answers[0]!(true))
    expect(view.container.children).toHaveLength(1)

    view.rerender(<WidgetHost definition={definition} options={{ on: false }} page={page} />)
    expect(view.container.children).toHaveLength(0)

    view.rerender(<WidgetHost definition={definition} options={{ on: true }} page={page} />)
    expect(view.container.children).toHaveLength(0)

    await settle(() => answers[1]!(true))
    expect(view.container.children).toHaveLength(1)
  })

  it('adds no element of its own once its needs are met', () => {
    const { container } = render(
      <WidgetHost
        definition={example([{ id: 'a', met: () => true }])}
        options={{ on: true }}
        page={page}
      />,
    )
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild?.classList.contains('example')).toBe(true)
  })
})

describe('WidgetHost with a source', () => {
  type Options = { name: string }

  /** A source that keeps nothing, so every check fetches. */
  const source: Source<number> = {
    cache: {
      get: () => Promise.resolve(null),
      set: () => Promise.resolve(),
    },
    maxAgeMs: 60_000,
    maxStaleMs: 600_000,
    retryMs: 10_000,
  }

  /** A Widget made up here that draws what it is given: the reading and the context. */
  const example = (
    query: (options: Options) => Query<number> | null,
    needs?: readonly Need<Options>[],
    seen: string[] = [],
    from: Source<number> = source,
  ): WidgetDefinition<Options, number, string> => ({
    name: 'Example',
    needs,
    options: [
      {
        choices: [{ label: 'A', value: 'a' }],
        control: 'choice',
        default: 'a',
        id: 'name',
        label: 'Name',
      },
    ],
    sizes: EXAMPLE_SIZES,
    source: {
      source: from,
      useQuery: (options) => {
        seen.push(options.name)
        return { context: `context ${options.name}`, query: query(options) }
      },
    },
    type: 'example',
    View: ({ context, reading }) => (
      <p class="example">
        {reading} {context}
      </p>
    ),
  })
  const page = { hour12: false }

  /** Lets the source's cache check and fetch finish. */
  const settleSource = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

  it('draws the View with the reading and what the source carried once it has one', async () => {
    const fetch = vi.fn(() => Promise.resolve(7))
    const definition = example(() => ({ fetch, key: 'k' }))
    const { container } = render(<WidgetHost definition={definition} options={{}} page={page} />)
    expect(container.children).toHaveLength(0)

    await settleSource()

    expect(container.querySelector('.example')?.textContent).toBe('7 context a')
    expect(container.children).toHaveLength(1)
  })

  it('draws nothing while there is no query to load', async () => {
    const { container } = render(
      <WidgetHost definition={example(() => null)} options={{}} page={page} />,
    )
    await settleSource()
    expect(container.children).toHaveLength(0)
  })

  it('draws nothing when the source has no reading, because the fetch failed', async () => {
    const fetch = vi.fn(() => Promise.resolve(null))
    const { container } = render(
      <WidgetHost definition={example(() => ({ fetch, key: 'k' }))} options={{}} page={page} />,
    )
    await settleSource()
    expect(fetch).toHaveBeenCalled()
    expect(container.children).toHaveLength(0)
  })

  it('builds the query from the options as the definition reads them', async () => {
    const seen: string[] = []
    render(
      <WidgetHost
        definition={example(() => null, undefined, seen)}
        options={{ name: 'not a choice' }}
        page={page}
      />,
    )
    await settleSource()
    expect(seen).toEqual(['a'])
  })

  it('does not run the source until every need is met', async () => {
    let answer!: (met: boolean) => void
    const fetch = vi.fn(() => Promise.resolve(7))
    const seen: string[] = []
    const definition = example(
      () => ({ fetch, key: 'k' }),
      [
        { id: 'a', met: () => true },
        { id: 'b', met: () => new Promise<boolean>((resolve) => (answer = resolve)) },
      ],
      seen,
    )
    const { container } = render(<WidgetHost definition={definition} options={{}} page={page} />)
    await settleSource()
    expect(seen).toEqual([])
    expect(fetch).not.toHaveBeenCalled()

    await settle(() => answer(true))
    await settleSource()

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.example')?.textContent).toBe('7 context a')
  })

  it('never runs the source while a need is unmet', async () => {
    const fetch = vi.fn(() => Promise.resolve(7))
    const seen: string[] = []
    const { container } = render(
      <WidgetHost
        definition={example(() => ({ fetch, key: 'k' }), [{ id: 'a', met: () => false }], seen)}
        options={{}}
        page={page}
      />,
    )
    await settleSource()
    expect(seen).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
    expect(container.children).toHaveLength(0)
  })

  it('shows a reading the source has cached without fetching', async () => {
    const cached: Reading<number> = { data: 3, fetchedAt: Date.now() }
    const fetch = vi.fn(() => Promise.resolve(7))
    const cachedSource: Source<number> = {
      ...source,
      cache: { get: () => Promise.resolve(cached), set: () => Promise.resolve() },
    }
    const { container } = render(
      <WidgetHost
        definition={example(() => ({ fetch, key: 'k' }), undefined, [], cachedSource)}
        options={{}}
        page={page}
      />,
    )
    await settleSource()
    expect(container.querySelector('.example')?.textContent).toBe('3 context a')
    expect(fetch).not.toHaveBeenCalled()
  })
})
