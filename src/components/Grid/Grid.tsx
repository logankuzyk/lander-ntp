import type { JSX } from 'preact'

import { COLS, drawnRects, type DrawnWidget, ROWS } from '@/layout/geometry'
import type { Layout } from '@/layout/types'
import type { PageValues } from '@/widgetSystem/definition'
import { Box, WidgetBox } from '@/widgetSystem/WidgetBox'

type GridProps = {
  layout: Layout
  page: PageValues
}

/** Row by row from the top, then left to right, then by id: the order the boxes are in. */
const inReadingOrder = (a: DrawnWidget, b: DrawnWidget) =>
  a.rect.row - b.rect.row ||
  a.rect.col - b.rect.col ||
  (a.widget.placed.id < b.widget.placed.id ? -1 : a.widget.placed.id > b.widget.placed.id ? 1 : 0)

/**
 * The Grid (see CONTEXT.md): 12 columns by 8 rows over the page, outside the Bottom bar, with
 * each of the Layout's Widgets in a box at the cells `drawnRects` gives it. That is where a
 * Widget is drawn, which is not always where it is stored: one off the Grid or on another is
 * drawn in the nearest free place, and one with no free place is not drawn.
 *
 * The boxes come in reading order, whatever order the Layout is stored in, so that Tab will go
 * the way the eye does. Each is keyed by its Widget's id, so a Widget keeps its element, and
 * with it any state, when the others around it change. Draws only: it saves nothing.
 */
export function Grid({ layout, page }: GridProps) {
  return (
    // The styles lay the cells out from these, so the Grid's size is geometry.ts's alone.
    <div
      class="grid"
      style={{ '--cols': String(COLS), '--rows': String(ROWS) } as JSX.CSSProperties}
    >
      {drawnRects(layout)
        .sort(inReadingOrder)
        .map(({ rect, widget }) =>
          widget.kind === 'known' ? (
            <WidgetBox
              definition={widget.definition}
              key={widget.placed.id}
              options={widget.placed.options}
              page={page}
              rect={rect}
            />
          ) : (
            <Box key={widget.placed.id} rect={rect} widget={widget.placed.type}>
              <p class="widget-box__unknown">Needs a newer version of Lander</p>
            </Box>
          ),
        )}
    </div>
  )
}
