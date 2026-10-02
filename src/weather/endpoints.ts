import { manifestCache } from '@/photos/storage'

export type WeatherEndpoints = {
  /** False when the manifest has switched the weather off: nothing is fetched or shown. */
  enabled: boolean
  forecastUrl: string
  searchUrl: string
  /** Names the town at a device position; see weather/placeName. */
  placeNameUrl: string
}

/**
 * Weather and place search come from Open-Meteo: no key, and it answers with
 * `Access-Control-Allow-Origin: *`, so no host permissions either. Its data is CC BY 4.0, which
 * is why the settings credit it.
 */
export const DEFAULT_ENDPOINTS: WeatherEndpoints = {
  enabled: true,
  forecastUrl: 'https://api.open-meteo.com/v1/forecast',
  searchUrl: 'https://geocoding-api.open-meteo.com/v1/search',
  placeNameUrl: 'https://api-bdc.io/data/reverse-geocode-client',
}

/**
 * Where to ask for the weather. The photo manifest can move any of the addresses, or switch the
 * weather off, so a version already installed keeps working if Open-Meteo stops being
 * available to it: whatever takes over only has to answer the same requests in the same shape
 * (and send the same CORS header). Read from the cached manifest, which the photo rotation
 * keeps fresh, so a change arrives with the next manifest and costs no request of its own.
 */
export async function getEndpoints(): Promise<WeatherEndpoints> {
  const overrides = (await manifestCache.getValue())?.data.weather
  return {
    enabled: overrides?.enabled ?? DEFAULT_ENDPOINTS.enabled,
    forecastUrl: overrides?.forecastUrl ?? DEFAULT_ENDPOINTS.forecastUrl,
    searchUrl: overrides?.searchUrl ?? DEFAULT_ENDPOINTS.searchUrl,
    placeNameUrl: overrides?.placeNameUrl ?? DEFAULT_ENDPOINTS.placeNameUrl,
  }
}
