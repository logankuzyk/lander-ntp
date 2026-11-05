import { describe, expect, it } from 'vitest'

import { answerWelcome } from './answerWelcome'

describe('answerWelcome', () => {
  it('sets welcomed and changes nothing else, the dismissed ids included', () => {
    expect(answerWelcome({ dismissed: ['weather', 'layout'], welcomed: false })).toEqual({
      dismissed: ['weather', 'layout'],
      welcomed: true,
    })
  })

  it('leaves a record that was answered as it is', () => {
    const record = { dismissed: ['weather'], welcomed: true }

    expect(answerWelcome(record)).toEqual(record)
  })

  it('leaves the record it was given alone', () => {
    const record = { dismissed: [], welcomed: false }

    answerWelcome(record)

    expect(record).toEqual({ dismissed: [], welcomed: false })
  })
})
