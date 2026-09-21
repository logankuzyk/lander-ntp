import { useMemo, useRef, useState } from 'preact/hooks'

import { CloseIcon } from '@/components/Popover/CloseIcon'
import { useGrowOnScroll } from '@/components/Popover/useGrowOnScroll'
import { usePopover } from '@/components/Popover/usePopover'
import { FREQUENCIES, type Frequency, type PhotoSettings } from '@/photos/rotation'
import type { Photo } from '@/photos/schema'
import { availableTags } from '@/photos/tags'
import { FONTS, FONT_IDS, type FontId } from '@/settings/fonts'
import type { Settings } from '@/settings/schema'

import { Gallery } from './Gallery'

const FREQUENCY_LABELS: Record<Frequency, string> = {
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

/** The "Change photo" choice that pins the photo on screen. */
const NEVER = 'never'

const SECTIONS = [
  ['photos', 'Photos'],
  ['clock', 'Clock'],
  ['general', 'General'],
] as const

type SectionId = (typeof SECTIONS)[number][0]

type ToggleProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label class="settings__row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
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

type PhotosSectionProps = {
  settings: Settings
  onChange: (settings: Settings) => void
  photos: readonly Photo[]
  currentId: string | null
}

function PhotosSection({ settings, onChange, photos, currentId }: PhotosSectionProps) {
  const cycling = settings.photos
  const pinned = cycling.mode === 'pinned'
  const tags = useMemo(() => availableTags(photos), [photos])

  const update = (changes: Partial<PhotoSettings>) =>
    onChange({ ...settings, photos: { ...cycling, ...changes } })

  return (
    <>
      <section aria-labelledby="cycling-heading">
        <h3 id="cycling-heading">Cycling</h3>
        <Choice<Frequency | typeof NEVER>
          label="Change photo"
          value={pinned ? NEVER : cycling.frequency}
          options={[
            ...FREQUENCIES.map((id) => [id, FREQUENCY_LABELS[id]] as const),
            [NEVER, 'Never'],
          ]}
          onChange={(choice) =>
            choice === NEVER
              ? update({ mode: 'pinned', pinnedId: currentId })
              : update({ mode: 'cycle', frequency: choice })
          }
        />
        {tags.length > 0 && (
          <Choice
            label="Photos from"
            value={cycling.tag ?? ''}
            options={[['', 'All photos'], ...tags.map(({ slug, name }) => [slug, name] as const)]}
            // Choosing what to cycle is asking for cycling.
            onChange={(tag) => update({ mode: 'cycle', tag: tag || null })}
          />
        )}
        {pinned && (
          <p class="settings__note">
            Keeping this photo.{' '}
            <button type="button" class="settings__link" onClick={() => update({ mode: 'cycle' })}>
              Resume cycling
            </button>
          </p>
        )}
        <Toggle
          label="Dim the photo"
          checked={settings.dim}
          onChange={(dim) => onChange({ ...settings, dim })}
        />
      </section>

      {photos.length === 0 && <p class="settings__note">Loading photos…</p>}
      {photos.length > 1 && (
        <Gallery
          // Remounted when the cycled tag changes, so the filter follows it.
          key={cycling.tag ?? ''}
          photos={photos}
          currentId={currentId}
          initialTag={cycling.tag}
          onSelect={(id) => update({ mode: 'pinned', pinnedId: id })}
        />
      )}
    </>
  )
}

type SectionProps = {
  settings: Settings
  onChange: (settings: Settings) => void
}

function ClockSection({ settings, onChange }: SectionProps) {
  const clock = (changes: Partial<Settings['clock']>) =>
    onChange({ ...settings, clock: { ...settings.clock, ...changes } })

  return (
    <section>
      <Toggle
        label="Show clock"
        checked={settings.clock.enabled}
        onChange={(enabled) => clock({ enabled })}
      />
      {/* Out of the way of both the eye and Tab while the clock is off. */}
      {settings.clock.enabled && (
        <>
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
        </>
      )}
    </section>
  )
}

function GeneralSection({ settings, onChange }: SectionProps) {
  return (
    <section>
      <Choice<FontId>
        label="Font"
        value={settings.font}
        options={FONT_IDS.map((id) => [id, FONTS[id].label] as const)}
        onChange={(font) => onChange({ ...settings, font })}
      />
    </section>
  )
}

/**
 * The settings with a cycled tag that no photo carries read as all photos. It may have been
 * synced from a device with a newer manifest, or the photos may have lost it; either way it
 * filters nothing and has no choice to clear it by. Every section writes from these, so the
 * next change clears it. Left alone while the photos load, when no tag is known yet.
 */
function useKnownTag(settings: Settings, photos: readonly Photo[]): Settings {
  const { tag } = settings.photos
  const unknown =
    tag !== null &&
    photos.length > 0 &&
    !photos.some((photo) => photo.tags.some(({ slug }) => slug === tag))
  return useMemo(
    () => (unknown ? { ...settings, photos: { ...settings.photos, tag: null } } : settings),
    [settings, unknown],
  )
}

type SettingsPanelProps = {
  settings: Settings
  onChange: (settings: Settings) => void
  /** Every photo in the manifest, for the gallery. */
  photos: readonly Photo[]
  currentId: string | null
  onClose: () => void
}

/** Settings, in the popover corner above the controls. Opened with the gear button. */
export function SettingsPanel({
  settings,
  onChange,
  photos,
  currentId,
  onClose,
}: SettingsPanelProps) {
  const known = useKnownTag(settings, photos)
  const { container, close } = usePopover(onClose)
  const body = useRef<HTMLDivElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const [section, setSection] = useState<SectionId>('photos')
  const resetGrowth = useGrowOnScroll(container, body)

  // Each section starts at rest, from the top.
  const show = (id: SectionId) => {
    setSection(id)
    resetGrowth()
  }

  // Arrow keys move between tabs, as in any tab list; Tab moves on to the section.
  const onTabKeyDown = (event: KeyboardEvent, index: number) => {
    const last = SECTIONS.length - 1
    const target = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: last,
    }[event.key]
    if (target === undefined) return
    event.preventDefault()
    const wrapped = (target + SECTIONS.length) % SECTIONS.length
    const next = SECTIONS[wrapped]
    if (!next) return
    show(next[0])
    tabs.current[wrapped]?.focus()
  }

  return (
    <aside ref={container} class="popover settings" role="dialog" aria-label="Settings">
      <header class="popover__header">
        <h2>Settings</h2>
        <button
          ref={close}
          type="button"
          class="popover__close"
          aria-label="Close settings"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      <div class="settings__layout">
        <div class="settings__nav" role="tablist" aria-orientation="vertical">
          {SECTIONS.map(([id, label], index) => (
            <button
              key={id}
              ref={(el) => {
                tabs.current[index] = el
              }}
              type="button"
              role="tab"
              id={`settings-tab-${id}`}
              aria-controls="settings-section"
              aria-selected={section === id}
              tabIndex={section === id ? 0 : -1}
              class="settings__tab"
              onClick={() => show(id)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          ref={body}
          id="settings-section"
          class="settings__body"
          role="tabpanel"
          aria-labelledby={`settings-tab-${section}`}
        >
          {section === 'photos' && (
            <PhotosSection
              settings={known}
              onChange={onChange}
              photos={photos}
              currentId={currentId}
            />
          )}
          {section === 'clock' && <ClockSection settings={known} onChange={onChange} />}
          {section === 'general' && <GeneralSection settings={known} onChange={onChange} />}
        </div>
      </div>
    </aside>
  )
}
