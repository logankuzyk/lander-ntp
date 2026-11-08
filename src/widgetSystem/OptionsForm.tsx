import type { ComponentChildren } from 'preact'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'preact/hooks'

import { ColourPicker } from '@/components/ColourPicker/ColourPicker'
import { siteIconUrl as defaultSiteIconUrl } from '@/quickDial/siteIconUrl'
import { tidyUrl } from '@/quickDial/tidyUrl'

import { Choice } from './controls/Choice'
import { IconControl } from './controls/IconControl'
import { OrderedListControl } from './controls/OrderedListControl'
import { PickFromList } from './controls/PickFromList'
import { PlaceControl } from './controls/PlaceControl'
import { Switch } from './controls/Switch'
import type {
  ListEntry,
  OptionDescription,
  PageValueName,
  PageValueOption,
  PageValues,
  PlaceValue,
} from './definition'
import { CHECKING, recheckAll, useAsk, useRecheck, useUnmetNeed } from './needs'
import { readOptions, writeOptions } from './options'
import type { AnyWidgetDefinition } from './registry'

/** What to say under a page-wide value's switch: it is not this Widget's alone. */
const PAGE_VALUE_NOTES: Record<PageValueName, string> = {
  hour12: 'Applies to every time on the page.',
}

const isPageValue = (option: OptionDescription): option is PageValueOption =>
  option.control === 'switch' && option.shared !== undefined

type NeedGateProps = {
  /**
   * Draws the option's control, `held` while a need it depends on is not met, and with the id of
   * the line that says why (to describe the control by) when that line is shown.
   */
  children: (held: boolean, whyId: string | undefined) => ComponentChildren
  definition: AnyWidgetDefinition
  option: OptionDescription
  /** The Widget's options as they are read, which its needs are asked about. */
  options: Record<string, unknown>
}

/**
 * The button under a held-back option. When it goes while it has focus (it was pressed and the
 * need is met), `onGone` is told which option it was in, so focus can follow to the control.
 */
function NeedButton({
  label,
  onClick,
  onGone,
}: {
  label: string
  onClick: () => void
  onGone: (option: HTMLElement | null) => void
}) {
  const button = useRef<HTMLButtonElement>(null)
  const gone = useRef(onGone)
  gone.current = onGone
  useLayoutEffect(
    () => () => {
      const current = button.current
      if (current && document.activeElement === current) {
        gone.current(current.closest<HTMLElement>('[data-option]'))
      }
    },
    [],
  )
  return (
    <button class="settings__link" onClick={onClick} ref={button} type="button">
      {label}
    </button>
  )
}

/**
 * Holds an option back until the needs it depends on (`needs` on the option) are met, for a
 * control that would send something somewhere. While one is not it says so under the control,
 * "Do this first to set the place.", and, if the need has words and a way to ask the browser,
 * gives the same button the Widget's own setup button has. The control is held back from the
 * start (until the first answer) and the last answer stands while the needs are asked again, so
 * the control does not flicker; an option with no such needs is drawn as it is, at once.
 */
function NeedGate({ children, definition, option, options }: NeedGateProps) {
  const needs = useMemo(
    () => definition.needs?.filter(({ id }) => option.needs?.includes(id)),
    [definition, option],
  )
  const [rechecks] = useRecheck(needs !== undefined && needs.length > 0)
  const ask = useAsk(recheckAll)
  const unmet = useUnmetNeed(needs, options, rechecks)
  // What the last answer was, kept while the next is awaited.
  const answer = useRef<typeof unmet>(CHECKING)
  if (unmet !== CHECKING) answer.current = unmet
  const held = answer.current
  const whyId = useId()
  // Whether the line saying why is shown: a need is unmet, as opposed to still being looked up.
  const why = held !== null && held !== CHECKING
  const run = held && held !== CHECKING && held.action?.kind === 'ask' ? held.action.run : undefined

  // The button went while it had focus: the option's control takes it, once it is drawn as let
  // through (after this render, not while the button is being taken away).
  const gone = useRef<HTMLElement | null>(null)
  const handOff = useCallback((option: HTMLElement | null) => {
    gone.current = option
  }, [])
  useLayoutEffect(() => {
    const option = gone.current
    if (!option) return
    gone.current = null
    option.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)')?.focus()
  })

  return (
    <>
      {children(held !== null, why ? whyId : undefined)}
      {why && (
        <>
          <p class="settings__note" id={whyId}>
            Do this first to set the {option.label.toLowerCase()}.
          </p>
          {run && <NeedButton label={held.label ?? ''} onClick={() => ask(run)} onGone={handOff} />}
        </>
      )}
    </>
  )
}

type OptionsFormProps = {
  definition: AnyWidgetDefinition
  /**
   * Draws each Widget option as it is and passes no change on, not even one a control was waiting
   * on the browser for: for options that may not be changed.
   */
  disabled?: boolean
  /**
   * The id of the option to put focus on when the form appears: the first thing its control can
   * take focus on, such as the place search for a Weather that has no place.
   */
  focusOption?: string
  /** Injectable site icon address, so stories never make a request. */
  iconUrl?: (host: string) => string
  /** The Widget's whole options, with the change made: one call, and so one save, per change. */
  onChange: (options: Record<string, unknown>) => Promise<unknown> | void
  /** A page-wide value changed. It is the page's, so it does not go through `onChange`. */
  onPageValueChange: <N extends PageValueName>(name: N, value: PageValues[N]) => void
  /**
   * What is stored for the Widget. Read the way the Widget reads it; never written here. A change
   * is made on the options as of the last render, so whoever draws the form must hand the new
   * options back before the next change: two changes before that second one is made from the
   * old options, and the first is lost.
   */
  options: unknown
  page: PageValues
  /** Whether page-wide values may change, which follows the settings' own read-only state. */
  pageValuesDisabled?: boolean
}

