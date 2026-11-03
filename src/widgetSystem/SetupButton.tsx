import { useRef } from 'preact/hooks'

import type { Need, NeedAction } from './needs'
import { useOptionsPopover } from './useOptionsPopover'

/** A need that says what to tell people and what pressing the button does. */
export type SetupNeed<O> = Need<O> & { action: NeedAction; label: string }

/** Whether a need has the words and the action the setup button is drawn from. */
export const hasSetup = <O,>(need: Need<O>): need is SetupNeed<O> =>
  need.action !== undefined && need.label !== undefined

type SetupButtonProps<O> = {
  /** The id the Widget is stored under, which its options are opened by. */
  id?: string
  /** The Widget's name, as people read it: "Weather". */
  name: string
  /** The need to meet. */
  need: SetupNeed<O>
  /** The action asked the browser and it has answered: the needs are to be asked again. */
  onAsked: () => void
}

/**
 * The button a Widget shows in place of its content while a need is unmet: the Widget's name and
 * the need's words, in the page's panel look (see `.widget-setup` in the page's styles), centred
 * in the box. Its accessible name is what it shows, name first, with a comma between ("Weather, Choose a place"); the
 * box around it is the group that names the Widget.
 *
 * What pressing it does is the need's action. To open the options it is a toggle, as the Options
 * button is: pressed again it closes them. To ask the browser it calls `run` first of all, with
 * nothing awaited before it, since Firefox shows its prompt only from a click's own call, and
 * it does not ask again while the first is waiting.
 */
export function SetupButton<O>({ id, name, need, onAsked }: SetupButtonProps<O>) {
  const options = useOptionsPopover()
  const { action, label } = need
  // Not state: a second press in the same moment must see it, before any render.
  const asking = useRef(false)
  // What it shows, with a comma between: left to work out from its spans, a browser reads the two
  // lines as one run ("Weather Choose a place") or puts the comma where it was not written.
  const accessibleName = `${name}, ${label}`
  const words = (
    <>
      <span class="widget-setup__name">{name}</span>
      <span class="widget-setup__label">{label}</span>
    </>
  )

  if (action.kind === 'option') {
    const available = options.available && id !== undefined
    const open = available && options.openId === id
    return (
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={accessibleName}
        class="widget-setup"
        // What a callout points at (see onboarding/target).
        data-callout-target="setup"
        // Opens and closes the popover itself, so pressing it isn't a click outside.
        data-popover-toggle
        disabled={!available}
        onClick={() => {
          if (id === undefined || !available) return
          if (open) options.close()
          else options.open(id, action.option)
        }}
        type="button"
      >
        {words}
      </button>
    )
  }

  return (
    <button
      aria-label={accessibleName}
      class="widget-setup"
      // What a callout points at (see onboarding/target).
      data-callout-target="setup"
      onClick={() => {
        if (asking.current) return
        asking.current = true
        let answer: unknown
        try {
          // First, before anything is awaited or drawn: the browser's prompt needs the click.
          answer = action.run()
        } catch {
          asking.current = false
          return
        }
        void Promise.resolve(answer).then(
          () => {
            asking.current = false
            onAsked()
          },
          () => {
            asking.current = false
          },
        )
      }}
      type="button"
    >
      {words}
    </button>
  )
}
