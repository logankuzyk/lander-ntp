import { createFakeBookmarksPort } from '@/bookmarks/fake'
import type { BookmarkNode, BookmarksPort } from '@/bookmarks/types'
import { WidgetBox } from '@/widgetSystem/WidgetBox'

import { createBookmarksDefinition } from './definition'

const STORY_ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"%3E%3Crect width="16" height="16" rx="3" fill="%235b7cfa"/%3E%3C/svg%3E'

export type StoryMode =
  'allow' | 'choose' | 'empty' | 'failed' | 'loading' | 'ready' | 'unsupported'

const tree: BookmarkNode[] = [
  {
    children: [
      {
        children: Array.from({ length: 18 }, (_, index) => ({
          id: `bookmark-${index}`,
          title: `Reading link ${index + 1}`,
          url: `https://example.com/${index + 1}`,
        })),
        folderType: 'bookmarks-bar',
        id: 'bar',
        title: 'Bookmarks bar',
      },
    ],
    id: 'root',
    title: '',
  },
]

function portFor(mode: StoryMode): BookmarksPort {
  const base = createFakeBookmarksPort({
    granted: !['allow', 'unsupported'].includes(mode),
    supported: mode !== 'unsupported',
    tree,
  })
  if (mode === 'loading') return { ...base, read: () => new Promise(() => {}) }
  if (mode === 'failed')
    return {
      ...base,
      read: async () => {
        throw new Error('read failed')
      },
    }
  if (mode === 'empty') {
    return createFakeBookmarksPort({
      granted: true,
      tree: [
        {
          children: [
            { children: [], folderType: 'bookmarks-bar', id: 'bar', title: 'Bookmarks bar' },
          ],
          id: 'root',
          title: '',
        },
      ],
    })
  }
  return base
}

export function BookmarksStory({
  cells,
  mode,
  openInNewTab = false,
  showFolderName = true,
}: {
  cells: { h: number; w: number }
  mode: StoryMode
  openInNewTab?: boolean
  showFolderName?: boolean
}) {
  const definition = createBookmarksDefinition(portFor(mode), () => STORY_ICON)
  const options = {
    folder: mode === 'choose' ? JSON.stringify({ id: 'another-profile', title: 'Reading' }) : 'bar',
    openInNewTab,
    showFolderName,
  }
  const rect = {
    col: 1 + Math.floor((12 - cells.w) / 2),
    ...cells,
    row: 1 + Math.floor((8 - cells.h) / 2),
  }
  return (
    <div class="grid" style={{ '--cols': '12', '--rows': '8' }}>
      <WidgetBox definition={definition} options={options} page={{ hour12: false }} rect={rect} />
    </div>
  )
}
