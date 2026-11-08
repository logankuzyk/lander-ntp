import { bookmarkItems, flattenFolders, resolveFolder } from './tree'
import type { BookmarkFolderChoice, BookmarkNode, BookmarksPort } from './types'

type BrowserEvent = {
  addListener: (listener: (...args: never[]) => void) => void
  removeListener: (listener: (...args: never[]) => void) => void
}

type BookmarksApi = {
  getSubTree: (id: string) => Promise<BookmarkNode[]>
  getTree: () => Promise<BookmarkNode[]>
  onChanged: BrowserEvent
  onChildrenReordered: BrowserEvent
  onCreated: BrowserEvent
  onImportBegan: BrowserEvent
  onImportEnded: BrowserEvent
  onMoved: BrowserEvent
  onRemoved: BrowserEvent
}

type PermissionDetails = { permissions: string[] }

type PermissionsApi = {
  contains?: (details: PermissionDetails) => Promise<boolean>
  onAdded: BrowserEvent
  onRemoved: BrowserEvent
  request?: (details: PermissionDetails) => Promise<boolean>
}

export type PortApis = { bookmarks: () => BookmarksApi; permissions: PermissionsApi }

const PERMISSION: PermissionDetails = { permissions: ['bookmarks'] }

/** Builds the port at an injectable browser API boundary; bookmarks stays lazy until permission. */
export function createBookmarksPort({ bookmarks, permissions }: PortApis): BookmarksPort {
  return {
    contains: async () =>
      permissions.contains ? Boolean(await permissions.contains(PERMISSION)) : false,
    folders: async () => {
      if (!(await permissions.contains?.(PERMISSION))) return []
      const tree = await bookmarks().getTree()
      return flattenFolders(tree[0]?.children ?? [])
    },
    isSupported: () => typeof permissions.contains === 'function',
    read: async (choice: BookmarkFolderChoice) => {
      if (!(await permissions.contains?.(PERMISSION))) return { need: 'folder' }
      const api = bookmarks()
      const tree = await api.getTree()
      const folder = resolveFolder(tree[0]?.children ?? [], choice)
      if (!folder) return { need: 'folder' }
      const nodes = await api.getSubTree(folder.id)
      const current = nodes.find((node) => node.id === folder.id)
      return current
        ? { folderTitle: current.title, items: bookmarkItems(current) }
        : { need: 'folder' }
    },
    request: async () =>
      permissions.request ? Boolean(await permissions.request(PERMISSION)) : false,
    watch: (onChange) => {
      let active = true
      let granted = false
      let importing = false
      let timer: ReturnType<typeof setTimeout> | undefined
      const detachBookmarkListeners: (() => void)[] = []
      const notify = () => {
        if (!active || importing) return
        clearTimeout(timer)
        timer = setTimeout(() => {
          if (active) onChange()
        }, 100)
      }
      const addListener = (event: BrowserEvent, listener: () => void) => {
        const callback = listener as (...args: never[]) => void
        event.addListener(callback)
        detachBookmarkListeners.push(() => event.removeListener(callback))
      }
      const began = () => {
        importing = true
        clearTimeout(timer)
      }
      const ended = () => {
        importing = false
        notify()
      }
      const addBookmarkListeners = () => {
        const api = bookmarks()
        for (const event of [
          api.onCreated,
          api.onRemoved,
          api.onChanged,
          api.onMoved,
          api.onChildrenReordered,
        ]) {
          addListener(event, notify)
        }
        addListener(api.onImportBegan, began)
        addListener(api.onImportEnded, ended)
      }
      const removeBookmarkListeners = () => {
        detachBookmarkListeners.splice(0).forEach((detach) => detach())
      }
      const check = async () => {
        const next = permissions.contains ? Boolean(await permissions.contains(PERMISSION)) : false
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
      permissions.onAdded.addListener(added)
      permissions.onRemoved.addListener(removed)
      document.addEventListener('visibilitychange', visibility)
      void check()
      return () => {
        active = false
        clearTimeout(timer)
        removeBookmarkListeners()
        permissions.onAdded.removeListener(added)
        permissions.onRemoved.removeListener(removed)
        document.removeEventListener('visibilitychange', visibility)
      }
    },
  }
}
