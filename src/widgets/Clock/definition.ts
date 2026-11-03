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
  // The wording is copied from the settings panel; the page-wide switch comes last, as the
  // Weather's does. Defaults come from today's settings, so those cannot drift.
  options: [
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
    // Label and value are opposite: checked means hour12 is false, so a form inverts it.
    { control: 'switch', id: 'hour12', invert: true, label: '24-hour time', shared: 'hour12' },
  ],
  // Measured in Storybook (LR-86), in all four fonts at 1440 by 900, 1366 by 768 and 1280 by 720.
  // The smallest holds seconds and the date: at 1280 by 720, where a cell is about 103 by 79 px,
  // 3 by 2 gives digits near 64px and a 12px date, even in the widest font. Narrower is under 45px.
  // The Clock fills any box (it is as big as fits across and down), so nothing past 8 by 4 is
  // needed to show it well.
  sizes: {
    largest: { h: 4, w: 8 },
    smallest: { h: 2, w: 3 },
    // Seconds need six columns. Both widths are even, so a new Clock is centred (LR-12).
    starting: (options) => ({ h: 2, w: options.showSeconds ? 6 : 4 }),
  },
  type: 'clock',
  View: ClockView,
}
