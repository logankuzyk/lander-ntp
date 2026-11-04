import type { JSX, RefObject } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import { useEditMode } from '@/components/EditMode/useEditMode'
import { COLS, drawnRects, type Rect, ROWS } from '@/layout/geometry'
import type { Layout } from '@/layout/types'

import { drop, type GridBox, move, type MoveSession, pickUp, toCells } from './moveSession'

/** How far the pointer goes, in pixels, before a press is a drag: less is a click that wobbled. */
const MOUSE_DISTANCE = 4
/** A finger moves more than a mouse does while it only means to press. */
const TOUCH_DISTANCE = 10

/**
 * A press on one of these is theirs and not a drag's: the Options button (and the remove button
 * to come), links and fields. The setup button is the exception, because it can fill a small
 * Widget's box and the Widget would then have nothing left to take hold of: a press on it that
 * moves is a drag, and one that does not is a press.
 */
const OWN_PRESS = 'button:not(.widget-setup), a, input, select, textarea, [contenteditable]'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** Where a dragged Widget would land, for the outline: drawn in the Grid's cells. */
export type Ghost = { place: Rect; valid: boolean }

/** A pointer that went down on a Widget, from its press to its release. */
type Press = {
  /** The Widget's box. */
  box: HTMLElement
  /** Set when the drag was called off (Escape, a cancelled pointer): the rest of it is ignored. */
  cancelled: boolean
  pointerId: number
  pointerType: string
  session: MoveSession
  /** Whether the pointer has gone far enough for this to be a drag. */
  started: boolean
  x: number
  y: number
}

type Options = {
  /** Saves the Layout. Without it nothing can be dragged: there is nowhere to put the result. */
  commit?: (next: Layout) => void
  grid: RefObject<HTMLElement>
  layout: Layout
}

/** Round to a hundredth of a pixel, so a sum of fractions of cells does not print as noise. */
const px = (value: number) => Math.round(value * 100) / 100

/**
 * Moving a Widget by dragging it, the pointer's side of `moveSession`: the Grid (on its element,
 * with `handlers`) hears the presses, moves and releases of its Widgets' boxes, and works out
 * the rest in cells.
 *
 * - A press that goes far enough takes the pointer for the Widget's box and starts a drag. The
 *   Widget follows the pointer by a `transform`, which is set on the box itself and not through a
 *   render, so a move redraws nothing else. `ghost` is where it would land, for the Grid to draw.
 * - Under reduced motion (watched live, so a change in the middle of a drag counts) the Widget
 *   jumps from cell to cell instead of following.
 * - Release saves once, with `commit`, if the place is allowed and is not where the Widget was.
 *   Anything else puts the Widget back without a word: a refused place, Escape, a pointer the
 *   browser cancelled or took away, edit mode ending, the Widget going from the Layout.
 * - It saves nothing on a Layout that may not be changed, and drags nothing.
 * - The click a browser sends after a drag is swallowed once, so a Widget's own button, pressed to
 *   start one, is not also pressed.
 */
