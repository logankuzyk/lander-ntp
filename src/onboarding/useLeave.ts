import { useEffect, useRef, useState } from 'preact/hooks'

/** Keep in sync with `--onboarding-fade` in entrypoints/newtab/style.css. */
export const FADE_MS = 200

const stillness = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * Lets something fade out before it acts on a press. `leave(then)` sets `leaving`, which the
 * styles fade on, and calls `then` once the fade is done; whatever is still on the page after
 * that fades back in. Presses during the fade are ignored, and nothing waits when motion is
 * turned down.
 */
export function useLeave() {
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const leave = (then: () => void) => {
    if (leaving) return
    if (stillness()) return then()
    setLeaving(true)
    timer.current = setTimeout(() => {
      then()
      setLeaving(false)
    }, FADE_MS)
  }

  return { leave, leaving }
}
