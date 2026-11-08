import type { Meta, StoryObj } from '@storybook/preact-vite'

import { STORY_PHOTOS } from '@/test/fixtures'

import { withPage } from '../../../.storybook/withPage'
import { Gallery } from './Gallery'

const photos = STORY_PHOTOS.map((photo, index) =>
  index === 1
    ? {
        ...photo,
        tags: [...photo.tags, { name: 'Pattern', optIn: true, slug: 'pattern' }],
      }
    : photo,
)

const meta = {
  args: {
    currentId: STORY_PHOTOS[0]?.id ?? null,
    initialTag: null,
    onSelect: () => undefined,
    photos,
  },
  component: Gallery,
  decorators: [withPage],
  title: 'Gallery',
} satisfies Meta<typeof Gallery>
export default meta

type Story = StoryObj<typeof meta>

/** All omits the pattern photo; its tag remains available as a filter. */
export const WithPatternTag: Story = {}
