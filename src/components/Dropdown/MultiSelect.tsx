import { Chip } from '@/components/Chip/Chip'

import { Dropdown } from './Dropdown'

export type MultiSelectOption = { label: string; value: string }

type MultiSelectProps = {
  /** What the field says when nothing is chosen. */
  allLabel: string
  labelId: string
  onChange: (value: string[]) => void
  options: readonly MultiSelectOption[]
  /** The chosen values, in the order they were chosen. Empty means all of them. */
  value: readonly string[]
}

/**
 * Pick any number of options, like a Notion multi-select: the field shows them as chips, and
 * its menu has the chosen ones (each with a ×), the rest to add, and a reset back to all.
 */
export function MultiSelect({ allLabel, labelId, onChange, options, value }: MultiSelectProps) {
  const byValue = new Map(options.map((option) => [option.value, option]))
  // Chosen values the options no longer have (a tag taken off the site) are left out of view.
  const chosen = value.flatMap((id) => byValue.get(id) ?? [])
  const rest = options.filter((option) => !value.includes(option.value))

  const remove = (id: string) => onChange(value.filter((other) => other !== id))

  return (
    <Dropdown
      chips
      labelId={labelId}
      popup="dialog"
      value={
        chosen.length > 0 ? (
          chosen.map((option) => <Chip key={option.value} label={option.label} size="s" />)
        ) : (
          <Chip label={allLabel} size="s" />
        )
      }
    >
      {() => (
        <>
          {chosen.length > 0 && (
            <div aria-label="Chosen" class="dropdown__chosen" role="group">
              {chosen.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  onRemove={() => remove(option.value)}
                  size="s"
                />
              ))}
            </div>
          )}
          <div aria-multiselectable="true" class="dropdown__options" role="listbox">
            {rest.map((option) => (
              <button
                aria-selected={false}
                class="dropdown__option"
                key={option.value}
                onClick={() => onChange([...value, option.value])}
                role="option"
                tabIndex={-1}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            class="dropdown__reset"
            disabled={value.length === 0}
            onClick={() => onChange([])}
            type="button"
          >
            Reset to {allLabel.toLowerCase()}
          </button>
        </>
      )}
    </Dropdown>
  )
}
