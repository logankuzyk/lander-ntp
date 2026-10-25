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
  type: 'clock',
  View: ClockView,
}
