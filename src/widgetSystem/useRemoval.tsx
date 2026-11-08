import { createContext } from 'preact'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks'

import { nextInReadingOrder } from '@/layout/geometry'
import { removeWidget, restoreWidget, settle } from '@/layout/ops'
import type { Layout, PlacedWidget } from '@/layout/types'

import { accessibleName, unknownWidgetName } from './name'
import { widgetDefinition } from './registry'

/** What a Widget's box needs of removal: whether there is any, and how to ask for it. */
export type RemovalControls = {
  /** False outside the page (a story or a test drawing a box alone), and while the Layout may not be changed. */
  available: boolean
  /** Removes the Widget stored under this id, and offers to put it back. */
  remove: (id: string) => void
}

const NONE: RemovalControls = { available: false, remove: () => {} }

const RemovalContext = createContext<RemovalControls>(NONE)

export const RemovalProvider = RemovalContext.Provider

export const useRemoval = () => useContext(RemovalContext)

/** How long the Undo stays: the time counts only while nothing is over it or focused in it. */
export const UNDO_MS = 8_000

/** What the page's notice says for a removal, for `Notice`'s props. */
export type UndoNotice = {
  action?: { label: string; onClick: () => void }
  autoDismissMs: number
  identity: string
  message: string
  onDismiss: () => void
}

/** What to focus once the Layout has changed: a Widget's frame, or the Edit controls. */
type FocusAfter = 'controls' | { id: string }

/** The Widget taken out last: the notice is about it, and Undo puts it back from this. */
type Pending = {
  /** Where focus goes when the notice is dismissed with focus in it, or Undo has no room. */
  focus: FocusAfter
  /** Tells this notice from the one before it. */
  identity: string
  /** What it is called, as the notice says. */
  name: string
  /** There was no room to put it back. */
  noRoom?: boolean
  /** As it was stored: held here and nowhere else, so it is gone when the notice is. */
  removed: PlacedWidget
}

type RemovalOptions = {
  /** Saves the whole Layout (`useLayout`'s `commit`). */
  commit: (next: Layout) => void
  /** The Layout, as `useLayout` gives it. */
  layout: Layout
  /** Whether the stored Layout has arrived: until it has, nothing is committed (see `useLayout`). */
  loaded: boolean
  /** Whether a newer version wrote the Layout, so that nothing may change it. */
  readOnly: boolean
  /** How many saves the browser has refused so far, of any item: a refused Undo is told from it. */
  saveFailures: number
}

const hasId = (layout: Layout, id: string) =>
  layout.widgets.some((widget) => widget.kind !== 'malformed' && widget.placed.id === id)

/** What a Widget is called to the person, if it is one this version knows. */
function nameOf(layout: Layout, id: string): string {
  const widget = layout.widgets.find(
    (candidate) => candidate.kind !== 'malformed' && candidate.placed.id === id,
  )
  if (widget?.kind === 'known') return accessibleName(widget.definition, widget.options)
  // A type this version does not know: by the name its box has, so that the line says which.
  return widget?.kind === 'unknown' ? unknownWidgetName(layout, id) : 'Widget'
}

/**
 * Removing a Widget, and putting it back. Removing runs `removeWidget` and commits the whole
 * Layout in one save, which writes `sync:layout` and nothing else: never the settings, so
 * removing the Clock leaves `clock.enabled` as it was. The Widget, with its options, is held
 * here for Undo, in this tab and in memory only, until the notice goes (it is dismissed, it
 * times out, or another removal takes its place); then its options are discarded. Undo puts it
 * back in its place, or the nearest free one, in one more save, whatever the Widget limit. If
 * the browser refuses that save the Widget is gone again, the page says so, and Undo is offered
 * again once that line has gone.
 *
 * Focus moves on, as the frame that had it is gone: to the next Widget in reading order, else to
 * the Edit controls; after Undo, to the Widget that is back; and when the notice is dismissed
 * with focus in it, to where the removed Widget's neighbour is.
 *
 * `notice` is what `Notice` should say, or null. It is the page's to draw, as the page has the
 * one live region for notices. A removal that the browser then refused (the Widget is back in
 * the Layout) has no notice.
 */
