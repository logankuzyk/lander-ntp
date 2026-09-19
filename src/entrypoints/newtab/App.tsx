import { useCallback, useLayoutEffect, useState } from 'preact/hooks'

import { Background } from '@/components/Background/Background'
import { Controls } from '@/components/Controls/Controls'
import { SettingsPanel } from '@/components/SettingsPanel/SettingsPanel'
import { favouritesItem } from '@/favourites/storage'
import { preloadNext } from '@/photos/image'
import { usePhotoRotation } from '@/photos/usePhotoRotation'
import { fontStack } from '@/settings/fonts'
import { settingsItem } from '@/settings/storage'
import { useStorageItem } from '@/settings/useStorageItem'
import { Clock } from '@/widgets/Clock/Clock'
import { Favourites } from '@/widgets/Favourites/Favourites'
import { Gallery } from '@/widgets/Gallery/Gallery'
import { PhotoCredit } from '@/widgets/PhotoCredit/PhotoCredit'
import { PhotoInfo } from '@/widgets/PhotoInfo/PhotoInfo'

export function App() {
  const [settings, setSettings, settingsLoaded] = useStorageItem(settingsItem)
  const [favourites, setFavourites] = useStorageItem(favouritesItem)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [photoLoading, setPhotoLoading] = useState(false)
  // Wait for the stored frequency: the fallback is every-visit, which would move the photo on
  // in every new tab regardless of the setting.
  const { photos, photo, upcoming, next, select } = usePhotoRotation(
    settingsLoaded ? settings.frequency : null,
  )
  const canShowInfo = Boolean(photo)
  const canShowGallery = Boolean(photo) && photos.length > 1

  // The two popovers share a corner, so opening one closes the other.
  const toggleInfo = useCallback(() => {
    setGalleryOpen(false)
    setInfoOpen((open) => !open)
  }, [])
  const toggleGallery = useCallback(() => {
    setInfoOpen(false)
    setGalleryOpen((open) => !open)
  }, [])
  const closeInfo = useCallback(() => setInfoOpen(false), [])
  const closeGallery = useCallback(() => setGalleryOpen(false), [])

  // A photo picked by hand stays up: rotating would replace it in the next tab, or on a timer.
  // The frequency changes after the photo is stored, so nothing acts on the old one meanwhile.
  const choosePhoto = (id: string) => {
    void (async () => {
      await select(id)
      const latest = await settingsItem.getValue()
      if (latest.frequency !== 'off') setSettings({ ...latest, frequency: 'off' })
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
          photo={photo}
          dim={settings.dim}
          onLoad={() => {
            if (upcoming) preloadNext(upcoming)
          }}
          onLoadingChange={setPhotoLoading}
        />
      )}
      {/*
        Stored settings land a beat after the first paint. Drawing the defaults and then
        correcting them is a visible jolt — a clock that jumps fonts, or a bar that appears
        out of nowhere — so anything that depends on them waits for them. The photo already
        does: usePhotoRotation is held back until the frequency is known.
      */}
      {settingsLoaded && settings.favourites.enabled && (
        <Favourites
          favourites={favourites}
          style={settings.favourites.style}
          size={settings.favourites.size}
        />
      )}
      {settingsLoaded && settings.clock.enabled && <Clock {...settings.clock} />}
      {photo && <PhotoCredit photo={photo} />}
      {canShowInfo && photo && infoOpen && <PhotoInfo photo={photo} onClose={closeInfo} />}
      {canShowGallery && galleryOpen && (
        <Gallery
          photos={photos}
          currentId={photo?.id ?? null}
          onSelect={choosePhoto}
          onClose={closeGallery}
        />
      )}
      <Controls
        onNext={next}
        busy={photoLoading}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleGallery={canShowGallery ? toggleGallery : undefined}
        galleryOpen={galleryOpen}
        onToggleInfo={canShowInfo ? toggleInfo : undefined}
        infoOpen={infoOpen}
      />
      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          favourites={favourites}
          onFavouritesChange={setFavourites}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  )
}
