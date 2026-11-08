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
      id: 'tour-photos',
      section: 'photos',
      title: 'Background',
    })
    expect(background?.body).toContain('how often the photo changes')
    expect(background?.body).toContain('which tags to draw from')
    expect(background?.body).toContain('solid colour')
    expect(background?.body).toContain('Pick a photo from the gallery to show it now')
    expect(background?.body).toContain('The heart in photo details keeps favourites')
    expect(background?.body).toContain('Favourites only cycles just those')
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

  it('keeps keyboard shortcuts out of the new-install tour and update walk', () => {
    const textForStop = ({ body, title, ...stop }: (typeof TOUR)[number]) => [
      title,
      body,
      'readOnlyBody' in stop ? stop.readOnlyBody : undefined,
    ]
    const onboardingText = [
      ...TOUR.flatMap(textForStop),
      ...NEWS.flatMap(({ body, title, ...note }) => [
        title,
        body,
        ...('walk' in note ? (note.walk ?? []).flatMap(textForStop) : []),
      ]),
    ]
    for (const text of onboardingText) {
      if (text !== undefined) expect(text).not.toMatch(/keyboard|\bE\b|Tab|Enter|arrow|Shift/i)
    }
  })

  it('keeps the Move and resize stop about dragging', () => {
    expect(TOUR.find(({ id }) => id === 'tour-move')?.body).toBe(
      'Drag a widget to move it, and drag the handle in its corner to resize it.',
    )
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
