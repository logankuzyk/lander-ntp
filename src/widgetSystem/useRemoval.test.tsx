import { act, render, screen } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { describe, expect, it, vi } from 'vitest'

import { checkLayout } from '@/layout/check'
import type { Layout } from '@/layout/types'

import { useRemovalController } from './useRemoval'

const clock = {
  col: 5,
  h: 2,
  id: 'clock0aa',
  options: { showDate: false, showSeconds: false },
  row: 4,
  type: 'clock',
  w: 4,
}
const LAYOUT = checkLayout({ v: 1, widgets: [clock] })

/** Draws what the controller says, with a button for each thing it can do. */
function Probe({
  commit,
  layout: first,
  loaded,
  readOnly,
}: {
  commit: (next: Layout) => void
  layout: Layout
  loaded: boolean
  readOnly: boolean
}) {
  // As `useLayout` does: a commit shows at once.
  const [layout, setLayout] = useState(first)
  const { controls, notice } = useRemovalController({
    commit: (next) => {
      setLayout(next)
      commit(next)
    },
    layout,
    loaded,
    readOnly,
    saveFailures: 0,
  })
  return (
    <>
      <p data-testid="available">{String(controls.available)}</p>
      <p data-testid="notice">{notice?.message ?? ''}</p>
      <button onClick={() => controls.remove('clock0aa')} type="button">
        remove
      </button>
      <button onClick={() => notice?.action?.onClick()} type="button">
        undo
      </button>
    </>
  )
}

const pressRemove = () => act(() => screen.getByRole('button', { name: 'remove' }).click())

describe('useRemovalController', () => {
  it('removes a Widget and offers to put it back', () => {
    const commit = vi.fn()
    render(<Probe commit={commit} layout={LAYOUT} loaded readOnly={false} />)

    pressRemove()

    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit.mock.calls[0]?.[0].widgets).toEqual([])
    expect(screen.getByTestId('notice').textContent).toBe('Clock removed.')
  })

  it('removes nothing, and says it cannot, before the stored Layout has arrived', () => {
    const commit = vi.fn()
    render(<Probe commit={commit} layout={LAYOUT} loaded={false} readOnly={false} />)

    pressRemove()

    expect(screen.getByTestId('available').textContent).toBe('false')
    expect(commit).not.toHaveBeenCalled()
    expect(screen.getByTestId('notice').textContent).toBe('')
  })

  it('puts nothing back once the Layout may not be changed, however late Undo is pressed', () => {
    const commit = vi.fn()
    const { rerender } = render(<Probe commit={commit} layout={LAYOUT} loaded readOnly={false} />)
    pressRemove()
    expect(commit).toHaveBeenCalledTimes(1)

    // A newer version wrote the Layout meanwhile.
    rerender(<Probe commit={commit} layout={LAYOUT} loaded readOnly />)
    act(() => screen.getByRole('button', { name: 'undo' }).click())

    expect(commit).toHaveBeenCalledTimes(1)
  })

  it('removes nothing from a Layout that may not be changed', () => {
    const commit = vi.fn()
    render(<Probe commit={commit} layout={LAYOUT} loaded readOnly />)

    pressRemove()

    expect(screen.getByTestId('available').textContent).toBe('false')
    expect(commit).not.toHaveBeenCalled()
  })
})
