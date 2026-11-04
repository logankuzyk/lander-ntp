import type { JSX } from 'preact'
import { useRef } from 'preact/hooks'

import { useEditMode } from '@/components/EditMode/useEditMode'
import { useGridMove } from '@/components/EditMode/useGridMove'
import { COLS, drawnRects, type DrawnWidget, ROWS } from '@/layout/geometry'
import type { Layout } from '@/layout/types'
import type { PageValues } from '@/widgetSystem/definition'
import { Box, WidgetBox } from '@/widgetSystem/WidgetBox'

type GridProps = {
  /**
   * Saves the whole Layout (`useLayout`'s `commit`), once for each Widget put down in a new place.
   * The Grid is only drawn once the stored Layout has arrived, which is what `commit` waits for.
   * Without it the Widgets cannot be dragged (a story or a test drawing the Grid alone).
   */
  commit?: (next: Layout) => void
  layout: Layout
  page: PageValues
}

/** Row by row from the top, then left to right, then by id: the order the boxes are in. */
const inReadingOrder = (a: DrawnWidget, b: DrawnWidget) =>
  a.rect.row - b.rect.row ||
  a.rect.col - b.rect.col ||
  (a.widget.placed.id < b.widget.placed.id ? -1 : a.widget.placed.id > b.widget.placed.id ? 1 : 0)

/** Said when edit mode starts, to people who cannot see the frames. */
const EDITING_HELP = 'Editing widgets. Tab moves between widgets.'

/** Where the lines between cells are, from 0 to 100 percent of the Grid: one more than cells. */
const lines = (cells: number) =>
  Array.from({ length: cells + 1 }, (_, line) => `${Number(((line / cells) * 100).toFixed(4))}%`)

/**
 * A dot at every cell corner, outermost ones on the Grid's edges: 13 by 9 of them. Drawn here
 * from the geometry, so they are the cells whatever the window is. Decoration only.
 */
function Dots() {
  const rows = lines(ROWS)
  return (
    <svg aria-hidden="true" class="grid__dots" focusable="false">
      {lines(COLS).map((cx) =>
        rows.map((cy) => <circle cx={cx} cy={cy} key={`${cx} ${cy}`} r="1.5" />),
      )}
    </svg>
  )
}

/**
 * The Grid (see CONTEXT.md): 12 columns by 8 rows over the page, outside the Bottom bar, with
 * each of the Layout's Widgets in a box at the cells `drawnRects` gives it. That is where a
 * Widget is drawn, which is not always where it is stored: one off the Grid or on another is
 * drawn in the nearest free place, and one with no free place is not drawn.
 *
 * The boxes come in reading order, whatever order the Layout is stored in, so that Tab will go
 * the way the eye does. Each is keyed by its Widget's id, so a Widget keeps its element, and
 * with it any state, when the others around it change. Draws only: it saves nothing.
 *
 * In edit mode the dots show over the Grid and each box is a frame (see Box). A polite live
 * region says so; it is on the page from the start, empty, so that what it says is announced.
 *
 * Also in edit mode, a Widget can be dragged to another place (see `useGridMove`): the Grid hears
 * the pointer for all its boxes, so a box has nothing of it in it. Where the Widget would land
 * is outlined, and the Layout is saved once, with `commit`, when it is put down. Nothing else
 * here saves anything.
 */
export function Grid({ commit, layout, page }: GridProps) {
  const { editing } = useEditMode()
  const grid = useRef<HTMLDivElement>(null)
  const { ghost, handlers, movable } = useGridMove({ commit, grid, layout })
  return (
    <>
      <div
        class={`grid${editing ? ' grid--editing' : ''}${movable ? ' grid--movable' : ''}`}
        ref={grid}
        // The styles lay the cells out from these, so the Grid's size is geometry.ts's alone.
        style={{ '--cols': String(COLS), '--rows': String(ROWS) } as JSX.CSSProperties}
        {...handlers}
      >
        {editing && <Dots />}
        {ghost && (
          <div
            aria-hidden="true"
            class="grid__ghost"
            data-valid={String(ghost.valid)}
            style={{
              gridColumn: `${ghost.place.col} / span ${ghost.place.w}`,
              gridRow: `${ghost.place.row} / span ${ghost.place.h}`,
            }}
          />
        )}
        {drawnRects(layout)
          .sort(inReadingOrder)
          .map(({ rect, widget }) =>
            widget.kind === 'known' ? (
              <WidgetBox
                definition={widget.definition}
                id={widget.placed.id}
                key={widget.placed.id}
                options={widget.placed.options}
                page={page}
                rect={rect}
              />
            ) : (
              <Box
                key={widget.placed.id}
                name="Unknown widget"
                placedId={widget.placed.id}
                rect={rect}
                widget={widget.placed.type}
              >
                <p class="widget-box__unknown">Needs a newer version of Lander</p>
              </Box>
            ),
          )}
      </div>
      {/* Not role="status": the Notice has that one, and a page has the one live region of it. */}
      <p aria-live="polite" class="visually-hidden">
        {editing ? EDITING_HELP : ''}
      </p>
    </>
  )
}
