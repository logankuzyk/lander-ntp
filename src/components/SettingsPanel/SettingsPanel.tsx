import { useEffect, useRef } from 'preact/hooks'

import type { Favourite } from '@/favourites/schema'

import { FREQUENCIES, type Frequency } from '@/photos/rotation'
import { FONTS, FONT_IDS, type FontId } from '@/settings/fonts'
import type { Settings } from '@/settings/schema'

import { FavouritesEditor } from './FavouritesEditor'

const FREQUENCY_LABELS: Record<Frequency, string> = {
  off: 'Never',
  'every-visit': 'Every new tab',
  '30s': 'Every 30 seconds',
  '1m': 'Every minute',
  '5m': 'Every 5 minutes',
  '15m': 'Every 15 minutes',
  '1h': 'Every hour',
  '6h': 'Every 6 hours',
  '12h': 'Every 12 hours',
  daily: 'Every day',
}

const FOCUSABLE = 'button, select, input, a[href]'

type ToggleProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label class="settings__row">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

type ChoiceProps<T extends string> = {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (value: T) => void
}

function Choice<T extends string>({ label, value, options, onChange }: ChoiceProps<T>) {
  return (
    <label class="settings__row">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value as T)}>
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}

type SettingsPanelProps = {
  settings: Settings
  onChange: (settings: Settings) => void
  favourites: Favourite[]
  onFavouritesChange: (favourites: Favourite[]) => void
  onClose: () => void
}

export function SettingsPanel({
  settings,
  onChange,
  favourites,
  onFavouritesChange,
  onClose,
}: SettingsPanelProps) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => {
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      // Keep Tab inside the dialog.
      if (event.key !== 'Tab' || !panel.current) return
      const focusable = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return

      const active = document.activeElement
      if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && (active === first || !panel.current.contains(active))) {
        event.preventDefault()
        last.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const clock = (changes: Partial<Settings['clock']>) =>
    onChange({ ...settings, clock: { ...settings.clock, ...changes } })

  const favouriteSettings = (changes: Partial<Settings['favourites']>) =>
    onChange({ ...settings, favourites: { ...settings.favourites, ...changes } })

  return (
    <div class="settings">
      {/* Convenience only: Escape and the close button cover keyboard users. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div class="settings__backdrop" aria-hidden="true" onClick={onClose} />
      <div
        class="settings__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        ref={panel}
      >
        <header class="settings__header">
          <h2>Settings</h2>
          <button
            type="button"
            class="settings__close"
            aria-label="Close settings"
            onClick={onClose}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <section>
          <h3>Photos</h3>
          <Choice
            label="New photo"
            value={settings.frequency}
            options={FREQUENCIES.map((id) => [id, FREQUENCY_LABELS[id]] as const)}
            onChange={(frequency) => onChange({ ...settings, frequency })}
          />
        </section>

        <section>
          <h3>Clock</h3>
          <Toggle
            label="Show clock"
            checked={settings.clock.enabled}
            onChange={(enabled) => clock({ enabled })}
          />
          <Toggle
            label="24-hour time"
            checked={!settings.clock.hour12}
            onChange={(h24) => clock({ hour12: !h24 })}
          />
          <Toggle
            label="Show date"
            checked={settings.clock.showDate}
            onChange={(showDate) => clock({ showDate })}
          />
          <Toggle
            label="Show seconds"
            checked={settings.clock.showSeconds}
            onChange={(showSeconds) => clock({ showSeconds })}
          />
        </section>

        <section>
          <h3>Favourites</h3>
          <Toggle
            label="Show favourites"
            checked={settings.favourites.enabled}
            onChange={(enabled) => favouriteSettings({ enabled })}
          />
          <Choice<Settings['favourites']['style']>
            label="Style"
            value={settings.favourites.style}
            options={[
              ['list', 'List'],
              ['grid', 'Grid'],
            ]}
            onChange={(style) => favouriteSettings({ style })}
          />
          <Choice<Settings['favourites']['size']>
            label="Size"
            value={settings.favourites.size}
            options={[
              ['s', 'Small'],
              ['m', 'Medium'],
              ['l', 'Large'],
            ]}
            onChange={(size) => favouriteSettings({ size })}
          />
          <FavouritesEditor favourites={favourites} onChange={onFavouritesChange} />
        </section>

        <section>
          <h3>Appearance</h3>
          <Choice<FontId>
            label="Font"
            value={settings.font}
            options={FONT_IDS.map((id) => [id, FONTS[id].label] as const)}
            onChange={(font) => onChange({ ...settings, font })}
          />
        </section>

        <section>
          <h3>Widgets</h3>
          <Toggle
            label="Show photo credit"
            checked={settings.widgets.credit}
            onChange={(credit) =>
              onChange({ ...settings, widgets: { ...settings.widgets, credit } })
            }
          />
          <Toggle
            label="Show photo details"
            checked={settings.widgets.info}
            onChange={(info) => onChange({ ...settings, widgets: { ...settings.widgets, info } })}
          />
        </section>
      </div>
    </div>
  )
}
