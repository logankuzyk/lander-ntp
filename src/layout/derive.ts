import type { Settings } from '@/settings/schema'
import { clockDefinition, type ClockOptions } from '@/widgets/Clock/definition'
import { weatherDefinition, type WeatherOptions } from '@/widgets/Weather/definition'
import type { AnyWidgetDefinition } from '@/widgetSystem/registry'

import { layoutWidget } from './check'
import { COLS } from './geometry'
import type { Layout, LayoutWidget, PlacedWidget, WaitingOptions } from './types'

/**
 * The ids of the Widgets a derived Layout holds: fixed for each type, not random, so that every
 * device works out the same bytes from the same settings, and the first change saves the ids
 * that were on screen. Eight characters, as `newId` makes. A Widget added later gets a random
 * one that is not any of these.
 */
const DERIVED_IDS = { clock: 'clock000', weather: 'weather0' } as const

/** The Clock sits on the middle rows, and the Weather in the top row (LR-16, answers 2 and 4). */
const CLOCK_ROW = 4
const WEATHER_ROW = 1

/** The Clock's options as the settings keep them. 12/24 hour is the page's, so it is not here. */
const clockOptions = ({ clock }: Settings): ClockOptions => ({
  showDate: clock.showDate,
  showSeconds: clock.showSeconds,
})

/** The Weather's options as the settings keep them, copied so that the two share nothing. */
const weatherOptions = ({ weather }: Settings): WeatherOptions =>
  structuredClone({
    fields: weather.fields,
    followDevice: weather.followDevice,
    place: weather.place,
    unit: weather.unit,
  })

/**
 * A Widget at the size its definition starts it at, in the row given. `column` says where its
 * left edge goes from its width, because the Clock centres and the Weather sits at the right.
 */
function place<O>(
  definition: AnyWidgetDefinition,
  id: string,
  options: O,
  row: number,
  column: (width: number) => number,
): LayoutWidget {
  const { h, w } = definition.sizes.starting(options)
  const placed: PlacedWidget = {
    col: column(w),
    h,
    id,
    options: options as Record<string, unknown>,
    row,
    type: definition.type,
    w,
  }
  return layoutWidget(placed)
}

/**
 * The Layout for settings stored by 0.2.x or by nothing at all: what the page draws while
 * `sync:layout` is empty, by LR-16's rules.
 *
 * - A Clock when `clock.enabled`, centred on rows 4 and 5, with its date and seconds: 4 by 2, or
 *   6 by 2 with seconds, as the Clock's definition starts it.
 * - A Weather when `weather.enabled`, whatever its reading, in the top right (columns 11 and
 *   12, rows 1 and 2), with its place, units, lines and whether it follows the device. Its size
 *   is its definition's (2 by 2 for everyone; owner answer 1 on LR-19 over LR-16's 2 by 1).
 * - A type not placed has its options kept, as waiting, for the first one added.
 *
 * Pure, and it writes nothing: the first change to the Layout stores all of this, and until
 * then every device works out the same from the same settings, and follows them. A new install
 * has no settings stored, and its defaults give the Clock alone.
 *
 * The page-wide 12/24-hour value, `clock.hour12`, is the page's, so it is in no Widget's options.
 */
export function deriveLayout(settings: Settings): Layout {
  const widgets: LayoutWidget[] = []
  const waiting: WaitingOptions = {}

  const clock = clockOptions(settings)
  if (settings.clock.enabled) {
    widgets.push(
      place(clockDefinition, DERIVED_IDS.clock, clock, CLOCK_ROW, (w) => (COLS - w) / 2 + 1),
    )
  } else {
    waiting.clock = clock
  }

  const weather = weatherOptions(settings)
  if (settings.weather.enabled) {
    widgets.push(
      place(weatherDefinition, DERIVED_IDS.weather, weather, WEATHER_ROW, (w) => COLS - w + 1),
    )
  } else {
    waiting.weather = weather
  }

  return {
    extra: {},
    ...(Object.keys(waiting).length === 0 ? {} : { waiting }),
    widgets,
  }
}
