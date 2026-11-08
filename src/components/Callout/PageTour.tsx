import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'

import { useAddMenuControl } from '@/components/AddMenu/useAddMenuControl'
import { useEditMode } from '@/components/EditMode/useEditMode'
import type { Layout } from '@/layout/types'
import { type PageState, TOUR, type TourStop } from '@/onboarding/callouts'
import { pageFacts } from '@/onboarding/pageFacts'
import { findTarget } from '@/onboarding/target'
import { planTour, type TourPlan } from '@/onboarding/tour'

import { Callout } from './Callout'

/**
 * How long a stop waits for its target to be on the page before the tour goes on without it.
 * Long enough for a widget's setup button to arrive after an answer from the browser; a target
 * that was never going to come costs this once.
 */
export const MISSING_MS = 1_500

type PageTourProps = {
  closeInfo?: () => void
  /** The Layout, for placing a note again when it moves a widget. */
  layout: Layout
  /** The run is over, without the settings panel's stops: dismissed, or ended by hand. */
  onEnd: () => void
  /** The page's stops are done: the settings panel's come next. */
  onFinish: (plan: TourPlan) => void
  /** Opens photo details without taking focus from this callout. */
  openInfo?: () => void
  /** The stops to plan from; the tour of a new install. */
  stops?: readonly TourStop[]
}

/**
 * The page's part of the guided tour a new install is offered by the welcome: one note at a time,
 * beside what it is about. Next brings the page to the next stop, so each is seen as it is
 * described: it goes into edit mode and opens the Add menu (without moving focus off its own
 * button, which keeps focus from stop to stop). Nothing on the Grid changes, and nothing is stored.
 *
 * It puts back what it did: edit mode (if it was the tour that went into it) and the Add menu
 * are left when the tour ends or is dismissed, and on Next from the last stop. Leaving edit mode
 * by hand ends the run, and so does opening the settings (the page, which draws this, stops
 * drawing it). A stop whose target is not on the page after `MISSING_MS` is skipped, not waited
 * for.
 *
 * Drawn inside the edit mode provider and the Add menu's, as `PageNews` is.
 */
