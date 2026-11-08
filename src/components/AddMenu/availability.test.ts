import { describe, expect, it } from 'vitest'

import { createFakeBookmarksPort } from '@/bookmarks/fake'
import type { Layout } from '@/layout/types'
import { createBookmarksDefinition } from '@/widgets/Bookmarks/definition'

import { itemState } from './availability'

describe('the Add menu availability', () => {
  it('keeps Bookmarks unavailable with the browser support reason', () => {
    const definition = createBookmarksDefinition(createFakeBookmarksPort({ supported: false }))
    const layout: Layout = { extra: {}, widgets: [] }

    expect(
      itemState(
        { layout, readOnly: false },
        definition.type,
        definition.name,
        null,
        definition.unavailable?.() ?? null,
      ),
    ).toEqual({
      available: false,
      reason: "Bookmarks aren't available in this browser",
    })
  })
})
