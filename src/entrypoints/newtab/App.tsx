import { useCallback, useLayoutEffect, useState } from 'preact/hooks'

import { Background } from '@/components/Background/Background'
import { Callout } from '@/components/Callout/Callout'
import { Controls } from '@/components/Controls/Controls'
import { type SectionId, SettingsPanel } from '@/components/SettingsPanel/SettingsPanel'
import { Welcome } from '@/components/Welcome/Welcome'
import { TOUR } from '@/onboarding/callouts'
import { onboardingItem } from '@/onboarding/storage'
import { useNews } from '@/onboarding/useNews'
import { preloadNext } from '@/photos/image'
import { usePhotoRotation } from '@/photos/usePhotoRotation'
import { fontStack } from '@/settings/fonts'
import { settingsItem } from '@/settings/storage'
import { useStorageItem } from '@/settings/useStorageItem'
import { useWeather } from '@/weather/useWeather'
import { Clock } from '@/widgets/Clock/Clock'
import { PhotoCredit } from '@/widgets/PhotoCredit/PhotoCredit'
import { PhotoInfo } from '@/widgets/PhotoInfo/PhotoInfo'
import { Weather } from '@/widgets/Weather/Weather'

/** The popovers share the corner above the controls, so only one is open at a time. */
type Popover = 'info' | 'settings' | null

/** How the settings were opened: on which section, and whether with the welcome tour. */
type SettingsEntry = { section: SectionId; tour: boolean }

const FROM_GEAR: SettingsEntry = { section: 'photos', tour: false }

export function App() {
  const [settings, setSettings, settingsLoaded] = useStorageItem(settingsItem)
  const [onboarding, setOnboarding] = useStorageItem(onboardingItem)
  const [popover, setPopover] = useState<Popover>(null)
  const [entry, setEntry] = useState<SettingsEntry>(FROM_GEAR)
  const [photoLoading, setPhotoLoading] = useState(false)
  // Wait for the stored settings: the fallback is every-visit, which would move the photo on
  // in every new tab regardless of the setting.
  const { next, photo, photos, upcoming } = usePhotoRotation(
    settingsLoaded ? settings.photos : null,
  )

  // Likewise held back, so nothing is fetched for a widget that turns out to be switched off.
  const weather = useWeather(settingsLoaded ? settings.weather : null)

  const toggle = (which: Exclude<Popover, null>) =>
    setPopover((open) => (open === which ? null : which))
  const close = useCallback(() => setPopover(null), [])
  const openSettings = (how: SettingsEntry) => {
    setEntry(how)
    setPopover('settings')
  }

  // Out of the way while a popover has the corner, and until the welcome has been answered.
  const news = useNews(popover === null ? onboarding : null, settingsLoaded ? settings : null)
  const dismiss = (id: string) => {
    if (onboarding) setOnboarding({ ...onboarding, dismissed: [...onboarding.dismissed, id] })
  }

  // While a photo is pinned, → pins the next one instead, so the next tab keeps it too.
  const showNext = () => {
    void (async () => {
      const id = await next()
      const latest = await settingsItem.getValue()
      if (id && latest.photos.mode === 'pinned' && latest.photos.pinnedId !== id) {
        setSettings({ ...latest, photos: { ...latest.photos, pinnedId: id } })
      }
    })()
  }

  // Before paint, so the clock is never drawn in one font and then redrawn in another.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--font-display', fontStack(settings.font))
  }, [settings.font])

  return (
    <main class="app">
      {photo && (
        <Background
          dim={settings.dim}
          onLoad={() => {
            if (upcoming) preloadNext(upcoming)
          }}
          onLoadingChange={setPhotoLoading}
          photo={photo}
        />
      )}
      {/*
        Stored settings land a beat after the first paint. Drawing the defaults and then
        correcting them is a visible jolt — a clock that jumps fonts, say — so anything that
        depends on them waits for them. The photo already does: usePhotoRotation is held back
        until the settings are known.
      */}
      {settingsLoaded && settings.clock.enabled && <Clock {...settings.clock} />}
      {weather && (
        <Weather
          fields={settings.weather.fields}
          hour12={settings.clock.hour12}
          place={weather.place}
          weather={weather.weather}
        />
      )}
      {photo && <PhotoCredit photo={photo} />}
      {photo && popover === 'info' && <PhotoInfo onClose={close} photo={photo} />}
      {popover === 'settings' && (
        <SettingsPanel
          currentId={photo?.id ?? null}
          initialSection={entry.section}
          onChange={setSettings}
          onClose={close}
          photos={photos}
          settings={settings}
          tour={entry.tour ? TOUR : undefined}
        />
      )}
      {news && (
        <Callout
          action={{
            label: 'Set up',
            onClick: () => {
              dismiss(news.id)
              openSettings({ section: news.section, tour: false })
            },
          }}
          body={news.body}
          class={`callout--${news.section}`}
          onDismiss={() => dismiss(news.id)}
          title={news.title}
        />
      )}
      {onboarding && !onboarding.welcomed && (
        <Welcome
          onSkip={() => setOnboarding({ ...onboarding, welcomed: true })}
          onTour={() => {
            setOnboarding({ ...onboarding, welcomed: true })
            openSettings({ section: 'photos', tour: true })
          }}
        />
      )}
      <Controls
        busy={photoLoading}
        infoOpen={popover === 'info'}
        onNext={showNext}
        onToggleInfo={photo ? () => toggle('info') : undefined}
        onToggleSettings={() => {
          setEntry(FROM_GEAR)
          toggle('settings')
        }}
        settingsOpen={popover === 'settings'}
      />
    </main>
  )
}
