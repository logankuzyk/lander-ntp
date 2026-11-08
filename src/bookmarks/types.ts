export type BookmarkNode = {
  children?: BookmarkNode[]
  folderType?: string
  id: string
  title: string
  type?: string
  url?: string
}

export type BookmarkItem = { id: string; title: string; url: string }
export type BookmarkFolder = { depth: number; id: string; title: string }
export type BookmarkFolderChoice = 'bar' | { id: string; title: string }
export type BookmarkReading = { folderTitle: string; items: BookmarkItem[] }
export type BookmarkRead = { need: 'folder' } | BookmarkReading

export type BookmarksPort = {
  contains: () => Promise<boolean>
  folders: () => Promise<BookmarkFolder[]>
  isSupported: () => boolean
  read: (folder: BookmarkFolderChoice) => Promise<BookmarkRead>
  request: () => Promise<boolean>
  watch: (onChange: () => void) => () => void
}
