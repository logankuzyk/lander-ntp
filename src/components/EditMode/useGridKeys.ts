import type { JSX, RefObject } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import { useEditMode } from '@/components/EditMode/useEditMode'
import { drawnRects, type Rect } from '@/layout/geometry'
import type { Layout } from '@/layout/types'
import { useOptionsPopover } from '@/widgetSystem/useOptionsPopover'

import {
  cannotPutDown,
  cannotResize,
  couldNotPutDown,
  moved,
  pickedUp,
  putBack,
  putDown,
  resized,
} from './keyAnnouncements'
import { dropKeys, type KeySession, nudge, pickUpKeys, stretch } from './moveSession'

type Options = {
  /** Saves the Layout. Without it nothing can be picked up: there is nowhere to put the result. */
  commit?: (next: Layout) => void
  grid: RefObject<HTMLElement>
  layout: Layout
}

/** A Widget in the air: the session, and what it is called, which is said again on each end. */
type Held = { name: string; session: KeySession }

/** Where a picked-up Widget would land, for the outline: the pointer's `Ghost`, drawn the same. */
export type KeyGhost = { place: Rect; valid: boolean }

const ARROWS: Record<string, { cols: number; rows: number }> = {
  ArrowDown: { cols: 0, rows: 1 },
  ArrowLeft: { cols: -1, rows: 0 },
  ArrowRight: { cols: 1, rows: 0 },
  ArrowUp: { cols: 0, rows: -1 },
}

/** The browser's own shortcuts (Ctrl+R, Command+Left) are not the Widget's. */
const hasShortcutModifier = (event: KeyboardEvent) => event.altKey || event.ctrlKey || event.metaKey

/**
 * Moving and resizing a Widget from the keyboard, the keys' side of `moveSession` (the pointer's
 * is `useGridMove`). The Grid hears the keys of all its boxes, so a box has nothing of it in it.
 *
 * - On a Widget's frame (the box itself, not a button inside it) Enter or Space picks it up. Its
 *   options, if open, close. Focus stays on the frame throughout.
 * - Arrows then move it one cell; Shift and the arrows make it one cell bigger or smaller, from
 *   its top left corner, between its smallest and largest size. It can be taken over a neighbour,
 *   where the outline goes red and it cannot be put down, so that it can be walked past one.
 * - Enter or Space puts it down: one `commit`, none for any step before it. Escape puts it back.
 *   So does focus leaving the frame (Tab, a click), a pointer pressed anywhere on the Grid (the
 *   pointer's drag then goes on from the place the Widget went back to), edit mode ending, the
 *   Layout becoming one that may not be changed, and the Widget going from the Layout (which says
 *   nothing: it is gone, not put back).
 * - While it is up the keys it uses never reach the page: the arrows do not change the photo, and
 *   Escape does not also leave edit mode. Every other key a page shortcut might use (letters,
 *   Delete) is swallowed too, so that nothing acts behind a Widget in the air, and Tab and the
 *   browser's own shortcuts are left alone.
 *
 * `announcement` is what to say to a screen reader, in the Grid's live region: it is picked up, the
 * place or size at each step, why a step stopped short or was refused, and put down or back.
 * `ghost` is the outline of where it would land, and `held` says which Widget is up and where it
 * is drawn meanwhile.
 */
