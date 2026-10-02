import { useCallback, useLayoutEffect, useState } from 'preact/hooks'

import { Background } from '@/components/Background/Background'
import { Controls } from '@/components/Controls/Controls'
import { SettingsPanel } from '@/components/SettingsPanel/SettingsPanel'
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

export function App() {
  const [settings, setSettings, settingsLoaded] = useStorageItem(settingsItem)
  const [popover, setPopover] = useState<Popover>(null)
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
          background={settings.weather.background}
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
          onChange={setSettings}
          onClose={close}
          photos={photos}
          settings={settings}
        />
      )}
      <Controls
        busy={photoLoading}
        infoOpen={popover === 'info'}
        onNext={showNext}
        onToggleInfo={photo ? () => toggle('info') : undefined}
        onToggleSettings={() => toggle('settings')}
        settingsOpen={popover === 'settings'}
      />
    </main>
  )
}
