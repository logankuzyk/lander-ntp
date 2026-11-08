import { h } from 'preact'

import type { WidgetDefinition, WidgetViewProps } from '@/widgetSystem/definition'

import { AnalogClock } from './AnalogClock'

export type AnalogClockOptions = {
  face: 'minimal' | 'numerals' | 'ticks'
  showDate: boolean
  showSeconds: boolean
}

function AnalogClockView({ options }: WidgetViewProps<AnalogClockOptions>) {
  return h(AnalogClock, options)
}

export const analogClockDefinition: WidgetDefinition<AnalogClockOptions> = {
  name: 'Analog clock',
  options: [
    {
      choices: [
        { label: 'Minimal', value: 'minimal' },
        { label: 'Ticks', value: 'ticks' },
        { label: 'Numerals', value: 'numerals' },
      ],
      control: 'choice',
      default: 'ticks',
      id: 'face',
      label: 'Face',
    },
    { control: 'switch', default: true, id: 'showSeconds', label: 'Seconds hand' },
    { control: 'switch', default: false, id: 'showDate', label: 'Date window' },
  ],
  sizes: {
    largest: { h: 6, w: 6 },
    smallest: { h: 2, w: 2 },
    starting: () => ({ h: 2, w: 2 }),
  },
  type: 'analog-clock',
  View: AnalogClockView,
}
