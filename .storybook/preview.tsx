import './fake-browser'
import '@fontsource/geist-sans/latin-400.css'
import '@fontsource/geist-sans/latin-500.css'
import '@fontsource/geist-mono/latin-400.css'
import '@fontsource/geist-mono/latin-500.css'
import '@fontsource/instrument-serif/latin-400.css'

import '../src/entrypoints/newtab/style.css'
import './preview.css'
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
  parameters: {
    chromatic: { disableSnapshot: true },
    layout: 'fullscreen',
    // The two windows the Grid is judged at (1440 by 900 and 1366 by 768, as laptops come);
    // pick one from the toolbar's Viewport menu.
    viewport: {
      options: {
        laptop1366: {
          name: '1366 by 768',
          styles: { height: '768px', width: '1366px' },
          type: 'desktop',
        },
        laptop1440: {
          name: '1440 by 900',
          styles: { height: '900px', width: '1440px' },
          type: 'desktop',
        },
      },
    },
  },
}
export default preview
