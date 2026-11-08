import { h } from 'preact'

import { deleteIcon } from '@/quickDial/iconStorage'
import { tidyUrl } from '@/quickDial/tidyUrl'
import { useIcon } from '@/quickDial/useIcon'
import type { WidgetDefinition, WidgetViewProps } from '@/widgetSystem/definition'
import type { Need } from '@/widgetSystem/needs'

import { QuickDial } from './QuickDial'

export type QuickDialOptions = {
  colour: string
  icon: string | null
  label: string
  newTab: boolean
  showIcon: boolean
  url: string
}

function QuickDialView({ options }: WidgetViewProps<QuickDialOptions>) {
  const uploadedIcon = useIcon(options.icon)
  return h(QuickDial, {
    colour: options.colour,
    label: options.label,
    newTab: options.newTab,
    showIcon: options.showIcon,
    uploadedIcon,
    url: options.url,
  })
}

const site: Need<QuickDialOptions> = {
  action: { kind: 'option', option: 'url' },
  id: 'site',
  label: 'Choose a site',
  met: ({ url }) => tidyUrl(url) !== null,
}

export const quickDialDefinition: WidgetDefinition<QuickDialOptions> = {
  name: 'Quick dial',
  needs: [site],
  onDiscard: (options) => {
    if (typeof options.icon === 'string') void deleteIcon(options.icon)
  },
  options: [
    { control: 'text', default: '', id: 'url', label: 'Site', placeholder: 'example.com' },
    { control: 'text', default: '', id: 'label', label: 'Label' },
    { control: 'switch', default: true, id: 'showIcon', label: 'Show icon' },
    { control: 'icon', default: null, id: 'icon', label: 'Icon' },
    { control: 'colour', default: '#ffffff', id: 'colour', label: 'Icon colour' },
    { control: 'switch', default: false, id: 'newTab', label: 'Open in a new tab' },
  ],
  sizes: {
    largest: { h: 3, w: 3 },
    smallest: { h: 1, w: 1 },
    starting: () => ({ h: 1, w: 1 }),
  },
  summary: ({ label, url }) => {
    const address = tidyUrl(url)
    return label.trim() || (address ? new URL(address).hostname : undefined)
  },
  type: 'quick-dial',
  View: QuickDialView,
}
