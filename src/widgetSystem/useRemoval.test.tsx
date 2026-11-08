import { act, render, screen, waitFor } from '@testing-library/preact'
import { useState } from 'preact/hooks'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

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

/** A Widget of a type this version does not know, and another of that type, and a third kind. */
const future = (id: string, type: string, col: number) => ({
  col,
  h: 2,
  id,
  options: { colour: 'teal' },
  row: 1,
  type,
  w: 2,
})
const WITH_UNKNOWN = checkLayout({
  v: 1,
  widgets: [
    clock,
    future('futr0001', 'bookmarks', 1),
    future('futr0002', 'bookmarks', 3),
    future('futr0003', 'calendar', 7),
  ],
})

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
      <p data-testid="undo-offered">{String(notice?.action !== undefined)}</p>
      <button onClick={() => controls.remove('clock0aa')} type="button">
        remove
      </button>
      {['futr0001', 'futr0002', 'futr0003'].map((id) => (
        <button key={id} onClick={() => controls.remove(id)} type="button">
          remove {id}
        </button>
      ))}
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

  it('takes the notice away, and the Widget it held, when the Layout may not be changed any more', () => {
    const commit = vi.fn()
    const { rerender } = render(<Probe commit={commit} layout={LAYOUT} loaded readOnly={false} />)
    pressRemove()
    expect(screen.getByTestId('notice').textContent).toBe('Clock removed.')

    // A newer version wrote the Layout meanwhile: an Undo that does nothing is not left up.
    rerender(<Probe commit={commit} layout={LAYOUT} loaded readOnly />)

    expect(screen.getByTestId('notice').textContent).toBe('')
    expect(screen.getByTestId('undo-offered').textContent).toBe('false')
    // And it does not come back when the Layout may be changed again: that Undo is gone.
    rerender(<Probe commit={commit} layout={LAYOUT} loaded readOnly={false} />)
    expect(screen.getByTestId('notice').textContent).toBe('')
  })

  it('removes nothing from a Layout that may not be changed', () => {
    const commit = vi.fn()
    render(<Probe commit={commit} layout={LAYOUT} loaded readOnly />)

    pressRemove()

    expect(screen.getByTestId('available').textContent).toBe('false')
    expect(commit).not.toHaveBeenCalled()
  })

  it('says which unknown Widget was removed, by the name its box has, and which could not be put back', () => {
    const commit = vi.fn()
    render(<Probe commit={commit} layout={WITH_UNKNOWN} loaded readOnly={false} />)

    act(() => screen.getByRole('button', { name: 'remove futr0003' }).click())
    expect(screen.getByTestId('notice').textContent).toBe('Unknown widget, calendar removed.')

    // Two of a type are told apart as they are on the page, by their order in the Layout.
    act(() => screen.getByRole('button', { name: 'remove futr0002' }).click())
    expect(screen.getByTestId('notice').textContent).toBe('Unknown widget, bookmarks 2 removed.')
  })
})

const dialLayout = checkLayout({
  v: 1,
  widgets: [
    {
      col: 1,
      h: 1,
      id: 'dial0001',
      options: { icon: 'abcdefgh', label: 'Example', newTab: false, url: 'example.com' },
      row: 1,
      type: 'quick-dial',
      w: 1,
    },
  ],
})

function DialRemovalProbe() {
  const [layout, setLayout] = useState(dialLayout)
  const { controls, notice } = useRemovalController({
    commit: setLayout,
    layout,
    loaded: true,
    readOnly: false,
    saveFailures: 0,
  })
  return (
    <>
      <button onClick={() => controls.remove('dial0001')} type="button">
        Remove dial
      </button>
      <button onClick={() => notice?.action?.onClick()} type="button">
        Undo dial
      </button>
      <button onClick={() => notice?.onDismiss()} type="button">
        Dismiss notice
      </button>
    </>
  )
}

describe('Quick dial icon discard', () => {
  beforeEach(async () => fakeBrowser.storage.sync.clear())

  it('keeps the icon while Undo is available and removes it when the notice is dismissed', async () => {
    await fakeBrowser.storage.sync.set({
      'icon:abcdefgh': { data: 'data:image/webp;base64,YQ==', v: 1 },
    })
    const { unmount } = render(<DialRemovalProbe />)

    act(() => screen.getByRole('button', { name: 'Remove dial' }).click())
    expect(await fakeBrowser.storage.sync.get('icon:abcdefgh')).toHaveProperty('icon:abcdefgh')

    act(() => screen.getByRole('button', { name: 'Undo dial' }).click())
    expect(await fakeBrowser.storage.sync.get('icon:abcdefgh')).toHaveProperty('icon:abcdefgh')
    act(() => screen.getByRole('button', { name: 'Remove dial' }).click())
    act(() => screen.getByRole('button', { name: 'Dismiss notice' }).click())
    await waitFor(async () =>
      expect(await fakeBrowser.storage.sync.get('icon:abcdefgh')).toEqual({}),
    )
    unmount()
  })
})
