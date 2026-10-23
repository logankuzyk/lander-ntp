import { useId } from 'preact/hooks'

import { Select } from '@/components/Dropdown/Select'

type ChoiceProps<T extends string> = {
  /** The values to pick from, in the order to list them, each with what to call it. */
  choices: readonly { label: string; value: T }[]
  label: string
  onChange: (value: T) => void
  value: T
}

/** One of several values, as a row: the label, and a menu at the end. */
export function Choice<T extends string>({ choices, label, onChange, value }: ChoiceProps<T>) {
  const labelId = useId()
  return (
    <div class="settings__row">
      <span id={labelId}>{label}</span>
      <Select
        labelId={labelId}
        onChange={onChange}
        options={choices.map((choice) => [choice.value, choice.label] as const)}
        value={value}
      />
    </div>
  )
}
