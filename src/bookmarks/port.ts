import { browser } from 'wxt/browser'

import { bookmarkItems, flattenFolders, resolveFolder } from './tree'
import type { BookmarkFolderChoice, BookmarkNode, BookmarksPort } from './types'

const PERMISSION: Parameters<typeof browser.permissions.contains>[0] = {
  permissions: ['bookmarks'],
}

/** The sole boundary around the optional Bookmarks permission and browser APIs. */
export const bookmarksPort: BookmarksPort = {
  contains: async () => (await browser.permissions.contains(PERMISSION)) as unknown as boolean,
  folders: async () => {
    if (!(await browser.permissions.contains(PERMISSION))) return []
    const api = browser.bookmarks
    const tree = (await api.getTree()) as unknown as BookmarkNode[]
    return flattenFolders(tree[0]?.children ?? [])
  },
  isSupported: () => typeof browser.permissions?.contains === 'function',
  read: async (choice: BookmarkFolderChoice) => {
    if (!(await browser.permissions.contains(PERMISSION))) return { need: 'folder' }
    const api = browser.bookmarks
    const tree = (await api.getTree()) as unknown as BookmarkNode[]
    const folder = resolveFolder(tree[0]?.children ?? [], choice)
    if (!folder) return { need: 'folder' }
    const nodes = (await api.getSubTree(folder.id)) as unknown as BookmarkNode[]
    const current = nodes.find((node) => node.id === folder.id)
    return current
      ? { folderTitle: current.title, items: bookmarkItems(current) }
      : { need: 'folder' }
  },
  request: async () => (await browser.permissions.request(PERMISSION)) as unknown as boolean,
  watch: (onChange) => {
    let active = true
    let granted = false
    let importing = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const notify = () => {
      if (!active || importing) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (active) onChange()
      }, 100)
    }
    let detachBookmarkListeners: (() => void)[] = []
    const addListener = (event: unknown, listener: () => void) => {
      const typed = event as {
        addListener: (callback: () => void) => void
        removeListener: (callback: () => void) => void
      }
      typed.addListener(listener)
      detachBookmarkListeners.push(() => typed.removeListener(listener))
    }
    const addBookmarkListeners = () => {
      const api = browser.bookmarks
      const apiEvents = [
        api.onCreated,
        api.onRemoved,
        api.onChanged,
        api.onMoved,
        api.onChildrenReordered,
      ]
      apiEvents.forEach((event) => addListener(event, notify))
      addListener(api.onImportBegan, began)
      addListener(api.onImportEnded, ended)
    }
    const removeBookmarkListeners = () => {
      detachBookmarkListeners.forEach((detach) => detach())
      detachBookmarkListeners = []
    }
    const check = async () => {
      const next = (await browser.permissions.contains(PERMISSION)) as unknown as boolean
      if (!active || next === granted) return
      granted = next
      if (granted) addBookmarkListeners()
      else removeBookmarkListeners()
      notify()
    }
    const visibility = () => {
      if (!document.hidden) void check()
    }
    const added = () => void check()
    const removed = () => void check()
    const began = () => {
      importing = true
      clearTimeout(timer)
    }
    const ended = () => {
      importing = false
      notify()
    }
    browser.permissions.onAdded.addListener(added)
    browser.permissions.onRemoved.addListener(removed)
    document.addEventListener('visibilitychange', visibility)
    void check()
    return () => {
      active = false
      clearTimeout(timer)
      removeBookmarkListeners()
      browser.permissions.onAdded.removeListener(added)
      browser.permissions.onRemoved.removeListener(removed)
      document.removeEventListener('visibilitychange', visibility)
    }
  },
}
