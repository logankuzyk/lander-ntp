import { h } from 'preact'

import { DEFAULT_SETTINGS } from '@/settings/schema'
import type { WidgetDefinition, WidgetViewProps } from '@/widgetSystem/definition'

import { Clock } from './Clock'

/** What a Clock keeps of its own. The 12/24-hour switch is the page's, not the Clock's. */
export type ClockOptions = {
  showDate: boolean
  showSeconds: boolean
}

/** Hands the Clock its options and the page's time format. */
function ClockView({ options, page }: WidgetViewProps<ClockOptions>) {
  return h(Clock, {
    hour12: page.hour12,
    showDate: options.showDate,
    showSeconds: options.showSeconds,
  })
}

export const clockDefinition: WidgetDefinition<ClockOptions> = {
  name: 'Clock',
  // The order and wording are copied from the settings panel. Defaults come from today's
  // settings, so those cannot drift.
  options: [
    // Label and value are opposite: checked means hour12 is false. A form must invert it, as SettingsPanel does with !hour12.
    { control: 'switch', id: 'hour12', label: '24-hour time', shared: 'hour12' },
    {
      control: 'switch',
      default: DEFAULT_SETTINGS.clock.showDate,
      id: 'showDate',
      label: 'Show date',
    },
    {
      control: 'switch',
      default: DEFAULT_SETTINGS.clock.showSeconds,
      id: 'showSeconds',
      label: 'Show seconds',
    },
  ],
  // First guesses (LR-16): W8 fixes the smallest and largest by measuring.
  sizes: {
    largest: { h: 4, w: 8 },
    smallest: { h: 2, w: 3 },
    // Seconds need six columns. Both widths are even, so a new Clock is centred (LR-12).
    starting: (options) => ({ h: 2, w: options.showSeconds ? 6 : 4 }),
  },
  type: 'clock',
  View: ClockView,
}
