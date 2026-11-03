import type { Decorator, Meta, StoryObj } from '@storybook/preact-vite'
import { fn } from 'storybook/test'

import { EditModeProvider } from '@/components/EditMode/useEditMode'
import { PhotoCredit } from '@/components/PhotoCredit/PhotoCredit'
import { deriveLayout } from '@/layout/derive'
import { DEFAULT_SETTINGS } from '@/settings/schema'
import { STORY_PHOTOS } from '@/test/fixtures'

import { startEditing } from '../../../.storybook/startEditing'
import { withPage } from '../../../.storybook/withPage'
import { Controls } from './Controls'

const [PHOTO] = STORY_PHOTOS

/**
 * The Bottom bar (see CONTEXT.md): the photo credit on the left and the page's buttons on the
 * right, both fixed to the foot of the window. Edit mode is the page's state, so the story
 * brings its own, as `App` does. The credit is the longest the story photos have, as the bar is
 * tightest when it is long.
 */
const withBottomBar: Decorator = (Story) => (
  <EditModeProvider>
    {PHOTO && <PhotoCredit photo={{ ...PHOTO, printUrl: 'https://logankuzyk.com/prints/coast' }} />}
    <Story />
  </EditModeProvider>
)

// The bar sits at the foot of the story's canvas; the toolbar's Viewport menu has the two sizes
// to look at, and a narrow one is a custom size.
const meta = {
  args: {
    // A new install's Layout, the Clock alone: the Add menu's own stories are in AddMenu.
    layout: deriveLayout(DEFAULT_SETTINGS),
    layoutLoaded: true,
    onCommit: fn(),
    onNext: fn(),
    onToggleInfo: fn(),
    onToggleSettings: fn(),
  },
  component: Controls,
  decorators: [withBottomBar, withPage],
  title: 'BottomBar',
} satisfies Meta<typeof Controls>
export default meta

type Story = StoryObj<typeof meta>

/** Browsing: the Edit button beside the page's own, first, a pencil like theirs. */
export const Browsing: Story = {}

/**
 * Editing, after pressing Edit: Add joins Done, which is pressed; the rest stay put. It shows
 * the bar alone: on a narrow window the page also lifts the photo credit above the buttons while
 * editing (it follows the Grid's edit mode), which only the page's own stories (`AddMenu`) show.
 */
export const Editing: Story = {
  play: async ({ canvasElement }) => {
    await startEditing(canvasElement)
  },
}
