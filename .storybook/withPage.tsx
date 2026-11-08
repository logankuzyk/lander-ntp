import type { Decorator } from '@storybook/preact-vite'
import type { ComponentChildren } from 'preact'
import { useLayoutEffect } from 'preact/hooks'

import { fontStack } from '@/settings/fonts'

/**
 * Gives a lone widget or panel what the page gives it: the `.app` wrapper (text shadow) and
 * the display font, picked from the toolbar. Not for `App` stories, which draw their own
 * wrapper and set the font from settings.
 *
 * The page no longer centres what is in `.app`: its Widgets sit on the Grid, in a box each.
 * The story is centred here, for a panel or a control that has no box. A Widget story adds its
 * box with `withBox`.
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
    <div class="app" style={{ display: 'grid', minHeight: '100vh', placeItems: 'center' }}>
      {children}
    </div>
  )
}
