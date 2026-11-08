import { reportNeed, type WatchedSource } from '@/widgetSystem/source'

import type { BookmarkFolderChoice, BookmarkReading, BookmarksPort } from './types'

export type BookmarksOptions = { folder: BookmarkFolderChoice }

export function bookmarksSource(
  port: BookmarksPort,
): WatchedSource<BookmarkReading, BookmarksOptions> {
  return {
    kind: 'watched',
    read: async ({ folder }) => {
      if (!(await port.contains())) return reportNeed('permission')
      const result = await port.read(folder)
      return 'need' in result ? reportNeed('folder') : result
    },
    watch: port.watch,
  }
}
