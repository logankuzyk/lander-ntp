import type { BookmarkFolder, BookmarkFolderChoice, BookmarkItem, BookmarkNode } from './types'

export function flattenFolders(nodes: readonly BookmarkNode[]): BookmarkFolder[] {
  const folders: BookmarkFolder[] = []
  const visit = (node: BookmarkNode, depth: number) => {
    if (node.children === undefined || node.type === 'separator') return
    folders.push({ depth, id: node.id, title: node.title })
    for (const child of node.children) visit(child, depth + 1)
  }
  for (const node of nodes) visit(node, 0)
  return folders
}

/** Folder choices leave out the device-specific folder represented by the portable `bar` value. */
export function selectableFolders(nodes: readonly BookmarkNode[]): BookmarkFolder[] {
  const folders = flattenFolders(nodes)
  const foldersWithRole: BookmarkNode[] = []
  const collect = (items: readonly BookmarkNode[]) => {
    for (const item of items) {
      if (item.children !== undefined) foldersWithRole.push(item)
      collect(item.children ?? [])
    }
  }
  collect(nodes)
  const portableBarId =
    foldersWithRole.find((node) => node.folderType === 'bookmarks-bar')?.id ?? folders[0]?.id
  return folders.filter((folder) => folder.id !== portableBarId)
}

export function resolveFolder(
  tree: readonly BookmarkNode[],
  choice: BookmarkFolderChoice,
): BookmarkNode | null {
  const folders = flattenFolders(tree)
  const byId = (id: string) => folders.find((folder) => folder.id === id)
  const nodes: BookmarkNode[] = []
  const collect = (items: readonly BookmarkNode[]) => {
    for (const item of items) {
      if (item.children !== undefined) nodes.push(item)
      collect(item.children ?? [])
    }
  }
  collect(tree)
  const target =
    choice === 'bar'
      ? (byId(nodes.find((node) => node.folderType === 'bookmarks-bar')?.id ?? '') ?? folders[0])
      : folders.find((folder) => folder.id === choice.id && folder.title === choice.title)
  if (!target) return null

  const find = (nodes: readonly BookmarkNode[]): BookmarkNode | null => {
    for (const node of nodes) {
      if (node.id === target.id && node.children !== undefined) return node
      const found = node.children && find(node.children)
      if (found) return found
    }
    return null
  }
  return find(tree)
}

export function bookmarkItems(folder: BookmarkNode): BookmarkItem[] {
  const items: BookmarkItem[] = []
  const visit = (nodes: readonly BookmarkNode[]) => {
    for (const node of nodes) {
      if (node.type === 'separator') continue
      if (node.url) {
        try {
          const url = new URL(node.url)
          if (url.protocol === 'http:' || url.protocol === 'https:') {
            items.push({ id: node.id, title: node.title, url: node.url })
          }
        } catch {
          // Malformed and unsupported URLs are not bookmark links for the Widget.
        }
      }
      // Sub-folders are deliberately not traversed: the selected folder is one level deep.
    }
  }
  visit(folder.children ?? [])
  return items
}
