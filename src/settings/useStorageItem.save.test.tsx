import { act, render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { type StorageItemLike, useStorageItem } from './useStorageItem'

/** A number in storage whose writes the test settles by hand. */
function fakeItem(stored = 0) {
  const written: number[] = []
  const settlers: { reject: (reason: Error) => void; resolve: () => void }[] = []
  const item: StorageItemLike<number> = {
    fallback: 0,
    getValue: async () => stored,
    setValue: (value) => {
      written.push(value)
      return new Promise<void>((resolve, reject) => settlers.push({ reject, resolve }))
    },
    watch: () => () => {},
  }
  /** What storage holds, as a rejected write leaves it. */
  const store = (value: number) => (stored = value)
  return { item, settlers, store, written }
}

type Handlers = { onRejected?: () => void; onSaved?: () => void }

/** Shows the value, and hands the test its `update`. */
function mount(item: StorageItemLike<number>, handlers?: Handlers) {
  const api = { update: (_: number) => {} }
  function Counter() {
    const [value, update, loaded] = useStorageItem(item, handlers)
    api.update = update
    return <output>{loaded ? String(value) : 'loading'}</output>
  }
  render(<Counter />)
  return {
    shown: () => screen.getByRole('status').textContent,
    update: (value: number) => act(() => api.update(value)),
  }
}

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
})
