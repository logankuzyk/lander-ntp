import { render, screen, waitFor } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'

import { onboardingItem } from '@/onboarding/storage'

import { PhotoInfo } from './PhotoInfo'
import meta, { HeartNew } from './PhotoInfo.stories'

describe('PhotoInfo stories', () => {
  it('shows the heart mark in HeartNew', async () => {
    await onboardingItem.setValue({ dismissed: [], welcomed: true })
    render(<PhotoInfo {...meta.args} {...HeartNew.args} />)

    await waitFor(() => expect(screen.getByRole('dialog').querySelector('.new-mark')).toBeTruthy())
  })
})
