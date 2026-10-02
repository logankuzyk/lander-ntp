import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudMoonRain,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  CloudSunRain,
  Cloudy,
  Moon,
  Snowflake,
  Sun,
  type LucideIcon,
} from 'lucide-preact'

import type { Condition } from '@/weather/conditions'

/** Day and night icons. Only the conditions that show the sky have a night of their own. */
const ICONS: Record<Condition, readonly [day: LucideIcon, night: LucideIcon]> = {
  clear: [Sun, Moon],
  'partly-cloudy': [CloudSun, CloudMoon],
  overcast: [Cloudy, Cloudy],
  fog: [CloudFog, CloudFog],
  drizzle: [CloudDrizzle, CloudDrizzle],
  'freezing-rain': [CloudHail, CloudHail],
  rain: [CloudRain, CloudRain],
  snow: [CloudSnow, CloudSnow],
  'snow-grains': [Snowflake, Snowflake],
  showers: [CloudSunRain, CloudMoonRain],
  'heavy-showers': [CloudRainWind, CloudRainWind],
  thunderstorm: [CloudLightning, CloudLightning],
}

type ConditionIconProps = {
  condition: Condition
  isDay: boolean
  size: number
}

export function ConditionIcon({ condition, isDay, size }: ConditionIconProps) {
  const Icon = (ICONS[condition] ?? [Cloud, Cloud])[isDay ? 0 : 1]
  return <Icon aria-hidden="true" size={size} />
}
