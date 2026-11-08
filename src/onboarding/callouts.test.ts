import { describe, expect, it } from 'vitest'

import { NEWS, type PageTourStop, TOUR } from './callouts'

describe('the tour', () => {
  it('goes from Edit to Done on the page, then Background and the font in the settings panel', () => {
    expect(TOUR.map(({ id }) => id)).toEqual([
      'tour-edit',
      'tour-move',
      'tour-options',
      'tour-setup',
      'tour-add',
      'tour-done',
      'tour-photos',
      'tour-general',
    ])
  })

  it('mentions the free Widgets in Add and the Background in the existing Photos stop', () => {
    expect(TOUR.map(({ id }) => id)).toEqual([
      'tour-edit',
      'tour-move',
      'tour-options',
      'tour-setup',
      'tour-add',
      'tour-done',
      'tour-photos',
      'tour-general',
    ])
    const add = TOUR.find(({ id }) => id === 'tour-add')
    const background = TOUR.find(({ id }) => id === 'tour-photos')
    expect(add?.body).toBe(
      'The Date, Analog clock, Bookmarks and Quick dial are in the same menu. A Quick dial is one site; add one for each.',
    )
    expect(background).toMatchObject({
      body: 'A photo that changes as often as you like, or one solid colour. The heart in photo details keeps favourites, and Favourites only cycles just those.',
      id: 'tour-photos',
      section: 'photos',
      title: 'Background',
    })
  })

  it('has a stop in the panel for Background and one for the font, and none for the Clock or the Weather', () => {
    expect(
      TOUR.filter(({ section }) => section !== undefined).map(({ section }) => section),
    ).toEqual(['photos', 'general'])
  })

  it('has a stop on the page only where it points at something', () => {
    for (const stop of TOUR) {
      expect(stop.section === undefined).toBe(stop.target !== undefined)
    }
  })

  it('opens the Add menu on the Add stop alone, and is in edit mode from the second stop to Done', () => {
    const pageStops = TOUR.filter((stop): stop is PageTourStop => stop.section === undefined)
    expect(pageStops.filter(({ show }) => show.adding).map(({ id }) => id)).toEqual(['tour-add'])
    expect(pageStops.map(({ show }) => show.editing)).toEqual([false, true, true, true, true, true])
  })

  it('says nothing of options that are on the widgets now', () => {
    for (const { body, title } of TOUR) {
      expect(`${title} ${body}`).not.toMatch(/24-hour|seconds|forecast|switch it on/i)
    }
  })

  it('says in one sentence how to move and resize from the keyboard, as the page does it', () => {
    const move = TOUR.find(({ id }) => id === 'tour-move')
    // Enter picks a widget up and puts it down, the arrows move it and Shift with them resizes it
    // (Grid.keys.test.tsx); the pointer way comes first, in the sentence before.
    expect(move?.body).toMatch(/Drag a widget to move it/)
    expect(move?.body).toMatch(/keyboard.*Enter.*arrow keys.*Shift.*Enter/)
    expect(move?.body.split(/(?<=\.)\s/)).toHaveLength(2)
  })

  it('says nothing about arrow keys, Enter or Shift anywhere else', () => {
    for (const { body, id } of TOUR) {
      if (id !== 'tour-move') expect(body).not.toMatch(/arrow|Enter|Shift/i)
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

    it('has a "Show me" that starts its walk', () => {
      expect(note).toMatchObject({ actionLabel: 'Show me', walk: expect.any(Array) })
    })

    it('offers the guided walk from the production update note', () => {
      if (!note || note.target === undefined) throw new Error('layout note is not a page callout')
      expect(note.actionLabel).toBe('Show me')
      expect(note.walk?.map(({ id }) => id)).toEqual([
        'tour-edit',
        'news-photo-details',
        'tour-move',
        'tour-options',
        'tour-setup',
        'tour-add',
        'tour-done',
        'tour-photos',
        'tour-general',
      ])
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
