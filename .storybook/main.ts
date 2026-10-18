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
        'import.meta.env.BROWSER': JSON.stringify('chrome'),
        'import.meta.env.MANIFEST_VERSION': '3',
      },
      envPrefix: ['VITE_', 'WXT_', 'STORYBOOK_'],
      plugins: [preact()],
      resolve: { alias: { '@': new URL('../src', import.meta.url).pathname } },
    })
  },
}
export default config
