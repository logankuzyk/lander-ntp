import type { StorybookConfig } from '@storybook/preact-vite'

const config: StorybookConfig = {
  framework: '@storybook/preact-vite',
  // `public/` is the extension's own (fallback.webp); the story photos are only for stories.
  staticDirs: ['../public', './public'],
  stories: ['../src/**/*.stories.tsx'],
  async viteFinal(config) {
    const { mergeConfig } = await import('vite')
    const { default: preact } = await import('@preact/preset-vite')
    return mergeConfig(config, {
      define: {
        // Chrome unless a story says otherwise (`asFirefox`): the page reads this as it runs.
        'import.meta.env.BROWSER': 'globalThis.__storyBrowser',
        'import.meta.env.MANIFEST_VERSION': '3',
      },
      envPrefix: ['VITE_', 'WXT_', 'STORYBOOK_'],
      plugins: [preact()],
      resolve: { alias: { '@': new URL('../src', import.meta.url).pathname } },
    })
  },
}
export default config
