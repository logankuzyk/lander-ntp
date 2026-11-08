import { useEffect, useId, useRef, useState } from 'preact/hooks'

import { parseColour } from '@/backdrop/colour'
import { BACKGROUND_COLOURS } from '@/backdrop/storage'

type ColourPickerProps = {
  disabled?: boolean
  label: string
  onChange: (colour: string) => void
  onPreview?: (colour: string | null) => void
  value: string
}

/** The shared preset, custom and hex colour picker used by the Background and Quick dial. */
export function ColourPicker({
  disabled = false,
  label,
  onChange,
  onPreview,
  value,
}: ColourPickerProps) {
  const picker = useRef<HTMLInputElement>(null)
  const hexErrorId = useId()
  const [hex, setHex] = useState(value.replace('#', ''))
  const [pickerColour, setPickerColour] = useState(value)
  const [hexError, setHexError] = useState(false)

  useEffect(() => {
    setHex(value.replace('#', ''))
    setPickerColour(value)
  }, [value])

  const setColour = (colour: string, save: boolean) => {
    setPickerColour(colour)
    setHex(colour.replace('#', ''))
    setHexError(false)
    onPreview?.(colour)
    if (save) {
      onChange(colour)
      onPreview?.(null)
    }
  }
  const commitHex = () => {
    const colour = parseColour(hex)
    if (!colour) {
      setHexError(true)
      return
    }
    setColour(colour, true)
  }
  const custom = !BACKGROUND_COLOURS.some((colour) => colour.toLowerCase() === value.toLowerCase())

  return (
    <section aria-label={label}>
      <div aria-label={label} class="background-swatches" role="radiogroup">
        {BACKGROUND_COLOURS.map((colour, index) => (
          <label class="background-swatch" key={colour} title={`Colour ${index + 1}`}>
            <input
              aria-label={`Colour ${index + 1}`}
              checked={!custom && value.toLowerCase() === colour.toLowerCase()}
              disabled={disabled}
              name={`${label.toLowerCase().replaceAll(' ', '-')}-colour`}
              onChange={() => setColour(colour, true)}
              type="radio"
              value={colour}
            />
            <span aria-hidden="true" style={{ backgroundColor: colour }} />
          </label>
        ))}
        <label class="background-swatch" title="Custom colour">
          <input
            aria-label="Custom colour"
            checked={custom}
            disabled={disabled}
            name={`${label.toLowerCase().replaceAll(' ', '-')}-colour`}
            onChange={() => picker.current?.click()}
            type="radio"
          />
          <span aria-hidden="true" class="background-swatch__custom">
            +
          </span>
        </label>
      </div>
      <input
        aria-label="Choose custom colour"
        class="background-colour-picker"
        disabled={disabled}
        onCancel={() => {
          setPickerColour(value)
          setHex(value.replace('#', ''))
          setHexError(false)
          onPreview?.(null)
        }}
        onChange={(event) => setColour(event.currentTarget.value, true)}
        onInput={(event) => setColour(event.currentTarget.value, false)}
        ref={picker}
        type="color"
        value={pickerColour}
      />
      <label class="settings__row settings__row--text">
        <span>Hex colour</span>
        <input
          aria-describedby={hexError ? hexErrorId : undefined}
          aria-invalid={hexError}
          class="settings__input"
          disabled={disabled}
          maxLength={7}
          onBlur={commitHex}
          onInput={(event) => {
            setHex(event.currentTarget.value.replace(/^#/, ''))
            setHexError(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitHex()
          }}
          value={hex}
        />
      </label>
      {hexError && (
        <p class="settings__note" id={hexErrorId}>
          Use six digits, like 1a2b3c
        </p>
      )}
    </section>
  )
}
