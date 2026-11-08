import { afterEach, describe, expect, it, vi } from 'vitest'

import { createBookmarksPort } from './createPort'
import { createFakeBookmarksPort } from './fake'
import { bookmarksSource } from './source'
import type { BookmarkNode } from './types'

describe('bookmarksSource', () => {
  afterEach(() => vi.useRealTimers())

  it('turns a folder tree into safe bookmark items and flattened folder choices', async () => {
    const port = createFakeBookmarksPort({
      granted: true,
      tree: [
        {
          children: [
            {
              children: [
                { id: 'a', title: 'A', url: 'https://example.com/a' },
                { id: 'script', title: 'Script', url: 'javascript:alert(1)' },
                { id: 'local-file', title: 'File', url: 'file:///private/notes.txt' },
                { id: 'browser-page', title: 'Browser page', url: 'chrome://settings' },
                { id: 'data', title: 'Data', url: 'data:text/plain,hello' },
                {
                  children: [
                    { id: 'inside', title: 'Nested bookmark', url: 'https://example.com/inside' },
                  ],
                  id: 'nested',
                  title: 'Nested',
                },
                { id: 'separator', title: '', type: 'separator' },
              ],
              id: 'folder',
              title: 'Reading',
            },
          ],
          id: 'root',
          title: '',
        },
      ],
    })

    await expect(
      bookmarksSource(port).read({ folder: { id: 'folder', title: 'Reading' } }),
    ).resolves.toEqual({
      folderTitle: 'Reading',
      items: [{ id: 'a', title: 'A', url: 'https://example.com/a' }],
    })
    await expect(port.folders()).resolves.toEqual([{ depth: 1, id: 'nested', title: 'Nested' }])
  })

  it('asks to choose a folder when its id or recorded title is no longer on this device', async () => {
    const port = createFakeBookmarksPort({
      granted: true,
      tree: [
        { children: [{ children: [], id: 'folder', title: 'Renamed' }], id: 'root', title: '' },
      ],
    })
    const source = bookmarksSource(port)

    await expect(source.read({ folder: { id: 'missing', title: 'Old' } })).resolves.toMatchObject({
      name: 'folder',
    })
    await expect(source.read({ folder: { id: 'folder', title: 'Old' } })).resolves.toMatchObject({
      name: 'folder',
    })
  })

  it('reads a saved folder choice encoded with its portable id and title', async () => {
    const port = createFakeBookmarksPort({
      granted: true,
      tree: [
        {
          children: [{ children: [], id: 'reading-id', title: 'Reading' }],
          id: 'root',
          title: '',
        },
      ],
    })

    await expect(
      bookmarksSource(port).read({
        folder: JSON.stringify({ id: 'reading-id', title: 'Reading' }),
      }),
    ).resolves.toEqual({ folderTitle: 'Reading', items: [] })
  })

  it('does not try to read bookmarks until the permission is granted', async () => {
    const port = createFakeBookmarksPort({ granted: false })
    const read = vi.spyOn(port, 'read')

    await expect(bookmarksSource(port).read({ folder: 'bar' })).resolves.toMatchObject({
      name: 'permission',
    })
    expect(read).not.toHaveBeenCalled()
  })

  it('gets folder choices from the granted browser tree', async () => {
    const nodes: BookmarkNode[] = [
      {
        children: [
          {
            children: [{ children: [], id: 'saved', title: 'Saved' }],
            folderType: 'bookmarks-bar',
            id: 'bar',
            title: 'Toolbar',
          },
        ],
        id: 'root',
        title: '',
      },
    ]
    const event = { addListener: vi.fn(), removeListener: vi.fn() }
    const permissions = {
      contains: vi.fn(async () => true),
      onAdded: event,
      onRemoved: event,
      request: vi.fn(async () => true),
    }
    const bookmarks = {
      getSubTree: vi.fn(
        async (id: string) => nodes[0]?.children?.filter((node) => node.id === id) ?? [],
      ),
      getTree: vi.fn(async () => nodes),
      onChanged: event,
      onChildrenReordered: event,
      onCreated: event,
      onImportBegan: event,
      onImportEnded: event,
      onMoved: event,
      onRemoved: event,
    }
    const port = createBookmarksPort({ bookmarks: () => bookmarks, permissions })

    await expect(port.folders()).resolves.toEqual([{ depth: 1, id: 'saved', title: 'Saved' }])
    expect(bookmarks.getTree).toHaveBeenCalledTimes(1)
  })

  it('does not claim support when the permission API is unavailable', () => {
    const event = { addListener: vi.fn(), removeListener: vi.fn() }
    const bookmarks = vi.fn(() => {
      throw new Error('bookmarks API must stay untouched')
    })
    const port = createBookmarksPort({
      bookmarks,
      permissions: { onAdded: event, onRemoved: event },
    })

    expect(port.isSupported()).toBe(false)
    expect(bookmarks).not.toHaveBeenCalled()
  })

  it.each([
    [
      'a role-marked bar',
      [{ children: [], folderType: 'bookmarks-bar', id: 'bar-guid', title: 'Toolbar' }],
    ],
    ['a Chromium tree without role metadata', [{ children: [], id: '1', title: 'Bookmarks bar' }]],
    [
      'a Firefox tree with a toolbar GUID',
      [{ children: [], id: 'toolbar_____', title: 'Bookmarks Toolbar' }],
    ],
  ])('resolves the default bar in %s', async (_, folders) => {
    const port = createFakeBookmarksPort({
      granted: true,
      tree: [{ children: folders, id: 'root', title: '' }],
    })

    await expect(port.read('bar')).resolves.toMatchObject({ folderTitle: folders[0]?.title })
  })

  it('watches only granted bookmarks and combines a burst of changes', async () => {
    vi.useFakeTimers()
    const port = createFakeBookmarksPort({ granted: false })
    const changed = vi.fn()
    port.watch(changed)
    port.change()
    await vi.advanceTimersByTimeAsync(200)
    expect(changed).not.toHaveBeenCalled()

    await port.request()
    for (let index = 0; index < 50; index += 1) port.change()
    await vi.advanceTimersByTimeAsync(100)
    expect(changed).toHaveBeenCalledTimes(1)

    port.revoke()
    for (let index = 0; index < 50; index += 1) port.change()
    await vi.advanceTimersByTimeAsync(100)
    expect(changed).toHaveBeenCalledTimes(2)
  })

  it('reports unsupported browsers without granting or reading bookmarks', async () => {
    const port = createFakeBookmarksPort({ supported: false })

    expect(port.isSupported()).toBe(false)
    await expect(port.contains()).resolves.toBe(false)
    await expect(port.request()).resolves.toBe(false)
    await expect(port.folders()).resolves.toEqual([])
  })
})
