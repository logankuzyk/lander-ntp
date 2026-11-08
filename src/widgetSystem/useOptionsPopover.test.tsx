import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'
import { checkLayout } from '@/layout/check'
import type { Layout } from '@/layout/types'

import { OptionsPopoverProvider, useOptionsPopover } from './useOptionsPopover'

// The form is what turns a person's change into `onChange`; here it is a stand-in with a button
// for each way of calling it, so the provider's own rules (what is committed, and when) are seen
// without a control that would never make that call (none calls `onChange` with what is stored).
vi.mock('./OptionsForm', async () => {
  const { h } = await import('preact')
  const { useState } = await import('preact/hooks')
  return {
    OptionsForm: ({
      onChange,
      options,
    }: {
      onChange: (options: Record<string, unknown>) => boolean | Promise<boolean> | void
      options: Record<string, unknown>
    }) => {
      const [outcome, setOutcome] = useState('pending')
      return h(
        'div',
        null,
        h('button', { onClick: () => onChange({ ...options }), type: 'button' }, 'same'),
        h(
          'button',
          { onClick: () => onChange({ ...options, showDate: true }), type: 'button' },
          'date',
        ),
        h(
          'button',
          {
            onClick: () => {
              // Two changes in one task, before the page has drawn the first: each names only
              // the option it changes, and the second must still find the first in the Layout.
              onChange({ showDate: true })
              onChange({ showSeconds: true })
            },
            type: 'button',
          },
          'both',
        ),
        h(
          'button',
          {
            onClick: async () => setOutcome(String(await onChange({ ...options, showDate: true }))),
            type: 'button',
          },
          'outcome',
        ),
        h('output', null, outcome),
      )
    },
  }
})

const clock = (id: string, col: number, row = 4) => ({
  col,
  h: 2,
  id,
  options: { showDate: false, showSeconds: false },
  row,
  type: 'clock',
  w: 4,
})

const layoutOf = (...ids: [string, number][]): Layout =>
  checkLayout({ v: 1, widgets: ids.map(([id, col]) => clock(id, col)) })

const ONE = layoutOf(['clock0aa', 5])
const NONE = layoutOf()

type HarnessProps = {
  canChange?: boolean
  commit?: (next: Layout) => Promise<string> | void
  layout?: Layout
  loaded?: boolean
  onOpen?: () => void
  otherOpen?: boolean
}

/** What a Widget's box, the Edit button and a setup button would call. */
function Callers() {
  const { open } = useOptionsPopover()
  const { enter, leave } = useEditMode()
  return (
    <>
      <button onClick={() => open('clock0aa')} type="button">
        open
      </button>
      <button onClick={enter} type="button">
        enter
      </button>
      <button onClick={leave} type="button">
        leave
      </button>
    </>
  )
}

const harness = ({
  canChange = true,
  commit = () => {},
  layout = ONE,
  loaded = true,
  onOpen = () => {},
  otherOpen = false,
}: HarnessProps = {}) => (
  <EditModeProvider canChange={canChange}>
    <OptionsPopoverProvider
      commit={commit}
      layout={layout}
      loaded={loaded}
      onOpen={onOpen}
      onPageValueChange={() => {}}
      otherOpen={otherOpen}
      page={{ hour12: false }}
    >
      <Callers />
    </OptionsPopoverProvider>
  </EditModeProvider>
)

const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const isOpen = () => screen.queryByRole('dialog') !== null

describe('OptionsPopoverProvider', () => {
  describe('what a change commits', () => {
    it('commits the Layout with the change made, once', () => {
      const commit = vi.fn()
      render(harness({ commit }))
      press('open')

      press('date')

      expect(commit).toHaveBeenCalledTimes(1)
      const [next] = commit.mock.calls[0] as [Layout]
      const [widget] = next.widgets
      expect(widget?.kind === 'known' && widget.placed.options).toEqual({
        showDate: true,
        showSeconds: false,
      })
    })

    it('commits nothing for a change that leaves the options as they are', () => {
      const commit = vi.fn()
      render(harness({ commit }))
      press('open')

      press('same')

      expect(commit).not.toHaveBeenCalled()
    })

    it('commits nothing before the stored Layout has arrived', () => {
      const commit = vi.fn()
      render(harness({ commit, loaded: false }))
      press('open')

      press('date')

      expect(commit).not.toHaveBeenCalled()
    })

    it('commits nothing while the Layout may not be changed', () => {
      const commit = vi.fn()
      render(harness({ canChange: false, commit }))
      press('open')

      press('date')

      expect(commit).not.toHaveBeenCalled()
    })

    it('starts each change from the Layout the last one committed, even before the page has drawn it', () => {
      const commit = vi.fn()
      render(harness({ commit }))
      press('open')

      press('both')

      expect(commit).toHaveBeenCalledTimes(2)
      const [last] = commit.mock.calls[1] as [Layout]
      const [widget] = last.widgets
      expect(widget?.kind === 'known' && widget.placed.options).toEqual({
        showDate: true,
        showSeconds: true,
      })
    })

    it('treats a superseded Layout save as applied by the newer queued save', async () => {
      const commit = vi.fn(async () => 'superseded')
      render(harness({ commit }))
      press('open')

      press('outcome')

      expect(await screen.findByText('true')).toBeTruthy()
      expect(commit).toHaveBeenCalledOnce()
    })
  })

  describe('what keeps it open', () => {
    it('stays open when edit mode starts and ends, if it was opened outside it', () => {
      render(harness())
      press('open')

      press('enter')
      press('leave')

      expect(isOpen()).toBe(true)
    })

    it('closes when edit mode ends, if it was opened in it', () => {
      render(harness())
      press('enter')
      press('open')
      expect(isOpen()).toBe(true)

      press('leave')

      expect(isOpen()).toBe(false)
    })

    it('says the page it is opening, so that what it must not be open with can close', () => {
      const onOpen = vi.fn()
      render(harness({ onOpen }))

      press('open')

      expect(onOpen).toHaveBeenCalledTimes(1)
    })

    it('closes when something else takes the corner', () => {
      const { rerender } = render(harness())
      press('open')

      rerender(harness({ otherOpen: true }))

      expect(isOpen()).toBe(false)
    })

    it('closes when its Widget is gone, and does not open again if the Widget comes back', () => {
      const { rerender } = render(harness())
      press('open')
      expect(isOpen()).toBe(true)

      // Removed on another device, then put back there (an undo): nobody asked for it to open.
      rerender(harness({ layout: NONE }))
      expect(isOpen()).toBe(false)
      rerender(harness({ layout: ONE }))

      expect(isOpen()).toBe(false)
    })
  })
})
