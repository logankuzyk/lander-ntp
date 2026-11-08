import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { createDirectoryObjectStore } from './objectStore.js'

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true })
})

describe('directory object store', () => {
  it('round-trips bytes, lists keys, and deletes an object', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'lander-objects-'))
    directories.push(directory)
    const store = createDirectoryObjectStore(directory)

    await store.put('dumps/one.db.gz', new Uint8Array([1, 2, 3]))
    await store.put('deleted-ids.json', new TextEncoder().encode('[]'))

    expect(await store.get('dumps/one.db.gz')).toEqual(new Uint8Array([1, 2, 3]))
    expect((await store.list('dumps/')).map((object) => object.key)).toEqual(['dumps/one.db.gz'])
    await store.delete('dumps/one.db.gz')
    expect(await store.get('dumps/one.db.gz')).toBeUndefined()
  })
})
