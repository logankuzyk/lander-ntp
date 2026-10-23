type SwitchProps = {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}

/**
 * On or off, as a row: the label, and the switch at the end. What it says is what the label
 * says, so an option worded the other way round from the value it holds (such as "24-hour
 * time" for `hour12`) is inverted by whoever draws it, not here.
 */
export function Switch({ checked, label, onChange }: SwitchProps) {
  return (
    <label class="settings__row">
      <span>{label}</span>
      <input
        checked={checked}
        class="switch"
        onChange={(event) => onChange(event.currentTarget.checked)}
        role="switch"
        type="checkbox"
      />
    </label>
  )
}
