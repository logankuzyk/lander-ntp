import { describe, expect, it } from 'vitest'

import { dismissNews } from './dismissNews'

describe('dismissNews', () => {
  it('adds the id after the ones already there, and changes nothing else', () => {
    expect(dismissNews({ dismissed: ['weather'], welcomed: true }, 'layout')).toEqual({
      dismissed: ['weather', 'layout'],
      welcomed: true,
    })
  })

  it('keeps a record that has not been welcomed as it is, apart from the id', () => {
    expect(dismissNews({ dismissed: [], welcomed: false }, 'layout')).toEqual({
      dismissed: ['layout'],
      welcomed: false,
    })
  })

  it('does not write an id twice', () => {
    const record = { dismissed: ['weather', 'layout'], welcomed: true }

    expect(dismissNews(record, 'layout')).toEqual(record)
  })

  it('leaves the record it was given alone', () => {
    const record = { dismissed: ['weather'], welcomed: true }

    dismissNews(record, 'layout')

    expect(record).toEqual({ dismissed: ['weather'], welcomed: true })
  })
})
