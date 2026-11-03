import { CloseIcon } from '@/components/Popover/CloseIcon'
import type { Layout } from '@/layout/types'
import type { CalloutTarget } from '@/onboarding/target'
import { useLeave } from '@/onboarding/useLeave'

import { useBeside } from './useBeside'

type CalloutProps = {
  /** The one thing to do about it: move on, or go and set it up. */
  action: { label: string; onClick: () => void }
  body: string
  /** Where it sits: see the `callout--` modifiers in style.css. */
  class?: string
  /**
   * The Layout, for a callout with a `target`: a change to it can move the target without
   * changing its size, so the callout is placed again when this is a different one.
   */
  layout?: Layout
  onDismiss: () => void
  /** Where this is in a run of them, e.g. "2 of 4". */
  progress?: string
  /**
   * A thing on the page to sit beside, with a pointer at it (see `CalloutTarget`). The callout
   * is drawn only while the target is: with it missing or hidden, nothing is on the page. Not
   * with `class`: a callout with a target is placed by script, and the styles' modifier is for
   * one that sits at a fixed spot.
   */
  target?: CalloutTarget
  title: string
}

/**
 * A small note pointing something out: a stop on the welcome tour, or news of a feature. It
 * fades in, and fades out before either button does its work.
 *
 * With a `target` it is placed beside that thing on the page (see `useBeside`), and it keeps
 * its place in the document: it takes no focus, is not announced as it comes, and is as far
 * from the thing it points at in the Tab order as the page puts it. Without one it sits where
 * its `class` puts it.
 */
export function Callout({
  action,
  body,
  class: placement,
  layout,
  onDismiss,
  progress,
  target,
  title,
}: CalloutProps) {
  const { leave, leaving } = useLeave()
  const { present, ref } = useBeside(target, layout)
  if (!present) return null
  const classes = [
    'callout',
    target !== undefined && 'callout--beside',
    placement,
    leaving && 'callout--leaving',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div class={classes} ref={ref} role="note">
      <div class="callout__header">
        <strong>{title}</strong>
        <button
          aria-label="Dismiss"
          class="popover__close"
          onClick={() => leave(onDismiss)}
          type="button"
        >
          <CloseIcon />
        </button>
      </div>
      <p>{body}</p>
      <div class="callout__footer">
        {progress && <span class="callout__progress">{progress}</span>}
        <button class="callout__action" onClick={() => leave(action.onClick)} type="button">
          {action.label}
        </button>
      </div>
    </div>
  )
}
