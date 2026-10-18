import type { Decorator } from '@storybook/preact-vite'
import type { ComponentChildren } from 'preact'
import { useLayoutEffect } from 'preact/hooks'

import { fontStack } from '@/settings/fonts'

/**
 * Gives a lone widget or panel what the page gives it: the `.app` wrapper (centring, text
 * shadow) and the display font, picked from the toolbar. Not for `App` stories, which draw
 * their own wrapper and set the font from settings.
 */
export const withPage: Decorator = (Story, context) => (
  <Page font={String(context.globals.font ?? 'system')}>
    <Story />
  </Page>
)

function Page({ children, font }: { children: ComponentChildren; font: string }) {
  // As App does: before paint, so the story is never drawn in one font and then another.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--font-display', fontStack(font))
  }, [font])

  // `.app` is 100% tall, and the canvas root has no height of its own.
  return (
    <div class="app" style={{ minHeight: '100vh' }}>
      {children}
    </div>
  )
}
