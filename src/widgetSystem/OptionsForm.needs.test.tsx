import { act, fireEvent, render, screen, within } from '@testing-library/preact'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { EXAMPLE_SIZES } from '@/test/fixtures'

import type { PageValues, WidgetDefinition } from './definition'
import type { Need } from './needs'
import { OptionsForm } from './OptionsForm'

// An option can depend on a need: until it is met the control is held back, with the need's own
// words and action beside it, so a control that would send something is not used before the
// person has allowed it. An option that depends on nothing is not touched.

const PAGE: PageValues = { hour12: false }

/** Draws the example Widget's form with the needs it is given; the place option depends on `agreed`. */
const example = (
  needs: readonly Need<Record<string, unknown>>[],
): WidgetDefinition<Record<string, unknown>> => ({
  name: 'Example',
  needs,
  options: [
    { control: 'switch', default: true, id: 'flag', label: 'Flag' },
    {
      control: 'place',
      default: { followDevice: false, place: null },
      id: 'place',
      label: 'Place',
      needs: ['agreed'],
    },
  ],
  sizes: EXAMPLE_SIZES,
  type: 'example',
  View: () => null,
})

const draw = (needs: readonly Need<Record<string, unknown>>[]) =>
  render(
    <OptionsForm
      definition={example(needs)}
      onChange={vi.fn()}
      onPageValueChange={vi.fn()}
      options={{}}
      page={PAGE}
    />,
  )

/** A need met once its action has run. */
function agreeing() {
  let agreed = false
  const run = vi.fn(() => {
    agreed = true
    return Promise.resolve()
  })
  const need: Need<Record<string, unknown>> = {
    action: { kind: 'ask', run },
    id: 'agreed',
    label: 'Agree first',
    met: () => agreed,
  }
  return { need, run }
}

const search = () =>
  screen.getByRole('combobox', { name: 'Search for a place' }) as HTMLInputElement
const flag = () => screen.getByRole('switch', { name: 'Flag' }) as HTMLInputElement
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('an option that depends on a need', () => {
  it('is held back while the need is unmet, with the need’s words as a button and a line saying why', () => {
    const { need } = agreeing()
    const { container } = draw([need])

    expect(search().disabled).toBe(true)
    const option = container.querySelector<HTMLElement>('[data-option="place"]')!
    expect(within(option).getByRole('button', { name: 'Agree first' })).toBeTruthy()
    expect(option.textContent).toContain('Do this first to set the place.')
  })

  it('leaves the options that depend on nothing as they were', () => {
    const { need } = agreeing()
    draw([need])

    expect(flag().disabled).toBe(false)
  })

  it('is drawn as it was, with nothing added, when the need is met at once', () => {
    const { container } = draw([{ id: 'agreed', met: () => true }])

    expect(search().disabled).toBe(false)
    expect(container.querySelector('[data-option="place"] button')).toBeNull()
    expect(container.textContent).not.toContain('Do this first')
  })

  it('is held back, with no button yet, while the need is still being looked up, and then given', async () => {
    let answer!: (met: boolean) => void
    const { container } = draw([
      { id: 'agreed', met: () => new Promise<boolean>((resolve) => (answer = resolve)) },
    ])

    expect(search().disabled).toBe(true)
    expect(container.textContent).not.toContain('Do this first')

    await act(async () => {
      answer(true)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(search().disabled).toBe(false)
  })

  it('runs the need’s action as the first thing the button’s click does, then lets the control be used', async () => {
    const { need, run } = agreeing()
    draw([need])

    fireEvent.click(screen.getByRole('button', { name: 'Agree first' }))

    expect(run).toHaveBeenCalledTimes(1)
    await settle()
    expect(search().disabled).toBe(false)
    expect(screen.queryByRole('button', { name: 'Agree first' })).toBeNull()
  })

  it('keeps the control held back when the action leaves the need unmet, and can be pressed again', async () => {
    const run = vi.fn(() => Promise.resolve())
    draw([{ action: { kind: 'ask', run }, id: 'agreed', label: 'Agree first', met: () => false }])

    fireEvent.click(screen.getByRole('button', { name: 'Agree first' }))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Agree first' }))

    expect(run).toHaveBeenCalledTimes(2)
    expect(search().disabled).toBe(true)
  })

  it('has no button, but is still held back, for a need with no words or action', () => {
    draw([{ id: 'agreed', met: () => false }])

    expect(search().disabled).toBe(true)
    expect(screen.queryByRole('button', { name: /agree/i })).toBeNull()
  })

  it('is held back again when a need that was met is not, at the next check', async () => {
    let agreed = true
    draw([
      {
        action: { kind: 'ask', run: vi.fn() },
        id: 'agreed',
        label: 'Agree first',
        met: () => agreed,
      },
    ])
    expect(search().disabled).toBe(false)

    agreed = false
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(search().disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Agree first' })).toBeTruthy()
  })

  it('gives focus to the option’s control when the button goes while it has focus, so the keyboard is not dropped on the page', async () => {
    const { need } = agreeing()
    draw([need])
    const button = screen.getByRole('button', { name: 'Agree first' })
    button.focus()

    fireEvent.click(button)
    await settle()

    expect(screen.queryByRole('button', { name: 'Agree first' })).toBeNull()
    expect(document.activeElement).toBe(search())
  })

  it('leaves focus where it is when the button goes and it was not on the button', async () => {
    const { need } = agreeing()
    draw([need])
    flag().focus()

    fireEvent.click(screen.getByRole('button', { name: 'Agree first' }))
    await settle()

    expect(document.activeElement).toBe(flag())
  })

  it('says why through the control: the line describes the box that is held back', () => {
    const { need } = agreeing()
    const { container } = draw([need])

    const line = [...container.querySelectorAll('p')].find((p) =>
      p.textContent?.startsWith('Do this first'),
    )!
    expect(line.id).not.toBe('')
    expect(search().getAttribute('aria-describedby')).toBe(line.id)
  })

  it('has nothing to describe the box when it is not held back', () => {
    draw([{ id: 'agreed', met: () => true }])

    expect(search().hasAttribute('aria-describedby')).toBe(false)
  })
})