export function useGridMove({ commit, grid, layout }: Options) {
  const { canChange, editing } = useEditMode()
  const movable = commit !== undefined && editing && canChange
  const [ghost, setGhost] = useState<Ghost | null>(null)

  const press = useRef<Press | null>(null)
  // The listeners on the document for as long as there is a press: aborted when it ends.
  const listening = useRef<AbortController | null>(null)
  const reduced = useRef(false)
  const latest = useRef(layout)
  latest.current = layout
  const committing = useRef(commit)
  committing.current = commit
  const changeable = useRef(canChange)
  changeable.current = canChange

  // Live, so that a person who turns motion off in the middle of a drag is not kept waiting.
  useEffect(() => {
    const query = window.matchMedia?.(REDUCED_MOTION)
    if (!query) return
    const update = () => {
      reduced.current = query.matches
    }
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  /** Puts the box back as the Layout has it, with no outline. Leaves `press` for its release. */
  const putBack = useCallback((held: Press) => {
    held.box.style.transform = ''
    held.box.classList.remove('widget-box--moving')
    setGhost(null)
  }, [])

  /** The press is over: nothing more is listened for. */
  const endPress = useCallback(() => {
    press.current = null
    listening.current?.abort()
    listening.current = null
  }, [])

  /** Calls the drag off. Its release, when it comes, does nothing but swallow the click. */
  const cancel = useCallback(() => {
    const held = press.current
    if (!held || held.cancelled) return
    held.cancelled = true
    if (held.started) putBack(held)
  }, [putBack])

  // Escape puts the Widget back, ahead of anything else Escape does: a drag is the innermost thing
  // open, so it must not also leave edit mode. Heard first, on the way down, and only while a
  // Widget is in the air.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const held = press.current
      if (event.key !== 'Escape' || !held?.started || held.cancelled) return
      event.preventDefault()
      cancel()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [cancel])

  // Edit mode ending, the Layout becoming unchangeable, or this going away drops a Widget in the
  // air back where it was.
  useEffect(() => {
    if (!movable) cancel()
  }, [movable, cancel])
  useEffect(
    () => () => {
      cancel()
      endPress()
    },
    [cancel, endPress],
  )

  // The Widget being dragged is gone from the Layout (another tab removed it): nothing to drop.
  useEffect(() => {
    const held = press.current
    if (!held || held.cancelled) return
    if (!drawnRects(layout).some(({ widget }) => widget.placed.id === held.session.id)) cancel()
  }, [layout, cancel])

  /** Shows the session: the Widget where the pointer has it, and the outline where it lands. */
  const show = (held: Press, session: MoveSession, gridBox: GridBox) => {
    // Cells are not square: the Grid's own width and height are what a column and a row are.
    const cell = { height: gridBox.height / ROWS, width: gridBox.width / COLS }
    // Under reduced motion it sits at the cell it would land in, and does not follow.
    const where = reduced.current
      ? { col: session.place.col - 1, row: session.place.row - 1 }
      : session.at
    const x = px((where.col - (session.origin.col - 1)) * cell.width)
    const y = px((where.row - (session.origin.row - 1)) * cell.height)
    held.box.style.transform = `translate(${x}px, ${y}px)`
    const { place, valid } = session
    setGhost((was) =>
      was?.valid === valid && was.place.col === place.col && was.place.row === place.row
        ? was
        : { place, valid },
    )
  }

  const onPointerDown = (event: JSX.TargetedPointerEvent<HTMLElement>) => {
    const target = event.target
    if (!movable || !(target instanceof Element) || !grid.current) return
    // The main button, and the one finger or pen that is the pointer. A second one is not a drag.
    if (event.button !== 0 || !event.isPrimary) return
    const held = press.current
    if (held && !held.cancelled && held.pointerId !== event.pointerId) return
    // The same pointer pressing again: the release of the last was missed. It is over.
    if (held) cancel()
    if (target.closest(OWN_PRESS)) return
    const box = target.closest<HTMLElement>('.widget-box')
    const id = box?.dataset.widgetId
    if (!box || !id || !grid.current.contains(box)) return
    const pointer = toCells(
      { x: event.clientX, y: event.clientY },
      grid.current.getBoundingClientRect(),
    )
    if (!pointer) return
    const session = pickUp({ layout: latest.current, readOnly: !changeable.current }, id, pointer)
    if (!session) return
    press.current = {
      box,
      cancelled: false,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      session,
      started: false,
      x: event.clientX,
      y: event.clientY,
    }
    // The rest of the press is heard on the document, not on the Grid: the pointer goes where
    // the Grid is not (its margins, the Bottom bar, off the page) before a drag has taken it, and
    // a release there must still end the press.
    listening.current?.abort()
    const { signal } = (listening.current = new AbortController())
    document.addEventListener('pointermove', (move) => live.current.move(move), { signal })
    document.addEventListener('pointerup', (up) => live.current.up(up), { signal })
    document.addEventListener('pointercancel', (stop) => live.current.cancel(stop), { signal })
  }

  const onPointerMove = (event: PointerEvent) => {
    const held = press.current
    if (!held || held.pointerId !== event.pointerId || !grid.current) return
    // A mouse or pen that moves with no button down was released where nothing saw it (outside the
    // window): the press is over. A touch has no button to look at.
    if (held.pointerType !== 'touch' && event.buttons === 0) {
      cancel()
      endPress()
      return
    }
    if (held.cancelled) return
    if (!held.started) {
      const far = held.pointerType === 'touch' ? TOUCH_DISTANCE : MOUSE_DISTANCE
      if (Math.hypot(event.clientX - held.x, event.clientY - held.y) < far) return
      held.started = true
      try {
        held.box.setPointerCapture(event.pointerId)
      } catch {
        // The pointer is gone already (a touch lifted): its release has nothing to drop.
      }
      held.box.classList.add('widget-box--moving')
    }
    const gridBox = grid.current.getBoundingClientRect()
    const pointer = toCells({ x: event.clientX, y: event.clientY }, gridBox)
    if (!pointer) return
    held.session = move(held.session, pointer)
    show(held, held.session, gridBox)
  }

  const onPointerUp = (event: PointerEvent) => {
    const held = press.current
    if (!held || held.pointerId !== event.pointerId) return
    endPress()
    if (held.started) {
      // The click that follows a drag is not a press of anything under the pointer.
      const swallow = (click: Event) => {
        click.stopPropagation()
        click.preventDefault()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', swallow, true), 0)
    }
    if (!held.started || held.cancelled) return
    putBack(held)
    const next = drop(held.session, { layout: latest.current, readOnly: !changeable.current })
    if (next) {
      committing.current?.(next)
    }
  }

  // The browser took the pointer for something else (a touch became a scroll): there is no
  // release to wait for.
  const onPointerCancel = (event: PointerEvent) => {
    if (press.current?.pointerId !== event.pointerId) return
    cancel()
    endPress()
  }

  // What the document's listeners call: the latest render's, which close over nothing but refs.
  const live = useRef({ cancel: onPointerCancel, move: onPointerMove, up: onPointerUp })
  live.current = { cancel: onPointerCancel, move: onPointerMove, up: onPointerUp }

  // The box lost the pointer while it was down (it was taken out of the page). The release may
  // come somewhere else, or not at all: the next press replaces this one.
  // Only the box's own: a touch is held by whatever it fell on, and taking it for the box lets go
  // of that first, which reaches here from inside the box.
  const onLostPointerCapture = (event: JSX.TargetedPointerEvent<HTMLElement>) => {
    const held = press.current
    if (held?.pointerId === event.pointerId && event.target === held.box) cancel()
  }

  // Not a menu in the middle of a drag (a long press on a touch screen sends one).
  const onContextMenu = (event: Event) => {
    if (press.current?.started) event.preventDefault()
  }

  return {
    ghost,
    handlers: {
      onContextMenu,
      onLostPointerCapture,
      onPointerDown,
    },
    movable,
  }
}
