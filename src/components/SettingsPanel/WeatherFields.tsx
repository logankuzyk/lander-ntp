import type { WeatherField, WeatherFieldSetting } from '@/settings/schema'
import { OrderedListControl } from '@/widgetSystem/controls/OrderedListControl'

const ITEMS: readonly { id: WeatherField; label: string }[] = [
  { id: 'condition', label: 'Conditions' },
  { id: 'feelsLike', label: 'Feels like' },
  { id: 'highLow', label: 'High and low' },
  { id: 'location', label: 'Location' },
  { id: 'sun', label: 'Sunrise and sunset' },
]

type WeatherFieldsProps = {
  fields: readonly WeatherFieldSetting[]
  onChange: (fields: WeatherFieldSetting[]) => void
}

/**
 * The lines under the temperature, in the order the widget draws them, as the list under the
 * "Show" heading of the Weather section.
 */
export function WeatherFields({ fields, onChange }: WeatherFieldsProps) {
  return (
    <OrderedListControl
      items={ITEMS}
      labelledBy="weather-show-heading"
      onChange={onChange}
      value={fields}
    />
  )
}
