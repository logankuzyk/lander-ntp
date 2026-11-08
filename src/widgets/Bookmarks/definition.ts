import { h } from 'preact'

import { bookmarksPort } from '@/bookmarks/port'
import { bookmarksSource } from '@/bookmarks/source'
import type { BookmarkFolderChoice, BookmarkReading, BookmarksPort } from '@/bookmarks/types'
import { siteIconUrl } from '@/quickDial/siteIconUrl'
import type { PickChoice, WidgetDefinition, WidgetViewProps } from '@/widgetSystem/definition'
import type { Need } from '@/widgetSystem/needs'

import { Bookmarks } from './Bookmarks'

export type BookmarksOptions = {
  folder: BookmarkFolderChoice | string
  openInNewTab: boolean
  showFolderName: boolean
}

const BAR = 'bar'
const encodeFolder = (folder: { id: string; title: string }) => JSON.stringify(folder)
function decodeFolder(value: string): BookmarkFolderChoice {
  if (value === BAR) return BAR
  try {
    const folder = JSON.parse(value) as unknown
    if (
      typeof folder === 'object' &&
      folder !== null &&
      'id' in folder &&
      'title' in folder &&
      typeof folder.id === 'string' &&
      typeof folder.title === 'string'
    ) {
      return { id: folder.id, title: folder.title }
    }
  } catch {
    // A folder value from another version/device is treated as missing by the port.
  }
  return { id: value, title: '' }
}

const folderLabel = (value: string): string | undefined => {
  if (value === BAR) return 'Bookmarks bar'
  const folder = decodeFolder(value)
  return typeof folder === 'string' ? undefined : folder.title || undefined
}

export function createBookmarksDefinition(
  port: BookmarksPort,
  iconUrl: (host: string) => string = siteIconUrl,
): WidgetDefinition<BookmarksOptions, BookmarkReading> {
  const permission: Need<BookmarksOptions> = {
    action: { kind: 'ask', run: () => port.request() },
    id: 'permission',
    label: 'Allow access to bookmarks',
    met: () => !port.isSupported() || port.contains(),
  }
  const folder: Need<BookmarksOptions> = {
    action: { kind: 'option', option: 'folder' },
    id: 'folder',
    label: 'Choose a folder',
    met: () => true,
  }
  const loadFolders = async (): Promise<readonly PickChoice[]> => [
    { label: 'Bookmarks bar', value: BAR },
    ...(await port.folders()).map(({ depth, id, title }) => ({
      depth,
      label: title,
      value: encodeFolder({ id, title }),
    })),
  ]
  const definition: WidgetDefinition<BookmarksOptions, BookmarkReading> = {
    messages: {
      failed: port.isSupported()
        ? "Can't read your bookmarks"
        : "Bookmarks aren't available in this browser",
    },
    name: 'Bookmarks',
    needs: [permission, folder],
    options: [
      {
        control: 'pick',
        default: BAR,
        emptyText: 'No folders on this device',
        failedText: "Can't read folders",
        id: 'folder',
        label: 'Folder',
        load: loadFolders,
        missingLabel: (value) => {
          const title = folderLabel(value)
          return title ? `${title} (folder missing)` : 'Folder missing'
        },
        valueLabel: folderLabel,
      },
      { control: 'switch', default: true, id: 'showFolderName', label: 'Show the folder name' },
      { control: 'switch', default: false, id: 'openInNewTab', label: 'Open in a new tab' },
    ],
    sizes: {
      largest: { h: 8, w: 6 },
      smallest: { h: 2, w: 2 },
      starting: () => ({ h: 3, w: 2 }),
    },
    source: { kind: 'watched', source: bookmarksSource(port) },
    summary: ({ folder: value }) => {
      if (value === BAR) return 'Bookmarks bar'
      const folder = typeof value === 'string' ? decodeFolder(value) : value
      return typeof folder === 'string' ? 'Bookmarks bar' : folder.title || undefined
    },
    type: 'bookmarks',
    unavailable: () => (port.isSupported() ? null : "Bookmarks aren't available in this browser"),
    View: (props: WidgetViewProps<BookmarksOptions, BookmarkReading>) =>
      h(Bookmarks, { ...props, iconUrl }),
  }
  return definition
}

export const bookmarksDefinition = createBookmarksDefinition(bookmarksPort)
