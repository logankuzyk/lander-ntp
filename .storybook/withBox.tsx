import type { Decorator } from '@storybook/preact-vite'

import type { Rect } from '@/layout/geometry'
import { Box } from '@/widgetSystem/WidgetBox'

/** Where a lone Widget goes without a place of its own: the Clock's, in the middle. */
const MIDDLE: Rect = { col: 5, h: 2, row: 4, w: 4 }

/**
 * Gives a lone widget the box the page gives it: the Grid, and a box in the cells of the story's
 * `parameters.box` (the middle, 4 by 2, if it has none). Use it inside `withPage`, which gives
 * the page wrapper the Grid sits in: `decorators: [withBox, withPage]`. Not for `App` stories,
 * which draw their own.
 */
export const withBox: Decorator = (Story, context) => (
  <div class="grid">
    <Box rect={(context.parameters.box as Rect | undefined) ?? MIDDLE} widget="story">
      <Story />
    </Box>
  </div>
)
