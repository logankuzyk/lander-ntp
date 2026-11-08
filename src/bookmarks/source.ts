import { reportNeed, type WatchedSource } from '@/widgetSystem/source'

import type { BookmarkFolderChoice, BookmarkReading, BookmarksPort } from './types'

export type BookmarksOptions = { folder: BookmarkFolderChoice | string }

function folderChoice(value: BookmarkFolderChoice | string): BookmarkFolderChoice {
  if (typeof value !== 'string') return value
  if (value === 'bar') return value
  try {
    const parsed = JSON.parse(value) as unknown
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'id' in parsed &&
      'title' in parsed &&
      typeof parsed.id === 'string' &&
      typeof parsed.title === 'string'
    ) {
      return { id: parsed.id, title: parsed.title }
    }
  } catch {
    // A stored folder from another device is missing here.
  }
  return { id: value, title: '' }
}

export function bookmarksSource(
  port: BookmarksPort,
): WatchedSource<BookmarkReading, BookmarksOptions> {
  return {
    kind: 'watched',
    read: async ({ folder }) => {
      if (!port.isSupported()) throw new Error('Bookmarks are unavailable')
      if (!(await port.contains())) return reportNeed('permission')
      const result = await port.read(folderChoice(folder))
      return 'need' in result ? reportNeed('folder') : result
    },
    watch: port.watch,
  }
}