export function useGridKeys({ commit, grid, layout }: Options) {
  const { canChange, editing } = useEditMode()
  const popover = useOptionsPopover()
  const movable = commit !== undefined && editing && canChange

  const [held, setHeld] = useState<Held | null>(null)
  const [said, setSaid] = useState({ odd: false, text: '' })
  const current = useRef<Held | null>(null)
  const latest = useRef(layout)
  latest.current = layout
  const committing = useRef(commit)
  committing.current = commit
  const changeable = useRef(canChange)
  changeable.current = canChange
  const closeOptions = useRef(popover.close)
  closeOptions.current = popover.close

  const hold = useCallback((next: Held | null) => {
    current.current = next
    setHeld(next)
  }, [])

  /**
   * Says `text` in the live region. A live region is read when its text changes, so the same
   * words twice in a row are said once; `again` is for a refusal that is pressed for again, which
   * changes the text by a trailing no-break space, which is not heard, so that it is read again.
   * Identical moves are not given it: they are not a new thing to say.
   */
  const say = useCallback((text: string, again = false) => {
    setSaid((was) => ({ odd: again && was.text === text ? !was.odd : false, text }))
  }, [])

  /** Puts the Widget back where it was picked up. With `say`, says so. */
  const cancel = useCallback(
    (tell: boolean) => {
      const was = current.current
      if (!was) return
      hold(null)
      if (tell) say(putBack(was.name, was.session))
    },
    [hold, say],
  )

  // Edit mode ending, or the Layout becoming unchangeable, puts a Widget in the air back.
  useEffect(() => {
    if (!movable) cancel(false)
  }, [movable, cancel])
  // Anything said belongs to the edit mode it was said in.
  useEffect(() => {
    if (!editing) say('')
  }, [editing, say])
  // The Widget in the air is gone from the Layout (another tab removed it): nothing to put down.
  useEffect(() => {
    const was = current.current
    if (was && !drawnRects(layout).some(({ widget }) => widget.placed.id === was.session.id)) {
      cancel(false)
    }
  }, [layout, cancel])

  /** The frame of a Widget that is picked up with a key: the box itself, on this Grid. */
  const frameOf = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement) || !target.classList.contains('widget-box')) return null
    return grid.current?.contains(target) && target.dataset.widgetId ? target : null
  }

  const pickUp = (event: KeyboardEvent) => {
    const frame = frameOf(event.target)
    if (!movable || !frame || event.repeat || event.shiftKey || hasShortcutModifier(event)) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    const id = frame.dataset.widgetId
    if (!id) return
    const session = pickUpKeys({ layout: latest.current, readOnly: !changeable.current }, id)
    if (!session) return
    event.preventDefault()
    event.stopPropagation()
    // Its options are for a Widget that is on the Grid, not one in the air.
    closeOptions.current()
    const name = frame.getAttribute('aria-label') ?? 'Widget'
    hold({ name, session })
    say(pickedUp(name, session))
  }

  const putDownNow = (was: Held) => {
    const { name, session } = was
    if (!session.valid) {
      // It stays in the air: it can be moved on, or put back.
      say(cannotPutDown(name, session), true)
      return
    }
    const next = dropKeys(session, { layout: latest.current, readOnly: !changeable.current })
    hold(null)
    const unchanged =
      session.place.col === session.origin.col &&
      session.place.row === session.origin.row &&
      session.place.w === session.origin.w &&
      session.place.h === session.origin.h
    say(next || unchanged ? putDown(name, session) : couldNotPutDown(name))
    if (next) committing.current?.(next)
  }

  const onKeyDownCapture = (event: KeyboardEvent) => {
    const was = current.current
    if (!was) {
      pickUp(event)
      return
    }
    if (event.key === 'Tab' || hasShortcutModifier(event) || event.isComposing) return
    const step = ARROWS[event.key]
    const ours =
      step !== undefined ||
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'Escape' ||
      event.key === 'Delete' ||
      event.key === 'Backspace' ||
      event.key.length === 1
    if (!ours) return
    // Heard here, on the way down, so that nothing behind the Widget answers the same key.
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') {
      cancel(true)
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (!event.repeat) putDownNow(was)
    } else if (step) {
      const { name, session } = was
      const next = event.shiftKey ? stretch(session, step) : nudge(session, step)
      hold({ name, session: next })
      say(
        event.shiftKey
          ? next.limit === 'unresizable'
            ? cannotResize(name)
            : resized(next)
          : moved(next),
      )
    }
  }

  // Focus going anywhere else (Tab, a click on something) is the Widget put back.
  const onFocusOut = (event: JSX.TargetedFocusEvent<HTMLElement>) => {
    const was = current.current
    if (!was || frameOf(event.target)?.dataset.widgetId !== was.session.id) return
    // A browser sends focusout as it takes a focused box out of the page, and that is a Widget
    // gone (another tab removed it): there is nothing to say was put back.
    const there = drawnRects(latest.current).some(
      ({ widget }) => widget.placed.id === was.session.id,
    )
    cancel(there)
  }

  // A pointer pressed anywhere on the Grid ends the pick-up, and a frame that already has focus
  // does not lose it to a press, so nothing else would: without this the drag and the pick-up
  // would both be in the air, and the next Enter would put the keyboard's place down over the
  // drag's. Heard on the way down, ahead of the pointer's own handler (see `useGridMove`), which
  // then drags from the place the Widget went back to.
  const onPointerDownCapture = () => cancel(true)

  const ghost: KeyGhost | null = held
    ? { place: held.session.place, valid: held.session.valid }
    : null

  return {
    // The trailing no-break space is `say`'s, to make the same refusal read again.
    announcement: said.odd ? `${said.text}\u00a0` : said.text,
    ghost,
    handlers: { onFocusOut, onKeyDownCapture, onPointerDownCapture },
    held: held
      ? { id: held.session.id, place: held.session.place, valid: held.session.valid }
      : null,
  }
}
