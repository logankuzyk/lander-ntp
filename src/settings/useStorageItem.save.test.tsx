import { act, render, waitFor } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { type StorageItemLike, type StorageItemOptions, useStorageItem } from './useStorageItem'

/** A number in storage whose writes (and, when asked, reads) the test settles by hand. */
function fakeItem(stored = 0) {
  const written: number[] = []
  const settlers: { reject: (reason: Error) => void; resolve: () => void }[] = []
  const watchers = new Set<(value: number | null) => void>()
  let reads: 'fail' | 'held' | 'open' = 'open'
  let release: () => void = () => {}
  let held = Promise.resolve()
  const item: StorageItemLike<number> = {
    fallback: 0,
    getValue: async () => {
      if (reads === 'fail') throw new Error('cannot read')
      await held
      return stored
    },
    setValue: (value) => {
      written.push(value)
      return new Promise<void>((resolve, reject) => settlers.push({ reject, resolve }))
    },
    watch: (callback) => {
      watchers.add(callback)
      return () => watchers.delete(callback)
    },
  }
  return {
    /** Writes `value` to storage as an accepted save would, and tells everything watching. */
    commit: (value: number) => {
      stored = value
      watchers.forEach((notify) => notify(value))
    },
    /** From now on, reads throw. */
    failReads: () => (reads = 'fail'),
    /** From now on, reads wait until `release()`. */
    holdReads: () => {
      reads = 'held'
      held = new Promise<void>((resolve) => (release = resolve))
      return () => release()
    },
    item,
    settlers,
    /** What storage holds, as a rejected write leaves it (nothing is told). */
    store: (value: number) => (stored = value),
    written,
  }
}

/** Shows the value, and hands the test its `update`. */
function mount(item: StorageItemLike<number>, handlers?: StorageItemOptions) {
  const api = { update: (_: number) => {} }
  function Counter({ options }: { options?: StorageItemOptions }) {
    const [value, update, loaded] = useStorageItem(item, options)
    api.update = update
    return <output>{loaded ? String(value) : 'loading'}</output>
  }
  const { container, rerender } = render(<Counter options={handlers} />)
  return {
    /** The same hook again with other handlers, as `App` does on each render. */
    rerender: (next: StorageItemOptions) => rerender(<Counter options={next} />),
    shown: () => container.querySelector('output')?.textContent,
    update: (value: number) => act(() => api.update(value)),
  }
}

/** Lets anything already on its way arrive. */
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

