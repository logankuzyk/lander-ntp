import { describe, expect, it } from 'vitest'

import { NEWS, TOUR } from './callouts'

describe('the settings tour', () => {
  it('has a stop for Photos and one for the font, and none for the Clock or the Weather', () => {
    expect(TOUR.map(({ id, section }) => [id, section])).toEqual([
      ['tour-photos', 'photos'],
      ['tour-general', 'general'],
    ])
  })

  it('says nothing of options that are on the widgets now', () => {
    for (const { body, title } of TOUR) {
      expect(`${title} ${body}`).not.toMatch(/24-hour|seconds|forecast|switch it on/i)
    }
  })
})

describe('the news', () => {
  it('has no entry for the Weather: its callout opened a settings tab that is gone', () => {
    // A person updating from 0.2.2 who never saw it must not be sent to a tab that is not there.
    // An id already stored in `dismissed` stays harmless (see useNews.test.tsx).
    expect(NEWS.map(({ id }) => id)).not.toContain('weather')
  })

  it('has no entry that opens a settings section the panel no longer has', () => {
    for (const callout of NEWS) {
      if (callout.section !== undefined) expect(['photos', 'general']).toContain(callout.section)
    }
  })

  describe('the update note about the Layout', () => {
    const note = NEWS.find(({ id }) => id === 'layout')

    it('is the one entry, at the Edit button', () => {
      expect(NEWS.map(({ id }) => id)).toEqual(['layout'])
      expect(note?.target).toBe('edit')
      expect(note?.section).toBeUndefined()
    })

    it('has a "Show me" that goes into edit mode, and no other way to act', () => {
      expect(note).toMatchObject({ showMe: 'edit' })
    })

    it('says the page can be edited and where the Clock and Weather options went', () => {
      expect(note?.title).toBe('You can edit your page now')
      expect(note?.body).toMatch(/edit mode/i)
      expect(note?.body).toMatch(/Clock and Weather options are on the widgets/)
    })

    it('says Add brings widgets back, for a page with the Clock and the Weather both off', () => {
      expect(note?.body).toMatch(/Add brings back any you had off/)
    })

    it('is shown to anyone with it: not held back by the settings', () => {
      expect(note?.relevant).toBeUndefined()
      expect(note?.available).toBeUndefined()
    })
  })
})
