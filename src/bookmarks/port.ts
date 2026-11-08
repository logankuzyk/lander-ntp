import { browser } from 'wxt/browser'

import { createBookmarksPort, type PortApis } from './createPort'

/** Browser adapter used by the new tab page. The Bookmarks API is looked up only after `contains`. */
export const bookmarksPort = createBookmarksPort({
  bookmarks: () => browser.bookmarks as unknown as ReturnType<PortApis['bookmarks']>,
  permissions: browser.permissions as unknown as PortApis['permissions'],
})
