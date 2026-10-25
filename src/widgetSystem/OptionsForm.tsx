import { useEffect, useId, useRef } from 'preact/hooks'

import { Choice } from './controls/Choice'
import { OrderedListControl } from './controls/OrderedListControl'
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
import { readOptions, writeOptions } from './options'
import type { AnyWidgetDefinition } from './registry'

/** What to say under a page-wide value's switch: it is not this Widget's alone. */
const PAGE_VALUE_NOTES: Record<PageValueName, string> = {
  hour12: 'Applies to every time on the page.',
}

const isPageValue = (option: OptionDescription): option is PageValueOption =>
  option.control === 'switch' && option.shared !== undefined

type OptionsFormProps = {
  definition: AnyWidgetDefinition
  /** Draws every control as it is, and passes no change on: for options that may not be changed. */
  disabled?: boolean
  /**
   * The id of the option to put focus on when the form appears: the first thing its control can
   * take focus on, such as the place search for a Weather that has no place.
   */
  focusOption?: string
  /** The Widget's whole options, with the change made: one call, and so one save, per change. */
  onChange: (options: Record<string, unknown>) => void
  /** A page-wide value changed. It is the page's, so it does not go through `onChange`. */
  onPageValueChange: <N extends PageValueName>(name: N, value: PageValues[N]) => void
  /** What is stored for the Widget. Read the way the Widget reads it; never written here. */
  options: unknown
  page: PageValues
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
  onChange,
  onPageValueChange,
  options,
  page,
}: OptionsFormProps) {
  const form = useRef<HTMLDivElement>(null)
  const headings = useId()
  const read: Record<string, unknown> = readOptions(definition, options)

  // A change from a control that waited on the browser (the place, following the device) is made
  // on the options as they are when it comes, not as they were at the click.
  const latest = useRef(options)
  latest.current = options

  const change = (changes: Record<string, unknown>) => {
    onChange(writeOptions(definition, latest.current, changes))
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

  const control = (option: OptionDescription) => {
    if (isPageValue(option)) {
      const name = option.shared
      const invert = option.invert ?? false
      return (
        <>
          <Switch
            checked={page[name] !== invert}
            disabled={disabled}
            label={option.label}
            onChange={(on) => onPageValueChange(name, on !== invert)}
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
            disabled={disabled}
            label={option.label}
            onChange={(value) => change({ [option.id]: value })}
            value={read[option.id] as string}
          />
        )
      case 'orderedList': {
        const heading = `${headings}-${option.id}`
        return (
          <>
            <h3 id={heading}>{option.label}</h3>
            <OrderedListControl
              disabled={disabled}
              items={option.items}
              labelledBy={heading}
              onChange={(value) => change({ [option.id]: value })}
              value={read[option.id] as ListEntry[]}
            />
          </>
        )
      }
      case 'place':
        return (
          <PlaceControl
            disabled={disabled}
            label={option.label}
            onChange={({ followDevice, place }) => change({ followDevice, place })}
            value={{ followDevice: read.followDevice, place: read.place } as PlaceValue}
          />
        )
      case 'switch':
        return (
          <Switch
            checked={read[option.id] as boolean}
            disabled={disabled}
            label={option.label}
            onChange={(value) => change({ [option.id]: value })}
          />
        )
    }
  }

  return (
    <div class={disabled ? 'options-form options-form--disabled' : 'options-form'} ref={form}>
      {definition.options.map((option) => (
        <div class="options-form__option" data-option={option.id} key={option.id}>
          {control(option)}
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
