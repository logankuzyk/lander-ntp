import { describe, expect, it } from 'vitest'

import { NewerVersionError } from './guard'
import { createWriteQueue } from './writeQueue'

/** A write the test settles by hand, so it can look at the queue while the write is in flight. */
function manualWrites() {
  const written: number[] = []
  const settlers: { reject: (reason: Error) => void; resolve: () => void }[] = []
  const write = (value: number) => {
    written.push(value)
    return new Promise<void>((resolve, reject) => settlers.push({ reject, resolve }))
  }
  return { settlers, write, written }
}

describe('createWriteQueue', () => {
  it('writes a value that arrives when nothing is in flight, and says it was saved', async () => {
    const { settlers, write, written } = manualWrites()
    const queue = createWriteQueue(write)

    const result = queue.save(1)
    settlers[0]?.resolve()

    expect(written).toEqual([1])
    expect(await result).toBe('saved')
  })

  it('turns twenty quick saves into two writes, the second with the last value', async () => {
    const { settlers, write, written } = manualWrites()
    const queue = createWriteQueue(write)

    const results = Array.from({ length: 20 }, (_, i) => queue.save(i + 1))
    expect(written).toEqual([1])

    settlers[0]?.resolve()
    await results[0]
    expect(written).toEqual([1, 20])

    settlers[1]?.resolve()
    expect(await Promise.all(results)).toEqual([
      'saved',
      ...Array<string>(18).fill('superseded'),
      'saved',
    ])
  })

  it('runs one write at a time', async () => {
    const { settlers, write, written } = manualWrites()
    const queue = createWriteQueue(write)

    void queue.save(1)
    void queue.save(2)
    await Promise.resolve()

    expect(written).toEqual([1])
    settlers[0]?.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(written).toEqual([1, 2])
  })

  it('fails only the save that was rejected: the one waiting behind it still goes', async () => {
    const { settlers, write, written } = manualWrites()
    const queue = createWriteQueue(write)

    const first = queue.save(1)
    const second = queue.save(2)
    settlers[0]?.reject(new Error('quota'))

    expect(await first).toBe('rejected')
    expect(written).toEqual([1, 2])
    settlers[1]?.resolve()
    expect(await second).toBe('saved')
  })

  it('goes on after a rejection: the next save is written', async () => {
    const { settlers, write, written } = manualWrites()
    const queue = createWriteQueue(write)

    const first = queue.save(1)
    settlers[0]?.reject(new Error('quota'))
    expect(await first).toBe('rejected')

    const next = queue.save(2)
    settlers[1]?.resolve()

    expect(written).toEqual([1, 2])
    expect(await next).toBe('saved')
  })

  it('says a save was refused, not rejected, when the write fails for a reason it is told is a refusal', async () => {
    const { settlers, write, written } = manualWrites()
    const queue = createWriteQueue(write, (error) => error instanceof NewerVersionError)

    const refused = queue.save(1)
    settlers[0]?.reject(new NewerVersionError('sync:settings'))
    expect(await refused).toBe('refused')

    const rejected = queue.save(2)
    settlers[1]?.reject(new Error('quota'))
    expect(await rejected).toBe('rejected')

    // A refusal fails only its own save.
    const next = queue.save(3)
    settlers[2]?.resolve()
    expect(await next).toBe('saved')
    expect(written).toEqual([1, 2, 3])
  })

  it('treats a write that throws before returning a promise as a rejection', async () => {
    const queue = createWriteQueue<number>(() => {
      throw new Error('no storage')
    })

    expect(await queue.save(1)).toBe('rejected')
  })

  it('writes a waiting value once: nothing is written again after the queue has caught up', async () => {
    const { settlers, write, written } = manualWrites()
    const queue = createWriteQueue(write)

    const first = queue.save(1)
    const second = queue.save(2)
    settlers[0]?.resolve()
    await first
    settlers[1]?.resolve()
    await second
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(written).toEqual([1, 2])
  })
})