export function useRemovalController({
  commit,
  layout,
  loaded,
  readOnly,
  saveFailures,
}: RemovalOptions) {
  const [pending, setPending] = useState<Pending | null>(null)
  const count = useRef(0)
  // What each change starts from: the Layout as of the last change made, so a second change
  // before the page has drawn the first still has it. Each render brings it up to date.
  const latest = useRef(layout)
  latest.current = layout
  const focusAfter = useRef<FocusAfter | null>(null)
  const failuresNow = useRef(saveFailures)
  failuresNow.current = saveFailures
  // What Undo last put back, and how many saves had failed then: if a save fails and the Widget
  // is gone again, it was Undo's own that was refused, and Undo is offered again.
  const undone = useRef<{ failures: number; pending: Pending } | null>(null)

  const available = loaded && !readOnly

  const discard = useCallback((removed: PlacedWidget) => {
    widgetDefinition(removed.type)?.onDiscard?.(removed.options)
  }, [])

  const remove = useCallback(
    (id: string) => {
      if (!available) return
      const base = latest.current
      const result = removeWidget({ layout: base, readOnly: false }, id)
      if (!result.ok) return
      // After the Widget it was, in the order of the Layout as it was drawn.
      const next = nextInReadingOrder(settle(base), id)
      const focus: FocusAfter = next === null ? 'controls' : { id: next }
      focusAfter.current = focus
      undone.current = null
      if (pending) discard(pending.removed)
      latest.current = result.layout
      commit(result.layout)
      count.current += 1
      setPending({
        focus,
        identity: `removed ${count.current}`,
        name: nameOf(base, id),
        removed: result.removed,
      })
    },
    [available, commit, discard, pending],
  )

  const undo = useCallback(() => {
    if (!pending || !available) return
    const result = restoreWidget({ layout: latest.current, readOnly: false }, pending.removed)
    if (!result.ok) {
      count.current += 1
      // The Undo button the person pressed goes: focus goes on with the notice's Dismiss.
      focusAfter.current = pending.focus
      setPending({ ...pending, identity: `no room ${count.current}`, noRoom: true })
      return
    }
    // Unchanged when it was back already: nothing to save.
    if (result.layout !== latest.current) {
      latest.current = result.layout
      commit(result.layout)
      undone.current = { failures: failuresNow.current, pending }
    }
    focusAfter.current = { id: result.id }
    setPending(null)
  }, [available, commit, pending])

  const dismiss = useCallback(() => {
    // With focus on the notice, the notice taking itself away drops focus to the page, and the
    // frame it would have gone back to is the Widget that was removed.
    if (document.activeElement?.closest('.notice')) focusAfter.current = pending?.focus ?? null
    if (pending) discard(pending.removed)
    setPending(null)
  }, [discard, pending])

  // A newer version wrote the Layout while the notice was up: nothing may be put back, so the
  // notice, and the Widget it holds, go rather than leave an Undo that does nothing.
  useEffect(() => {
    if (pending && readOnly) setPending(null)
  }, [pending, readOnly])

  // The Widget is in the Layout again: put back from another tab, or the browser refused the
  // save and the stored Layout came back. There is nothing to undo.
  useEffect(() => {
    if (pending && hasId(layout, pending.removed.id)) setPending(null)
  }, [layout, pending])

  // Undo's own save was refused: a save has failed since, and the Widget is gone again. The
  // Undo is not spent; the page says why (the refused save outranks it) and offers it again.
  useEffect(() => {
    const last = undone.current
    if (!last || saveFailures === last.failures || hasId(layout, last.pending.removed.id)) return
    undone.current = null
    count.current += 1
    setPending({ ...last.pending, identity: `removed ${count.current}` })
  }, [layout, saveFailures])

  // Once the Layout has changed and been drawn (or the notice has gone): the frame that had
  // focus is gone. A Widget that is not there any more is not focused: the Edit controls are.
  useEffect(() => {
    const target = focusAfter.current
    if (!target) return
    focusAfter.current = null
    const frame =
      target === 'controls'
        ? undefined
        : [...document.querySelectorAll<HTMLElement>('.widget-box')].find(
            (box) => box.dataset.widgetId === target.id,
          )
    ;(frame ?? document.querySelector<HTMLElement>('[data-edit-toggle]'))?.focus()
  }, [layout, pending])

  const controls = useMemo<RemovalControls>(() => ({ available, remove }), [available, remove])

  const notice: UndoNotice | null = pending
    ? {
        action: pending.noRoom ? undefined : { label: 'Undo', onClick: undo },
        autoDismissMs: UNDO_MS,
        identity: pending.identity,
        message: pending.noRoom
          ? `No room to put ${pending.name} back.`
          : `${pending.name} removed.`,
        onDismiss: dismiss,
      }
    : null

  return { controls, notice }
}
