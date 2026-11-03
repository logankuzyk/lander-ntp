import { createContext } from 'preact'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks'

import { nextInReadingOrder } from '@/layout/geometry'
import { removeWidget, restoreWidget, settle } from '@/layout/ops'
import type { Layout, PlacedWidget } from '@/layout/types'

import { accessibleName } from './name'

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

/** The Widget taken out last: the notice is about it, and Undo puts it back from this. */
type Pending = {
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
}

/** What to focus once the Layout has changed: a Widget's frame, or the Edit controls. */
type FocusAfter = 'controls' | { id: string }

const hasId = (layout: Layout, id: string) =>
  layout.widgets.some((widget) => widget.kind !== 'malformed' && widget.placed.id === id)

/** What a Widget is called to the person, if it is one this version knows. */
function nameOf(layout: Layout, id: string): string {
  const widget = layout.widgets.find(
    (candidate) => candidate.kind !== 'malformed' && candidate.placed.id === id,
  )
  return widget?.kind === 'known' ? accessibleName(widget.definition, widget.options) : 'Widget'
}

/**
 * Removing a Widget, and putting it back. Removing runs `removeWidget` and commits the whole
 * Layout in one save, which writes `sync:layout` and nothing else: never the settings, so
 * removing the Clock leaves `clock.enabled` as it was. The Widget, with its options, is held
 * here for Undo, in this tab and in memory only, until the notice goes (it is dismissed, it
 * times out, or another removal takes its place); then its options are discarded. Undo puts it
 * back in its place, or the nearest free one, in one more save, whatever the Widget limit.
 *
 * Focus moves on, as the frame that had it is gone: to the next Widget in reading order, else to
 * the Edit controls; after Undo, to the Widget that is back.
 *
 * `notice` is what `Notice` should say, or null. It is the page's to draw, as the page has the
 * one live region for notices. A removal that the browser then refused (the Widget is back in
 * the Layout) has no notice.
 */
export function useRemovalController({ commit, layout, loaded, readOnly }: RemovalOptions) {
  const [pending, setPending] = useState<Pending | null>(null)
  const count = useRef(0)
  // What each change starts from: the Layout as of the last change made, so a second change
  // before the page has drawn the first still has it. Each render brings it up to date.
  const latest = useRef(layout)
  latest.current = layout
  const focusAfter = useRef<FocusAfter | null>(null)

  const available = loaded && !readOnly

  const remove = useCallback(
    (id: string) => {
      if (!available) return
      const base = latest.current
      const result = removeWidget({ layout: base, readOnly: false }, id)
      if (!result.ok) return
      // After the Widget it was, in the order of the Layout as it was drawn.
      const next = nextInReadingOrder(settle(base), id)
      focusAfter.current = next === null ? 'controls' : { id: next }
      latest.current = result.layout
      commit(result.layout)
      count.current += 1
      setPending({
        identity: `removed ${count.current}`,
        name: nameOf(base, id),
        removed: result.removed,
      })
    },
    [available, commit],
  )

  const undo = useCallback(() => {
    if (!pending || !available) return
    const result = restoreWidget({ layout: latest.current, readOnly: false }, pending.removed)
    if (!result.ok) {
      count.current += 1
      setPending({ ...pending, identity: `no room ${count.current}`, noRoom: true })
      return
    }
    // Unchanged when it was back already: nothing to save.
    if (result.layout !== latest.current) {
      latest.current = result.layout
      commit(result.layout)
    }
    focusAfter.current = { id: result.id }
    setPending(null)
  }, [available, commit, pending])

  const dismiss = useCallback(() => setPending(null), [])

  // The Widget is in the Layout again: put back from another tab, or the browser refused the
  // save and the stored Layout came back. There is nothing to undo.
  useEffect(() => {
    if (pending && hasId(layout, pending.removed.id)) setPending(null)
  }, [layout, pending])

  // Once the Layout has changed and been drawn: the frame that had focus is gone.
  useEffect(() => {
    const target = focusAfter.current
    if (!target) return
    focusAfter.current = null
    const element =
      target === 'controls'
        ? document.querySelector<HTMLElement>('[data-edit-toggle]')
        : [...document.querySelectorAll<HTMLElement>('.widget-box')].find(
            (box) => box.dataset.widgetId === target.id,
          )
    element?.focus()
  }, [layout])

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