describe('useStorageItem, saving', () => {
  it('sets the state at once and writes twenty quick updates as two writes, the last with the final value', async () => {
    const { item, settlers, written } = fakeItem()
    const page = mount(item)
    await waitFor(() => expect(page.shown()).toBe('0'))

    for (let i = 1; i <= 20; i++) page.update(i)

    expect(page.shown()).toBe('20')
    expect(written).toEqual([1])

    await act(async () => settlers[0]?.resolve())
    expect(written).toEqual([1, 20])
    await act(async () => settlers[1]?.resolve())
    expect(page.shown()).toBe('20')
  })

  it('puts back the stored value and says so when the write is rejected', async () => {
    const { item, settlers, store } = fakeItem(5)
    const onRejected = vi.fn()
    const page = mount(item, { onRejected })
    await waitFor(() => expect(page.shown()).toBe('5'))

    page.update(9)
    expect(page.shown()).toBe('9')
    store(5)
    await act(async () => settlers[0]?.reject(new Error('quota')))

    await waitFor(() => expect(page.shown()).toBe('5'))
    expect(onRejected).toHaveBeenCalledTimes(1)
  })

  it('still saves the next change after one was rejected', async () => {
    const { item, settlers, written } = fakeItem(5)
    const page = mount(item, { onRejected: () => {} })
    await waitFor(() => expect(page.shown()).toBe('5'))

    page.update(9)
    await act(async () => settlers[0]?.reject(new Error('quota')))
    await waitFor(() => expect(page.shown()).toBe('5'))
    page.update(7)

    expect(written).toEqual([9, 7])
    expect(page.shown()).toBe('7')
  })

  it('does not put back a value that a newer change has replaced', async () => {
    const { item, settlers, written } = fakeItem(5)
    const onRejected = vi.fn()
    const page = mount(item, { onRejected })
    await waitFor(() => expect(page.shown()).toBe('5'))

    page.update(9)
    page.update(7)
    await act(async () => settlers[0]?.reject(new Error('quota')))

    // The change behind it is on its way to storage: the state stays on it.
    expect(page.shown()).toBe('7')
    expect(written).toEqual([9, 7])
    await waitFor(() => expect(onRejected).toHaveBeenCalledTimes(1))
    expect(page.shown()).toBe('7')
  })

  it('reports one rejection, and stays on the latest value, when the first of three updates is rejected', async () => {
    const { item, settlers, store, written } = fakeItem(5)
    const onRejected = vi.fn()
    const page = mount(item, { onRejected })
    await waitFor(() => expect(page.shown()).toBe('5'))

    page.update(1)
    page.update(2)
    page.update(3)
    store(5)
    await act(async () => settlers[0]?.reject(new Error('quota')))
    await act(async () => settlers[1]?.resolve())
    await tick()

    // The second change never reached storage, and that is no rejection.
    expect(written).toEqual([1, 3])
    expect(onRejected).toHaveBeenCalledTimes(1)
    expect(page.shown()).toBe('3')
  })

  it('says when a change is saved', async () => {
    const { item, settlers } = fakeItem()
    const onSaved = vi.fn()
    const page = mount(item, { onSaved })
    await waitFor(() => expect(page.shown()).toBe('0'))

    page.update(1)
    expect(onSaved).not.toHaveBeenCalled()
    await act(async () => settlers[0]?.resolve())

    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('does not say saved for a rejected change, or for one that a newer change replaced', async () => {
    const { item, settlers } = fakeItem()
    const onSaved = vi.fn()
    const page = mount(item, { onSaved })
    await waitFor(() => expect(page.shown()).toBe('0'))

    page.update(1)
    page.update(2)
    page.update(3)
    await act(async () => settlers[0]?.reject(new Error('quota')))
    expect(onSaved).not.toHaveBeenCalled()
    await act(async () => settlers[1]?.resolve())

    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('reports a rejection without waiting to read the stored value, so a later save can clear it', async () => {
    const { holdReads, item, settlers } = fakeItem(5)
    const events: string[] = []
    const page = mount(item, {
      onRejected: () => events.push('rejected'),
      onSaved: () => events.push('saved'),
    })
    await waitFor(() => expect(page.shown()).toBe('5'))
    const release = holdReads()

    page.update(1)
    page.update(2)
    await act(async () => settlers[0]?.reject(new Error('quota')))
    await act(async () => settlers[1]?.resolve())
    release()
    await tick()

    // The newer change went through after the rejected one, so the last word is "saved".
    expect(events).toEqual(['rejected', 'saved'])
  })

  it('still reports the rejection, and leaves what is shown, when the stored value cannot be read', async () => {
    const { failReads, item, settlers } = fakeItem(5)
    const onRejected = vi.fn()
    const page = mount(item, { onRejected })
    await waitFor(() => expect(page.shown()).toBe('5'))
    failReads()

    page.update(9)
    await act(async () => settlers[0]?.reject(new Error('quota')))
    await tick()

    expect(onRejected).toHaveBeenCalledTimes(1)
    expect(page.shown()).toBe('9')
  })

  it('answers with the handlers it has at the end of the save, not the start', async () => {
    const { item, settlers } = fakeItem(5)
    const before = vi.fn()
    const after = vi.fn()
    const page = mount(item, { onRejected: before })
    await waitFor(() => expect(page.shown()).toBe('5'))

    page.update(9)
    page.rerender({ onRejected: after })
    await act(async () => settlers[0]?.reject(new Error('quota')))
    await tick()

    expect(before).not.toHaveBeenCalled()
    expect(after).toHaveBeenCalledTimes(1)
  })

  describe('with two hooks on one item', () => {
    it('writes one change at a time between them', async () => {
      const { item, settlers, written } = fakeItem()
      const a = mount(item)
      const b = mount(item)
      await waitFor(() => expect(a.shown()).toBe('0'))

      a.update(9)
      b.update(7)

      expect(written).toEqual([9])
      await act(async () => settlers[0]?.resolve())
      expect(written).toEqual([9, 7])
    })

    it('does not put either back to a value that a change from the other has replaced', async () => {
      const { commit, item, settlers, store } = fakeItem(5)
      const a = mount(item, { onRejected: () => {} })
      const b = mount(item, { onRejected: () => {} })
      await waitFor(() => expect(a.shown()).toBe('5'))
      await waitFor(() => expect(b.shown()).toBe('5'))

      a.update(9)
      b.update(7)
      store(5)
      await act(async () => settlers[0]?.reject(new Error('quota')))
      await tick()

      // The stored 5 is out of date the moment the 7 is on its way.
      expect(a.shown()).not.toBe('5')
      expect(b.shown()).toBe('7')

      await act(async () => {
        settlers[1]?.resolve()
        commit(7)
      })
      await tick()
      expect(a.shown()).toBe('7')
      expect(b.shown()).toBe('7')
    })
  })
})
