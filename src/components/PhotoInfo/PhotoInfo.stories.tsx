import type { Meta, StoryObj } from '@storybook/preact-vite'
import { fn } from 'storybook/test'

import { onboardingItem } from '@/onboarding/storage'
import { makePhoto } from '@/test/fixtures'

import { withPage } from '../../../.storybook/withPage'
import { PhotoInfo } from './PhotoInfo'

const meta = {
  args: { onClose: fn(), photo: makePhoto('heart-new') },
  component: PhotoInfo,
  decorators: [withPage],
  title: 'PhotoInfo',
} satisfies Meta<typeof PhotoInfo>
export default meta

type Story = StoryObj<typeof meta>

/** Photo details with its heart's New mark; opening details records the ID once. */
export const HeartNew: Story = {
  beforeEach: async () => {
    await onboardingItem.setValue({ dismissed: [], welcomed: true })
  },
}
