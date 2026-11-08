/** The optional lines under the temperature, in the order the widget draws them. */
export const WEATHER_FIELDS = ['location', 'condition', 'feelsLike', 'highLow', 'sun'] as const

export type WeatherField = (typeof WEATHER_FIELDS)[number]

export type WeatherFieldSetting = { id: WeatherField; shown: boolean }
