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
})
