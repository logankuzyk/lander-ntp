import type { JSX } from 'preact'

import type { BookmarkReading } from '@/bookmarks/types'
import { useEditMode } from '@/components/EditMode/useEditMode'
import type { WidgetViewProps } from '@/widgetSystem/definition'

import type { BookmarksOptions } from './definition'

type Props = WidgetViewProps<BookmarksOptions, BookmarkReading>

export function Bookmarks({ cells, options, reading }: Props) {
  const { editing } = useEditMode()
  const columns = Math.max(1, Math.floor(cells.w / 2))
  const rows = Math.max(1, cells.h * 2 - (options.showFolderName ? 1 : 0))
  const capacity = columns * rows
  const overflow = reading.items.length > capacity
  const visible = reading.items.slice(0, overflow ? capacity - 1 : capacity)
  const preventNavigation = (event: JSX.TargetedEvent<HTMLAnchorElement, Event>) => {
    if (editing) event.preventDefault()
  }

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
            <a
              href={item.url}
              key={item.id}
              onClick={preventNavigation}
              onKeyDown={(event) => {
                if (editing && event.key === 'Enter') event.preventDefault()
              }}
              rel={options.openInNewTab ? 'noopener noreferrer' : undefined}
              target={options.openInNewTab ? '_blank' : undefined}
              title={item.url}
            >
              {item.title}
            </a>
          ))}
          {overflow && (
            <span class="bookmarks__more">+{reading.items.length - visible.length} more</span>
          )}
        </div>
      )}
    </section>
  )
}
