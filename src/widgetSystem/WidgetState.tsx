import type { StateMessages } from './definition'
import type { SourceStatus } from './source'

/** The states a box draws in place of a Widget's View. */
export type BoxState = Exclude<SourceStatus, 'ready'>

/** What the box says when a definition does not say it. */
export const DEFAULT_MESSAGES: Required<StateMessages> = {
  failed: "Can't load this",
  loading: 'Loading',
  off: 'Switched off for now',
}

type WidgetStateProps = {
  messages?: StateMessages
  /** The Widget's name, as people read it. */
  name: string
  state: BoxState
}

/**
 * What a Widget's box shows in place of its View when there is nothing to show: a small
 * translucent panel, in the popovers' look, with the Widget's name and one line. One style
 * for every Widget (see `.widget-state` in the page's styles); the box it sits in keeps its
 * size, and the panel is centred in it like any other content.
 */
export function WidgetState({ messages, name, state }: WidgetStateProps) {
  return (
    <div class="widget-state" data-state={state} role="status">
      <p class="widget-state__name">{name}</p>
      <p class="widget-state__message">{messages?.[state] ?? DEFAULT_MESSAGES[state]}</p>
    </div>
  )
}
