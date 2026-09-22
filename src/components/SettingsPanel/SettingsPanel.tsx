import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks'

import { MultiSelect } from '@/components/Dropdown/MultiSelect'
import { Select } from '@/components/Dropdown/Select'
import { CloseIcon } from '@/components/Popover/CloseIcon'
import { useGrowOnScroll } from '@/components/Popover/useGrowOnScroll'
import { usePopover } from '@/components/Popover/usePopover'
import { FREQUENCIES, type Frequency, type PhotoSettings } from '@/photos/rotation'
import type { Photo } from '@/photos/schema'
import { availableTags } from '@/photos/tags'
import { FONTS, FONT_IDS, type FontId } from '@/settings/fonts'
import type { Settings } from '@/settings/schema'
import { browserConsent, setBrowserConsent, telemetryBuilt } from '@/telemetry/consent'

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
  const labelId = useId()
  return (
    <div class="settings__row">
      <span id={labelId}>{label}</span>
      <Select labelId={labelId} value={value} options={options} onChange={onChange} />
    </div>
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

  const tagsLabel = useId()

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
        {/* Only while cycling. The tags are kept while a photo is pinned, for when it resumes. */}
        {!pinned && tags.length > 0 && (
          <div class="settings__row settings__row--wrap">
            <span id={tagsLabel}>Tags</span>
            <MultiSelect
              labelId={tagsLabel}
              options={tags.map(({ slug, name }) => ({ value: slug, label: name }))}
              value={cycling.tags}
              onChange={(chosen) => update({ tags: chosen })}
              allLabel="All"
            />
          </div>
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
          // Remounted when the cycled tags change, so the filter follows them.
          key={cycling.tags.join(' ')}
          photos={photos}
          currentId={currentId}
          initialTag={cycling.tags.length === 1 ? (cycling.tags[0] ?? null) : null}
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

/**
 * The usage data switch. On Firefox it also drives the browser's own consent, which gates
 * sending as well, so the switch shows the two together and flipping it sets both.
 */
function UsageData({ enabled, onEnabledChange }: PrivacyProps) {
  // Undefined until known; null where the browser has no consent of its own (Chrome, Edge).
  const [browserAllows, setBrowserAllows] = useState<boolean | null>()

  useEffect(() => {
    let active = true
    browserConsent()
      .catch(() => null)
      .then((allows) => {
        if (active) setBrowserAllows(allows)
      })
    return () => {
      active = false
    }
  }, [])

  const onChange = (next: boolean) => {
    onEnabledChange(next)
    if (browserAllows === null || browserAllows === undefined) return
    setBrowserConsent(next)
      .catch(() => !next)
      .then(setBrowserAllows)
  }

  return (
    <section aria-labelledby="privacy-heading">
      <h3 id="privacy-heading">Privacy</h3>
      <Toggle
        label="Share usage data"
        checked={enabled && browserAllows !== false}
        onChange={onChange}
      />
      <p class="settings__note">
        A daily check-in with your settings, tagged with a random id for this browser. Never the
        sites you visit.
      </p>
    </section>
  )
}

type PrivacyProps = {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
}

function GeneralSection({ settings, onChange }: SectionProps) {
  return (
    <>
      <section>
        <Choice<FontId>
          label="Font"
          value={settings.font}
          options={FONT_IDS.map((id) => [id, FONTS[id].label] as const)}
          onChange={(font) => onChange({ ...settings, font })}
        />
      </section>

      {/* A build without telemetry has nothing to switch. */}
      {telemetryBuilt() && (
        <UsageData
          enabled={settings.telemetry}
          onEnabledChange={(telemetry) => onChange({ ...settings, telemetry })}
        />
      )}
    </>
  )
}

/**
 * The settings without any cycled tag that no photo carries. They may have been synced from a
 * device with a newer manifest, or the photos may have lost them; either way they filter
 * nothing and there is no chip to clear them by. Every section writes from these, so the next
 * change clears them. Left alone while the photos load, when no tag is known yet.
 */
function useKnownTags(settings: Settings, photos: readonly Photo[]): Settings {
  const { tags } = settings.photos
  const known =
    photos.length === 0
      ? tags
      : tags.filter((slug) => photos.some((photo) => photo.tags.some((tag) => tag.slug === slug)))
  const changed = known.length !== tags.length
  return useMemo(
    () => (changed ? { ...settings, photos: { ...settings.photos, tags: known } } : settings),
    // `known` is rebuilt on every render; its length changing is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, changed],
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
  const known = useKnownTags(settings, photos)
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