/**
 * A Widget's options, drawn from its description with the shared controls. Each change is made
 * on the options as stored (`writeOptions`) and passed on whole, so unknown keys survive.
 *
 * An option backed by a page-wide value is shown from `page` and changed through
 * `onPageValueChange`, with a line saying it applies to the whole page.
 */
export function OptionsForm({
  definition,
  disabled = false,
  focusOption,
  iconUrl = defaultSiteIconUrl,
  onChange,
  onPageValueChange,
  options,
  page,
  pageValuesDisabled = disabled,
}: OptionsFormProps) {
  const form = useRef<HTMLDivElement>(null)
  const headings = useId()
  const read: Record<string, unknown> = readOptions(definition, options)

  // A change from a control that waited on the browser (the place, following the device) is made
  // on the options as they are when it comes, not as they were at the click, and not at all if
  // the form has been disabled since.
  const latest = useRef({ disabled, options, pageValuesDisabled })
  latest.current = { disabled, options, pageValuesDisabled }

  const change = (changes: Record<string, unknown>) => {
    if (latest.current.disabled) return Promise.resolve(false)
    return onChange(writeOptions(definition, latest.current.options, changes))
  }

  // Only when the form appears. The controls know nothing of their option's id, so each option
  // sits in an element that does, and the first control in it is the one to focus.
  useEffect(() => {
    if (focusOption === undefined) return
    const option = [...(form.current?.querySelectorAll<HTMLElement>('[data-option]') ?? [])].find(
      (element) => element.dataset.option === focusOption,
    )
    option?.querySelector<HTMLElement>('input, button')?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const control = (option: OptionDescription, held: boolean, whyId?: string) => {
    // The whole form is off, or this option is held back until a need is met.
    const off = held || disabled
    if (isPageValue(option)) {
      const pageValueOff = held || pageValuesDisabled
      const name = option.shared
      const invert = option.invert ?? false
      return (
        <>
          <Switch
            checked={page[name] !== invert}
            disabled={pageValueOff}
            label={option.label}
            onChange={(on) => {
              if (!latest.current.pageValuesDisabled) onPageValueChange(name, on !== invert)
            }}
          />
          <p class="settings__note">{PAGE_VALUE_NOTES[name]}</p>
        </>
      )
    }
    switch (option.control) {
      case 'choice':
        return (
          <Choice<string>
            choices={option.choices}
            disabled={off}
            label={option.label}
            onChange={(value) => change({ [option.id]: value })}
            value={read[option.id] as string}
          />
        )
      case 'colour':
        return (
          <ColourPicker
            disabled={off}
            label={option.label}
            onChange={(value) => change({ [option.id]: value })}
            value={read[option.id] as string}
          />
        )
      case 'icon':
        return (
          <IconControl
            disabled={off}
            onChange={(value) => change({ [option.id]: value })}
            siteIcon={
              typeof read.url === 'string' && tidyUrl(read.url)
                ? iconUrl(new URL(tidyUrl(read.url)!).hostname)
                : ''
            }
            value={read[option.id] as string | null}
          />
        )
      case 'orderedList': {
        const heading = `${headings}-${option.id}`
        return (
          <>
            <h3 id={heading}>{option.label}</h3>
            <OrderedListControl
              disabled={off}
              items={option.items}
              labelledBy={heading}
              onChange={(value) => change({ [option.id]: value })}
              value={read[option.id] as ListEntry[]}
            />
          </>
        )
      }
      case 'pick':
        return option.multiple ? (
          <PickFromList
            disabled={off}
            emptyText={option.emptyText}
            failedText={option.failedText}
            label={option.label}
            load={option.load}
            missingLabel={option.missingLabel}
            multiple
            onChange={(value) => change({ [option.id]: value })}
            value={read[option.id] as string[]}
            valueLabel={option.valueLabel}
          />
        ) : (
          <PickFromList
            disabled={off}
            emptyText={option.emptyText}
            failedText={option.failedText}
            label={option.label}
            load={option.load}
            missingLabel={option.missingLabel}
            onChange={(value) => change({ [option.id]: value })}
            value={read[option.id] as string}
            valueLabel={option.valueLabel}
          />
        )
      case 'place':
        return (
          <PlaceControl
            describedBy={whyId}
            disabled={off}
            // The search is the field the form puts focus on; it does so without suggesting.
            focusOnMount={option.id === focusOption}
            label={option.label}
            onChange={({ followDevice, place }) => change({ followDevice, place })}
            value={{ followDevice: read.followDevice, place: read.place } as PlaceValue}
          />
        )
      case 'switch':
        return (
          <Switch
            checked={read[option.id] as boolean}
            disabled={off}
            label={option.label}
            onChange={(value) => change({ [option.id]: value })}
          />
        )
      case 'text':
        return (
          <label class="settings__row settings__row--text">
            <span>{option.label}</span>
            <input
              class="settings__input"
              disabled={off}
              onInput={(event) => change({ [option.id]: event.currentTarget.value })}
              placeholder={option.placeholder}
              type="text"
              value={read[option.id] as string}
            />
          </label>
        )
    }
  }

  return (
    <div class={disabled ? 'options-form options-form--disabled' : 'options-form'} ref={form}>
      {definition.options.map((option) => (
        <div class="options-form__option" data-option={option.id} key={option.id}>
          <NeedGate definition={definition} option={option} options={read}>
            {(held, whyId) => control(option, held, whyId)}
          </NeedGate>
        </div>
      ))}
      {definition.credit && (
        <p class="settings__note options-form__credit">
          <a href={definition.credit.href}>{definition.credit.text}</a>
        </p>
      )}
    </div>
  )
}
