import { h } from 'preact'

import type { WidgetDefinition, WidgetViewProps } from '@/widgetSystem/definition'

import { Date } from './Date'
import { type DateFormat, firstDayOfWeek, type WeekStart } from './dateParts'

export type DateOptions = {
  format: DateFormat
  monthGrid: boolean
  showYear: boolean
  weekNumbers: boolean
  weekStartsOn: WeekStart
}

function DateView({ cells, options }: WidgetViewProps<DateOptions>) {
  return h(Date, { cells, ...options })
}

export const dateDefinition: WidgetDefinition<DateOptions> = {
  name: 'Date',
  options: [
    {
      choices: [
        { label: 'Short', value: 'short' },
        { label: 'Long', value: 'long' },
      ],
      control: 'choice',
      default: 'short',
      id: 'format',
      label: 'Format',
    },
    { control: 'switch', default: false, id: 'showYear', label: 'Show year' },
    { control: 'switch', default: true, id: 'monthGrid', label: 'Month grid when large' },
    {
      choices: [
        { label: 'Monday', value: 'monday' },
        { label: 'Sunday', value: 'sunday' },
      ],
      control: 'choice',
      default: () => firstDayOfWeek(),
      id: 'weekStartsOn',
      label: 'Week starts on',
    },
    { control: 'switch', default: false, id: 'weekNumbers', label: 'Week numbers' },
  ],
  sizes: {
    largest: { h: 6, w: 6 },
    smallest: { h: 1, w: 2 },
    starting: () => ({ h: 2, w: 2 }),
  },
  type: 'date',
  View: DateView,
}
