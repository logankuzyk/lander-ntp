import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

import { useEditMode } from '@/components/EditMode/useEditMode'
import type { Rect } from '@/layout/geometry'

import type {
  PageValues,
  StateMessages,
  WidgetDefinition,
  WidgetSource,
  WidgetViewProps,
} from './definition'
import { accessibleName } from './name'
import { CHECKING, useUnmetNeed } from './needs'
import { readOptions } from './options'
import { useSourceState } from './source'
import { WidgetState } from './WidgetState'

type WidgetBoxProps<O, R, C> = {
  definition: WidgetDefinition<O, R, C>
  /** What is stored for this Widget, which may be missing or wrong; the definition reads it. */
  options: unknown
  page: PageValues
  /** The cells the Widget is drawn in: as the Grid says, not as stored. */
  rect: Rect
}

/**
 * The box a Widget sits in, on the Grid: the cells of its place, a size container for the
 * Widget to lay itself out in (see `.widget-box` in the page's styles), its content centred.
 * `widget` names what it holds, for a test or a rule in the styles to find it by.
 *
 * The box is a group named `name` (see `accessibleName`: "Weather, Victoria"), in and out of
 * edit mode. The name is fixed text, not a live region: a reader says it on reaching the box and
 * never when what is inside changes, such as the Clock's time. In edit mode the box is also a
 * frame, a tab stop with the name drawn in it. The boxes are in reading order in the document
 * (see Grid), which is the order Tab takes.
 */
export function Box({
  children,
  name,
  rect,
  widget,
}: {
  children?: ComponentChildren
  /** What people call it, such as "Clock" or "Weather, Victoria": read out, and drawn in edit mode. */
  name: string
  rect: Rect
  widget: string
}) {
  const { editing } = useEditMode()
  // Spread rather than written out: only while editing is the box a tab stop.
  const frame = editing ? { tabIndex: 0 } : {}
  return (
    <div
      aria-label={name}
      class="widget-box"
      data-widget={widget}
      role="group"
      style={{
        gridColumn: `${rect.col} / span ${rect.w}`,
        gridRow: `${rect.row} / span ${rect.h}`,
      }}
      {...frame}
    >
      {children}
      {editing && (
        <span aria-hidden="true" class="widget-box__name">
          {name}
        </span>
      )}
    </div>
  )
}

/**
 * How long a Widget with no reading waits before it says it is loading. A reading is usually
 * cached, and read in a few milliseconds, so a new tab never flashes "Loading" before it.
 */
export const LOADING_DELAY_MS = 400

/** Whether the tab is in view. A tab nobody is looking at checks nothing, so waits for nothing. */
function useVisible(): boolean {
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    // It may have changed between the first render and now.
    update()
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return visible
}

/**
 * Whether `waiting` has been true for `ms` for this `token`. Starts again when it goes false
 * and again, or the token changes, so a new reading asked for waits as long as the first did.
 */
function useWaited(waiting: boolean, token: string, ms: number): boolean {
  const [waitedFor, setWaitedFor] = useState<string | null>(null)
  useEffect(() => {
    if (!waiting) {
      setWaitedFor(null)
      return
    }
    const timer = setTimeout(() => setWaitedFor(token), ms)
    return () => clearTimeout(timer)
  }, [waiting, token, ms])
  return waiting && waitedFor === token
}

type SourcedViewProps<O, R, C> = {
  messages: StateMessages | undefined
  name: string
  options: O
  page: PageValues
  source: WidgetSource<O, R, C>
  View: WidgetDefinition<O, R, C>['View']
}

/**
 * Runs the Widget's source and draws its View with the reading, or, while there is none, what
 * the box says instead: nothing for the first 400 ms of loading (a cached reading has come by
 * then), then "loading"; at once "failed" (the fetch failed and nothing cached is recent
 * enough to show) or "off" (the photo manifest switched the source off). A reading, even a stale
 * one inside the source's limit, is drawn silently. A component of its own so that none of this
 * starts before the needs are met: hooks cannot be called conditionally, but a component can be
 * left out.
 */
function SourcedView<O, R, C>({
  messages,
  name,
  options,
  page,
  source,
  View,
}: SourcedViewProps<O, R, C>) {
  const { context, query } = source.useQuery(options)
  const { reading, status } = useSourceState(source.source, query)
  // Only time in view counts: a tab opened in the background has not started loading, as far as
  // anyone can tell, and must not flash "Loading" when it is looked at.
  const visible = useVisible()
  const waited = useWaited(status === 'loading' && visible, query?.key ?? '', LOADING_DELAY_MS)
  if (status === 'ready') {
    // `ready` is a reading to show; the check keeps the types honest.
    return reading === null ? null : (
      <View context={context} options={options} page={page} reading={reading} />
    )
  }
  if (status === 'loading' && !waited) return null
  return <WidgetState messages={messages} name={name} state={status} />
}

/**
 * Draws a Widget in its box on the Grid: its View, with its options read from what is stored
 * and the page's values. The box is always there, because it is the Widget's place; what is
 * in it is nothing while its needs are first checked or one is unmet. Once drawn, a Widget
 * stays drawn while they are checked again for new options. A Widget with a source has it run
 * once every need is met, and its View is drawn only with a reading; without one the box says
 * why (loading, failed or switched off: see `SourcedView`), in the same place and size.
 */
export function WidgetBox<O, R, C>({ definition, options, page, rect }: WidgetBoxProps<O, R, C>) {
  return (
    <Box
      name={accessibleName(definition, readOptions(definition, options))}
      rect={rect}
      widget={definition.type}
    >
      <Contents definition={definition} options={options} page={page} />
    </Box>
  )
}

/** What goes in the box. A component of its own, so that the box does not wait for its hooks. */
function Contents<O, R, C>({ definition, options, page }: Omit<WidgetBoxProps<O, R, C>, 'rect'>) {
  const { messages, name, source, View } = definition
  const read = readOptions(definition, options)
  const unmet = useUnmetNeed(definition.needs, read)
  // A Widget already drawn stays drawn while its needs are checked again for new options, so an
  // edit does not make it vanish and start over. Only an unmet need, or a first check, hides it.
  const drawn = useRef(false)
  const draw = unmet === null || (unmet === CHECKING && drawn.current)
  drawn.current = draw
  if (!draw) return null
  if (source) {
    return (
      <SourcedView
        messages={messages}
        name={name}
        options={read}
        page={page}
        source={source}
        View={View}
      />
    )
  }
  // No source, so no reading or context: they are the `undefined` that `R` and `C` default to.
  const props = { options: read, page } as WidgetViewProps<O, R, C>
  return <View {...props} />
}
