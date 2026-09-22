import { Chip } from '@/components/Chip/Chip'

import { Dropdown } from './Dropdown'

export type MultiSelectOption = { value: string; label: string }

type MultiSelectProps = {
  labelId: string
  options: readonly MultiSelectOption[]
  /** The chosen values, in the order they were chosen. Empty means all of them. */
  value: readonly string[]
  onChange: (value: string[]) => void
  /** What the field says when nothing is chosen. */
  allLabel: string
}

/**
 * Pick any number of options, like a Notion multi-select: the field shows them as chips, and
 * its menu has the chosen ones (each with a ×), the rest to add, and a reset back to all.
 */
export function MultiSelect({ labelId, options, value, onChange, allLabel }: MultiSelectProps) {
  const byValue = new Map(options.map((option) => [option.value, option]))
  // Chosen values the options no longer have (a tag taken off the site) are left out of view.
  const chosen = value.flatMap((id) => byValue.get(id) ?? [])
  const rest = options.filter((option) => !value.includes(option.value))

  const remove = (id: string) => onChange(value.filter((other) => other !== id))

  return (
    <Dropdown
      labelId={labelId}
      popup="dialog"
      chips
      value={
        chosen.length > 0 ? (
          chosen.map((option) => <Chip key={option.value} size="s" label={option.label} />)
        ) : (
          <Chip size="s" label={allLabel} />
        )
      }
    >
      {() => (
        <>
          {chosen.length > 0 && (
            <div class="dropdown__chosen" role="group" aria-label="Chosen">
              {chosen.map((option) => (
                <Chip
                  key={option.value}
                  size="s"
                  label={option.label}
                  onRemove={() => remove(option.value)}
                />
              ))}
            </div>
          )}
          <div class="dropdown__options" role="listbox" aria-multiselectable="true">
            {rest.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                class="dropdown__option"
                aria-selected={false}
                tabIndex={-1}
                onClick={() => onChange([...value, option.value])}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            class="dropdown__reset"
            disabled={value.length === 0}
            onClick={() => onChange([])}
          >
            Reset to {allLabel.toLowerCase()}
          </button>
        </>
      )}
    </Dropdown>
  )
}
