import { useCallback, useEffect, useRef, type MutableRef } from 'preact/hooks'

import { splitScroll, wheelPixels } from './growth'

/**
 * Makes a popover's scrolling area taller as it is scrolled down, with its top row held in
 * place, until the popover reaches its CSS max-height; only then does the area scroll. The
 * area's CSS reads the growth from `--popover-grow`.
 *
 * Only the wheel grows it: a wheel event can be taken over before anything moves, while undoing
 * a scroll after the fact shows the rows jump. Keys, the scrollbar and touch just scroll.
 *
 * Returns a reset, for when the area's content is swapped out.
 */
export function useGrowOnScroll(
  container: MutableRef<HTMLElement | null>,
  scroller: MutableRef<HTMLElement | null>,
) {
  const growth = useRef(0)

  useEffect(() => {
    const el = scroller.current
    const popover = container.current
    if (!el || !popover) return

    /** Room left to grow: no more than the rows still hidden below, or the popover allows. */
    const roomToGrow = () => {
      const hidden = el.scrollHeight - el.scrollTop - el.clientHeight
      const cap = parseFloat(getComputedStyle(popover).maxHeight) - popover.offsetHeight
      return Number.isNaN(cap) ? 0 : Math.max(0, Math.min(hidden, cap))
    }

    const onWheel = (event: WheelEvent) => {
      // Ctrl + wheel, and pinching a trackpad, zoom the page.
      if (event.ctrlKey) return
      const delta = wheelPixels(event, el.clientHeight)
      if (delta <= 0) return
      const { grow, scroll } = splitScroll(delta, roomToGrow())
      if (grow === 0) return
      event.preventDefault()
      // Set straight on the element: a render per wheel event would be wasted work.
      growth.current += grow
      el.style.setProperty('--popover-grow', `${growth.current}px`)
      el.scrollTop += scroll
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [container, scroller])

  return useCallback(() => {
    growth.current = 0
    scroller.current?.style.removeProperty('--popover-grow')
    if (scroller.current) scroller.current.scrollTop = 0
  }, [scroller])
}