export function PageTour({
  closeInfo,
  layout,
  onEnd,
  onFinish,
  openInfo,
  stops = TOUR,
}: PageTourProps) {
  const { canChange, editing, enter, leave } = useEditMode()
  const menu = useAddMenuControl()
  // Worked out once the page has drawn, from what it has: see `pageFacts`.
  const [plan, setPlan] = useState<TourPlan | null>(null)
  const [index, setIndex] = useState(0)
  // Whether it was the tour that put the page in edit mode, and whether it has been seen on.
  const entered = useRef(false)
  const sawEditing = useRef(false)

  // The latest of everything the callbacks below use; they run later than the render they are in.
  const latest = useRef({ closeInfo, editing, enter, leave, menu, onEnd, onFinish, openInfo, plan })
  latest.current = { closeInfo, editing, enter, leave, menu, onEnd, onFinish, openInfo, plan }

  useLayoutEffect(() => {
    const next = planTour(pageFacts(canChange), stops)
    setPlan(next)
    if (next.page.length === 0) latest.current.onFinish(next)
    // Once: a tour does not change its stops as the page does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply the first stop after its page controls have mounted. A phase 3 walk starts in edit mode
  // with Add open, so asking for the menu before Controls has rendered it can lose that request.
  useEffect(() => {
    const first = plan?.page[0]
    if (first && (first.show.adding || first.show.editing || first.show.info)) bring(first.show)
    // Once: the walk does not change its first stop after it starts.
  }, [plan])

  // The tour starts from the welcome, a modal: closing it leaves focus on nothing, and the note is
  // before the Grid and the Bottom bar in the document, so Tab would start after it. Focus goes to
  // the note's button, where it then stays from stop to stop; if it is on something, it is left.
  useEffect(() => {
    if (!plan) return
    const active = document.activeElement
    if (active && active !== document.body) return
    document.querySelector<HTMLElement>('.callout--beside .callout__action')?.focus()
  }, [plan])

  /** Brings the page to what a stop describes. */
  const bring = ({ adding, editing: wantEditing, info: wantInfo }: PageState) => {
    const now = latest.current
    if (wantEditing && !now.editing) {
      entered.current = true
      now.enter()
    } else if (!wantEditing && now.editing) {
      now.leave()
    }
    now.menu?.setOpen(adding, { quiet: true })
    if (wantInfo) now.openInfo?.()
    else now.closeInfo?.()
  }

  const go = (to: number) => {
    const { onFinish: finish, plan: current } = latest.current
    if (!current) return
    const stop = current.page[to]
    if (!stop) {
      // Next from the last page stop leaves edit mode, as pressing Done would.
      latest.current.leave()
      finish(current)
      return
    }
    // A note whose target is not on the page is not drawn, and its Next button, which has focus,
    // would be taken off the page and put back as another one. So the page and the note are not
    // changed together: the note moves on after the page has drawn what the next stop points
    // into (the Add menu opens first), and before the page takes away what the last one pointed
    // into (the Add menu shuts after).
    if (stop.show.adding) {
      bring(stop.show)
      queueMicrotask(() => setIndex(to))
    } else {
      setIndex(to)
      queueMicrotask(() => bring(stop.show))
    }
  }

  // The page is put back whenever the tour goes, however it goes.
  useEffect(
    () => () => {
      const now = latest.current
      if (entered.current) now.leave()
      now.menu?.setOpen(false)
      now.closeInfo?.()
      // Focus on the note, or on nothing because the note has gone (Escape, E and Done end the
      // run from the keyboard with it on Next): to the Edit button, so that a keyboard is not
      // dropped at the top of the page. On anything else, it is the person's and is left.
      const focused = document.activeElement
      if (!focused || focused === document.body || focused.closest('.callout')) {
        document.querySelector<HTMLElement>('[data-edit-toggle]')?.focus()
      }
    },
    [],
  )

  // Edit mode changing under the tour, by hand: on the Edit stop that is the person doing what it
  // says (go on); on any stop after it, leaving edit mode is the end of the run.
  useEffect(() => {
    const stop = plan?.page[index]
    if (!stop) return
    // When the run starts on an Add stop, the menu is requested alongside entering edit mode.
    // Reopen it after that mode has drawn the Add menu, in case its transition shut the request.
    if (stop.show.adding && editing) latest.current.menu?.setOpen(true, { quiet: true })
    if (stop.show.editing) {
      if (editing) sawEditing.current = true
      else if (sawEditing.current) latest.current.onEnd()
    } else if (editing && !entered.current) {
      go(index + 1)
    }
    // `go` is from the latest render by way of `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, index, plan])

  const stop = plan?.page[index]

  // A stop whose target never comes is skipped. Asked again whenever the page changes under it,
  // so a target that arrives in time keeps its stop.
  useEffect(() => {
    if (!stop || findTarget(stop.target) !== null) return
    const timer = setTimeout(() => {
      if (findTarget(stop.target) === null) go(index + 1)
    }, MISSING_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop, index, editing, layout])

  if (!plan || !stop) return null

  const dismiss = () => {
    // Focus was on the note's button, which is about to go: to the Edit button, not the page.
    if (document.activeElement?.closest('.callout')) {
      document.querySelector<HTMLElement>('[data-edit-toggle]')?.focus()
    }
    latest.current.onEnd()
  }

  return (
    <Callout
      action={{ label: 'Next', onClick: () => go(index + 1) }}
      body={stop.body}
      layout={layout}
      onDismiss={dismiss}
      progress={`${stop.number} of ${plan.total}`}
      target={stop.target}
      title={stop.title}
    />
  )
}
