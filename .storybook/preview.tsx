import './fake-browser'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-500.css'
import '@fontsource/geist-mono/latin-400.css'
import '@fontsource/geist-mono/latin-500.css'
import '@fontsource/instrument-serif/latin-400.css'

import '../src/entrypoints/newtab/style.css'
import type { Preview } from '@storybook/preact-vite'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { FONT_IDS, FONTS } from '@/settings/fonts'

const preview: Preview = {
  // In-memory storage is shared by every story in the page; start each one clean.
  beforeEach() {
    fakeBrowser.reset()
    fakeBrowser.runtime.getURL = ((path: string) => path) as typeof fakeBrowser.runtime.getURL
  },
  // The page's font setting, for stories drawn through `withPage`.
  globalTypes: {
    font: {
      description: 'Display font',
      toolbar: {
        dynamicTitle: true,
        items: FONT_IDS.map((id) => ({ title: FONTS[id].label, value: id })),
        title: 'Font',
      },
    },
  },
  initialGlobals: { font: 'system' },
  // Publish only: Chromatic takes no snapshots, so no visual tests run.
  parameters: { chromatic: { disableSnapshot: true }, layout: 'fullscreen' },
}
export default preview
