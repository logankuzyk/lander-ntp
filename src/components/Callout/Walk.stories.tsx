import type { Meta, StoryObj } from '@storybook/preact-vite'
import { useState } from 'preact/hooks'
import { expect, userEvent, within } from 'storybook/test'

import { AddMenuControlProvider, useAddMenuControl } from '@/components/AddMenu/useAddMenuControl'
import { EditModeProvider } from '@/components/EditMode/useEditMode'
import { PhotoInfo } from '@/components/PhotoInfo/PhotoInfo'
import type { Layout } from '@/layout/types'
import { type PageCallout, type TourStop } from '@/onboarding/callouts'
import { onboardingItem } from '@/onboarding/storage'
import { makePhoto } from '@/test/fixtures'

import { PageNews } from './PageNews'

const layout: Layout = { extra: {}, widgets: [] }
const walk: readonly TourStop[] = [
  {
    body: 'Start in edit mode.',
    id: 'one',
    show: { adding: false, editing: false },
    target: 'edit',
    title: 'First stop',
  },
  {
    body: 'Add a Widget here.',
    id: 'two',
    show: { adding: true, editing: true },
    target: 'menu-item',
    title: 'Choose a Widget',
  },
  {
    body: 'See the photo details.',
    id: 'three',
    show: { adding: false, editing: true, info: true },
    target: 'edit',
    title: 'Photo details',
  },
]
const news: PageCallout = {
  actionLabel: 'Show me',
  body: 'Walk through the page.',
  id: 'story-walk',
  target: 'edit',
  title: 'A guided walk',
  walk,
}

function WalkContent() {
  const menu = useAddMenuControl()
  const [details, setDetails] = useState(false)
  return (
    <EditModeProvider>
      <button data-callout-target="edit" data-edit-toggle type="button">
        Edit
      </button>
      {menu?.open && (
        <button data-callout-target="menu:clock" type="button">
          Clock
        </button>
      )}
      <PageNews
        closeInfo={() => setDetails(false)}
        dismiss={() => {}}
        layout={layout}
        news={news}
        openInfo={() => setDetails(true)}
      />
      {details && <PhotoInfo onClose={() => setDetails(false)} photo={makePhoto('walk')} quiet />}
    </EditModeProvider>
  )
}

function WalkPage() {
  return (
    <AddMenuControlProvider>
      <WalkContent />
    </AddMenuControlProvider>
  )
}

const meta = {
  component: WalkPage,
  title: 'Callout/Walk',
} satisfies Meta<typeof WalkPage>
export default meta
type Story = StoryObj<typeof meta>

const seed = async () => {
  await onboardingItem.setValue({ dismissed: [], welcomed: true })
}

export const FirstStop: Story = {
  beforeEach: seed,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Show me' }))
    await expect(canvas.getByRole('note').textContent).toContain('First stop')
  },
}

export const WithMenuOpen: Story = {
  beforeEach: seed,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Show me' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(canvas.getByRole('button', { name: 'Clock' })).toBeInTheDocument()
  },
}

export const WithDetailsOpen: Story = {
  beforeEach: seed,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Show me' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }))
    await expect(canvas.getByRole('dialog', { name: 'Photo details' })).toBeInTheDocument()
  },
}
