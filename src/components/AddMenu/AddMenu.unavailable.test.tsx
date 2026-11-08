import { render, screen } from '@testing-library/preact'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import type { Layout } from '@/layout/types'

import { AddMenu } from './AddMenu'

const EMPTY: Layout = { extra: {}, widgets: [] }

describe('the Add menu in a browser without Bookmarks support', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('shows the Bookmarks unavailability reason beside its menu item', () => {
    const contains = fakeBrowser.permissions.contains
    fakeBrowser.permissions.contains = undefined as never

    try {
      render(
        <AddMenu
          layout={EMPTY}
          loaded
          onCommit={() => undefined}
          onOpenChange={() => undefined}
          open
        />,
      )

      expect(screen.getByText("Bookmarks aren't available in this browser")).toBeTruthy()
      expect(
        screen.getByRole('menuitem', {
          name: /Bookmarks.*Bookmarks aren't available in this browser/,
        }),
      ).toBeTruthy()
    } finally {
      fakeBrowser.permissions.contains = contains
    }
  })
})
