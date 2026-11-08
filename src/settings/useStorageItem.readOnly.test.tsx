import { act, render, waitFor } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { NewerVersionError } from '@/storage/guard'

import { type StorageItemLike, useStorageItem } from './useStorageItem'

/** A number in storage that may have been written by a newer version, as a guarded item reads it. */
function guardedItem(stored = { newer: false, value: 5 }) {
  const written: number[] = []
  const watchers = new Set<(value: number | null, newer?: boolean) => void>()
  let refuse: Error | null = null
  const item: StorageItemLike<number> = {
    fallback: 0,
    getValue: async () => stored.value,
    read: async () => stored,
    setValue: async (value) => {
      written.push(value)
      if (refuse) throw refuse
    },
    watch: (callback) => {
      watchers.add(callback)
      return () => watchers.delete(callback)
    },
  }
  return {
    /** What arrives from another tab or device. */
    arrive: (value: number, newer: boolean) => {
      stored = { newer, value }
      watchers.forEach((notify) => notify(value, newer))
    },
    item,
    /** From now on, a write fails with `error`; a newer value has arrived since the read. */
    refuseWith: (error: Error, now: { newer: boolean; value: number }) => {
      refuse = error
      stored = now
    },
    written,
  }
}

function mount(item: StorageItemLike<number>, onRejected?: () => void) {
  const api = { update: (_: number) => {} }
  function Counter() {
    const [value, update, loaded, readOnly] = useStorageItem(item, { onRejected })
    api.update = update
    return <output data-read-only={String(readOnly)}>{loaded ? String(value) : 'loading'}</output>
  }
  const { container } = render(<Counter />)
  const output = () => container.querySelector('output')
  return {
    readOnly: () => output()?.getAttribute('data-read-only'),
    shown: () => output()?.textContent,
    update: (value: number) => act(() => api.update(value)),
  }
}

describe('useStorageItem, read-only', () => {
  it('is not read-only for an item that is not newer', async () => {
    const { item } = guardedItem()
    const page = mount(item)

    await waitFor(() => expect(page.shown()).toBe('5'))
    expect(page.readOnly()).toBe('false')
  })

  it('is not read-only for an item with no way to tell', async () => {
    const { fallback, getValue, setValue, watch } = guardedItem().item
    const page = mount({ fallback, getValue, setValue, watch })

    await waitFor(() => expect(page.shown()).toBe('5'))
    expect(page.readOnly()).toBe('false')
  })

  it('is read-only when what is stored is newer, and shows it', async () => {
    const { item } = guardedItem({ newer: true, value: 7 })
    const page = mount(item)

    await waitFor(() => expect(page.shown()).toBe('7'))
    expect(page.readOnly()).toBe('true')
  })

  it('follows a newer version arriving, and going', async () => {
    const { arrive, item } = guardedItem()
    const page = mount(item)
    await waitFor(() => expect(page.shown()).toBe('5'))

    act(() => arrive(8, true))
    expect(page.readOnly()).toBe('true')
    expect(page.shown()).toBe('8')

    act(() => arrive(9, false))
    expect(page.readOnly()).toBe('false')
  })

  it('changes nothing and writes nothing while read-only', async () => {
    const { item, written } = guardedItem({ newer: true, value: 7 })
    const onRejected = vi.fn()
    const page = mount(item, onRejected)
    await waitFor(() => expect(page.shown()).toBe('7'))

    page.update(1)
    await act(async () => {})

    expect(page.shown()).toBe('7')
    expect(written).toEqual([])
    expect(onRejected).not.toHaveBeenCalled()
  })

  it('goes read-only, puts back the newer value and does not call it a failure when the write is refused', async () => {
    const { item, refuseWith, written } = guardedItem()
    const onRejected = vi.fn()
    const page = mount(item, onRejected)
    await waitFor(() => expect(page.shown()).toBe('5'))

    // A newer version syncs in after the page read, before it writes.
    refuseWith(new NewerVersionError('sync:test'), { newer: true, value: 11 })
    page.update(9)
    expect(page.shown()).toBe('9')

    await waitFor(() => expect(page.shown()).toBe('11'))
    expect(page.readOnly()).toBe('true')
    expect(written).toEqual([9])
    expect(onRejected).not.toHaveBeenCalled()
  })

  it('still counts any other failure as one, and stays writable', async () => {
    const { item, refuseWith } = guardedItem()
    const onRejected = vi.fn()
    const page = mount(item, onRejected)
    await waitFor(() => expect(page.shown()).toBe('5'))

    refuseWith(new Error('QUOTA_BYTES_PER_ITEM'), { newer: false, value: 5 })
    page.update(9)

    await waitFor(() => expect(onRejected).toHaveBeenCalledTimes(1))
    expect(page.readOnly()).toBe('false')
  })
})
