import { bookmarkItems, resolveFolder, selectableFolders } from './tree'
import type { BookmarkFolderChoice, BookmarkNode, BookmarksPort } from './types'

type FakeOptions = {
  granted?: boolean
  supported?: boolean
  tree?: BookmarkNode[]
}

export function createFakeBookmarksPort({
  granted = false,
  supported = true,
  tree = [],
}: FakeOptions = {}): BookmarksPort & {
  change: (nextTree?: BookmarkNode[]) => void
  revoke: () => void
} {
  let hasGrant = granted
  let currentTree = tree
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const notify = (permissionChanged = false) => {
    if (!hasGrant && !permissionChanged) return
    clearTimeout(timer)
    timer = setTimeout(() => listeners.forEach((listener) => listener()), 100)
  }
  const roots = () => (currentTree[0]?.children ? currentTree[0].children : currentTree)
  return {
    change: (nextTree) => {
      if (nextTree) currentTree = nextTree
      notify()
    },
    contains: async () => supported && hasGrant,
    folders: async () => (supported && hasGrant ? selectableFolders(roots()) : []),
    isSupported: () => supported,
    read: async (choice: BookmarkFolderChoice) => {
      if (!supported || !hasGrant) return { need: 'folder' as const }
      const folder = resolveFolder(roots(), choice)
      return folder
        ? { folderTitle: folder.title, items: bookmarkItems(folder) }
        : { need: 'folder' as const }
    },
    request: async () => {
      if (supported) hasGrant = true
      notify(true)
      return supported
    },
    revoke: () => {
      hasGrant = false
      notify(true)
    },
    watch: (onChange) => {
      if (!supported) return () => undefined
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
  }
}
