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
  type LucideIcon,
  Moon,
  Snowflake,
  Sun,
} from 'lucide-preact'

import type { Condition } from '@/weather/conditions'

/** Day and night icons. Only the conditions that show the sky have a night of their own. */
const ICONS: Record<Condition, readonly [day: LucideIcon, night: LucideIcon]> = {
  clear: [Sun, Moon],
  drizzle: [CloudDrizzle, CloudDrizzle],
  fog: [CloudFog, CloudFog],
  'freezing-rain': [CloudHail, CloudHail],
  'heavy-showers': [CloudRainWind, CloudRainWind],
  overcast: [Cloudy, Cloudy],
  'partly-cloudy': [CloudSun, CloudMoon],
  rain: [CloudRain, CloudRain],
  showers: [CloudSunRain, CloudMoonRain],
  snow: [CloudSnow, CloudSnow],
  'snow-grains': [Snowflake, Snowflake],
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
