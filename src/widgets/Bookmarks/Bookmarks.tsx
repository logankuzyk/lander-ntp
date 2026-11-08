import type { JSX } from 'preact'

import type { BookmarkReading } from '@/bookmarks/types'
import { QuickDialTile } from '@/quickDial/QuickDialTile'
import type { WidgetViewProps } from '@/widgetSystem/definition'

import type { BookmarksOptions } from './definition'

type Props = WidgetViewProps<BookmarksOptions, BookmarkReading> & {
  iconUrl?: (host: string) => string
}

export function Bookmarks({ cells, iconUrl, options, reading }: Props) {
  const columns = Math.max(1, Math.floor(cells.w / 2))
  const rows = Math.max(1, cells.h * 2 - (options.showFolderName ? 1 : 0))
  const capacity = columns * rows
  const overflow = reading.items.length > capacity
  const visible = reading.items.slice(0, overflow ? capacity - 1 : capacity)
  return (
    <section aria-label="Bookmarks" class="bookmarks">
      {options.showFolderName && (
        <h2
          class="bookmarks__folder"
          style={{ '--bookmarks-total-rows': cells.h * 2 } as JSX.CSSProperties}
        >
          {reading.folderTitle}
        </h2>
      )}
      {reading.items.length === 0 ? (
        <p class="bookmarks__empty">This folder is empty</p>
      ) : (
        <div
          class="bookmarks__items"
          style={{ '--bookmarks-columns': columns, '--bookmarks-rows': rows } as JSX.CSSProperties}
        >
          {visible.map((item) => (
            <QuickDialTile
              iconUrl={iconUrl}
              key={item.id}
              label={item.title}
              newTab={options.openInNewTab}
              rel="noopener noreferrer"
              title={item.url}
              url={item.url}
            />
          ))}
          {overflow && (
            <span class="bookmarks__more">+{reading.items.length - visible.length} more</span>
          )}
        </div>
      )}
    </section>
  )
}
