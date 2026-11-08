import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDirectoryObjectStore, createR2ObjectStore } from './objectStore.js'

const directories: string[] = []

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true })
})

describe('directory object store', () => {
  it('round-trips bytes, lists keys, and deletes an object', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'lander-objects-'))
    directories.push(directory)
    const store = createDirectoryObjectStore(directory)

    await store.put('dumps/one.db.gz', new Uint8Array([1, 2, 3]))
    await store.put('deleted-ids.json', new TextEncoder().encode('[]'))
    await store.put('other/dumps/two.db.gz', new Uint8Array([4]))

    expect(await store.get('dumps/one.db.gz')).toEqual(new Uint8Array([1, 2, 3]))
    expect((await store.list('dumps/')).map((object) => object.key)).toEqual(['dumps/one.db.gz'])
    await store.delete('dumps/one.db.gz')
    expect(await store.get('dumps/one.db.gz')).toBeUndefined()
  })

  it('refuses object keys that escape the configured directory', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'lander-objects-'))
    directories.push(directory)
    const store = createDirectoryObjectStore(join(directory, 'objects'))

    await expect(store.put('../outside', new Uint8Array([1]))).rejects.toThrow(/Invalid object key/)
    await expect(store.get('../outside')).rejects.toThrow(/Invalid object key/)
    await expect(store.delete('../outside')).rejects.toThrow(/Invalid object key/)
  })
})

describe('R2 object store', () => {
  it('aborts a stalled fetch after its request timeout', async () => {
    const requestSignal: { value: AbortSignal | null } = { value: null }
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal.value = init?.signal ?? (_input instanceof Request ? _input.signal : null)
      return new Promise<Response>((_resolve, reject) => {
        if (requestSignal.value?.aborted) {
          reject(requestSignal.value.reason)
          return
        }
        requestSignal.value?.addEventListener('abort', () => reject(requestSignal.value?.reason), {
          once: true,
        })
      })
    })
    vi.stubGlobal('fetch', fetcher)
    const store = createR2ObjectStore(
      {
        accessKeyId: 'fake-access-key',
        accountId: 'fake-account',
        bucket: 'fake-bucket',
        secretAccessKey: 'fake-secret-key',
      },
      10,
    )
    const pending = store.put('deleted-ids.json', new TextEncoder().encode('[]'))
    const aborted = await Promise.race([
      pending.then(
        () => false,
        () => true,
      ),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 100)),
    ])

    expect(aborted).toBe(true)
    expect(requestSignal.value?.aborted).toBe(true)
  })
})
