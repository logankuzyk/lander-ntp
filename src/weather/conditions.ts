/** What the sky is doing, reduced from the forecast's WMO weather codes to what has an icon. */
export type Condition =
  | 'clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'freezing-rain'
  | 'rain'
  | 'snow'
  | 'snow-grains'
  | 'showers'
  | 'heavy-showers'
  | 'thunderstorm'

/** WMO code (as Open-Meteo reports it) to condition and the words for it. */
const CODES: Record<number, readonly [Condition, string]> = {
  0: ['clear', 'Clear'],
  1: ['partly-cloudy', 'Mostly clear'],
  2: ['partly-cloudy', 'Partly cloudy'],
  3: ['overcast', 'Overcast'],
  45: ['fog', 'Fog'],
  48: ['fog', 'Freezing fog'],
  51: ['drizzle', 'Light drizzle'],
  53: ['drizzle', 'Drizzle'],
  55: ['drizzle', 'Heavy drizzle'],
  56: ['freezing-rain', 'Freezing drizzle'],
  57: ['freezing-rain', 'Freezing drizzle'],
  61: ['rain', 'Light rain'],
  63: ['rain', 'Rain'],
  65: ['rain', 'Heavy rain'],
  66: ['freezing-rain', 'Freezing rain'],
  67: ['freezing-rain', 'Freezing rain'],
  71: ['snow', 'Light snow'],
  73: ['snow', 'Snow'],
  75: ['snow', 'Heavy snow'],
  77: ['snow-grains', 'Snow grains'],
  80: ['showers', 'Light showers'],
  81: ['showers', 'Showers'],
  82: ['heavy-showers', 'Heavy showers'],
  85: ['snow', 'Snow showers'],
  86: ['snow', 'Heavy snow showers'],
  95: ['thunderstorm', 'Thunderstorm'],
  96: ['thunderstorm', 'Thunderstorm with hail'],
  99: ['thunderstorm', 'Thunderstorm with hail'],
}

/** A code the table doesn't know reads as cloud: unremarkable, and never wrong by much. */
export const describeCode = (code: number): { condition: Condition; label: string } => {
  const [condition, label] = CODES[code] ?? (['overcast', 'Cloudy'] as const)
  return { condition, label }
}
