import { useLayoutEffect, useRef, useState } from 'preact/hooks'

import { useEditMode } from '@/components/EditMode/useEditMode'
import { type Edges, placeBeside } from '@/onboarding/placeBeside'
import { type CalloutTarget, findTarget, preferredSides } from '@/onboarding/target'

/** What a callout keeps clear of: the popovers (settings, details, a Widget's options) and menus. */
const OPEN = '.popover, [role="menu"], [role="listbox"]'

const edgesOf = ({ bottom, left, right, top }: DOMRect): Edges => ({ bottom, left, right, top })

const sizeOf = (element: Element) => {
  const { height, width } = element.getBoundingClientRect()
  return `${width}x${height}`
}

/** What is open on the page, drawn, and not the callout itself or something it is in. */
function openThings(callout: HTMLElement): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(OPEN)].filter((element) => {
    if (element === callout || element.contains(callout)) return false
    const { height, width } = element.getBoundingClientRect()
    return width > 0 || height > 0
  })
}

const sameElements = (a: readonly Element[], b: readonly Element[]) =>
  a.length === b.length && a.every((element, index) => element === b[index])

/** What the last placing measured, so an observer's word that nothing changed is not acted on. */
type Measured = {
  open: HTMLElement[]
  sizes: Map<Element, string>
  /** Where the target was: its box, to tell that something added to the page has moved it. */
  where: string
}

const whereOf = (element: Element) => {
  const { left, top } = element.getBoundingClientRect()
  return `${left},${top}`
}

/**
 * Puts a callout beside its target on the page, and keeps it there. Returns the `ref` for the
 * callout's element and whether there is a target to point at: a callout with none is not drawn
 * (see `findTarget`), and one with `target` undefined is not placed at all (it sits where its
 * styles put it).
 *
 * It is placed with `placeBeside` when it shows, when the window resizes, when its target (or
 * the callout, or an open menu or popover) changes size, when something is opened or closed,
 * and when `watch` or edit mode changes: the Layout, which moves a Widget without resizing it.
 * Also when elements are added to or taken from the page and that has moved the target.
 * Never on a timer or a frame. A browser tells a ResizeObserver the size of what it starts
 * watching; that word is ignored unless the size is not the one measured, so it costs nothing.
 *
 * Where it is placed is set on the element and not rendered, so the page drawing again does not
 * undo it, and the pointer's place goes in `--callout-pointer` for the styles.
 */
export function useBeside(target: CalloutTarget | undefined, watch: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  const { editing } = useEditMode()
  const [found, setFound] = useState<HTMLElement | null>(() =>
    target === undefined ? null : findTarget(target),
  )
  const measured = useRef<Measured>({ open: [], sizes: new Map(), where: '' })
  const observer = useRef<ResizeObserver | null>(null)

  // What the page draws for the target now: asked after every render, and when the page's
  // elements change (see below). Cheap, and the callout is drawn only while there is one.
  const look = () => {
    const now = target === undefined ? null : findTarget(target)
    setFound((before) => (before === now ? before : now))
    return now
  }

  const place = () => {
    const callout = ref.current
    const point = target === undefined ? null : findTarget(target)
    if (!callout || !point || target === undefined) return
    const open = openThings(callout)
    const avoid: Edges[] = []
    // An item in a menu is beside the menu, not on it: level with the item, against the menu.
    let within: Edges | undefined
    for (const element of open) {
      const edges = edgesOf(element.getBoundingClientRect())
      if (!element.contains(point)) {
        avoid.push(edges)
      } else if (within) {
        within = {
          bottom: Math.max(within.bottom, edges.bottom),
          left: Math.min(within.left, edges.left),
          right: Math.max(within.right, edges.right),
          top: Math.min(within.top, edges.top),
        }
      } else {
        within = edges
      }
    }
    const placement = placeBeside(
      edgesOf(point.getBoundingClientRect()),
      { height: callout.offsetHeight, width: callout.offsetWidth },
      { height: window.innerHeight, width: window.innerWidth },
      { avoid, prefer: preferredSides(target), within },
    )
    callout.style.left = `${placement.left}px`
    callout.style.top = `${placement.top}px`
    callout.style.setProperty('--callout-pointer', `${placement.pointer}px`)
    callout.dataset.side = placement.side

    // What is watched for a change of size, and the sizes it is measured at.
    const sizes = new Map<Element, string>()
    observer.current?.disconnect()
    for (const element of [point, ...open]) {
      sizes.set(element, sizeOf(element))
      observer.current?.observe(element)
    }
    sizes.set(callout, `${callout.offsetWidth}x${callout.offsetHeight}`)
    observer.current?.observe(callout)
    measured.current = { open, sizes, where: whereOf(point) }
  }

  // The latest of both, for the listeners below, which are set up once.
  const latest = useRef({ look, place })
  latest.current = { look, place }

  // Listening starts before the first placing (effects of one kind run in the order written), so
  // that the first placing is also what starts the watching of sizes.
  useLayoutEffect(() => {
    if (target === undefined) return
    const changed = (entries: ResizeObserverEntry[]) => {
      const { sizes } = measured.current
      const callout = ref.current
      const moved = entries.some(({ target: element }) =>
        callout !== null && element === callout
          ? sizes.get(element) !== `${callout.offsetWidth}x${callout.offsetHeight}`
          : sizes.get(element) !== sizeOf(element),
      )
      if (moved) latest.current.place()
    }
    observer.current = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(changed)
    const onResize = () => latest.current.place()
    window.addEventListener('resize', onResize)
    // Something appeared or went: the target, or a menu or popover to keep clear of. Not text
    // (the Clock's minute) or attributes, which are most of what the page does.
    const watcher = new MutationObserver(() => {
      const callout = ref.current
      const now = latest.current.look()
      if (!callout || !now) return
      // Something opened or closed, or was added where it moved the target (a button in its bar).
      if (
        !sameElements(openThings(callout), measured.current.open) ||
        whereOf(now) !== measured.current.where
      ) {
        latest.current.place()
      }
    })
    watcher.observe(document.body, { childList: true, subtree: true })
    return () => {
      window.removeEventListener('resize', onResize)
      watcher.disconnect()
      observer.current?.disconnect()
      observer.current = null
    }
  }, [target])

  // What the page draws for the target, asked after every render.
  useLayoutEffect(() => {
    latest.current.look()
  })
  // Before paint, so the callout is never drawn for a frame where it was not put.
  useLayoutEffect(() => {
    latest.current.place()
  }, [found, watch, editing])

  return { present: target === undefined || found !== null, ref }
}
