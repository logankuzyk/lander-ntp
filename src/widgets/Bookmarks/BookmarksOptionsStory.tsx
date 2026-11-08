import { createFakeBookmarksPort } from '@/bookmarks/fake'
import type { Layout, PlacedWidget } from '@/layout/types'
import { OptionsPopoverProvider } from '@/widgetSystem/useOptionsPopover'
import { WidgetBox } from '@/widgetSystem/WidgetBox'

import { createBookmarksDefinition } from './definition'

const options = {
  folder: JSON.stringify({ id: 'from-another-device', title: 'Reading' }),
  openInNewTab: false,
  showFolderName: true,
}

export function BookmarksOptionsStory({ folderMissing = false }: { folderMissing?: boolean }) {
  const port = createFakeBookmarksPort({
    granted: true,
    tree: [
      {
        children: folderMissing
          ? []
          : [{ children: [], id: 'from-another-device', title: 'Reading' }],
        id: 'root',
        title: '',
      },
    ],
  })
  const definition = createBookmarksDefinition(port)
  const placed: PlacedWidget = {
    col: 5,
    h: 3,
    id: 'bookmarks-story',
    options,
    row: 3,
    type: 'bookmarks',
    w: 2,
  }
  const layout: Layout = {
    extra: {},
    widgets: [{ definition, kind: 'known', options, placed }],
  }
  const page = { hour12: false }
  return (
    <div class="grid" style={{ '--cols': '12', '--rows': '8' }}>
      <OptionsPopoverProvider
        commit={() => undefined}
        layout={layout}
        loaded
        onOpen={() => undefined}
        onPageValueChange={() => undefined}
        otherOpen={false}
        page={page}
      >
        <WidgetBox
          definition={definition}
          id={placed.id}
          options={options}
          page={page}
          rect={placed}
        />
      </OptionsPopoverProvider>
    </div>
  )
}
