/**
 * What became of one `save`:
 * - `saved`: its value was written.
 * - `rejected`: its value was handed to storage and storage refused it.
 * - `superseded`: a newer value took its place while it waited, so it was never written.
 */
export type SaveResult = 'rejected' | 'saved' | 'superseded'

export type WriteQueue<T> = {
  /** Saves `value` after any write in flight. Never rejects: the result says what happened. */
  save: (value: T) => Promise<SaveResult>
}

type Waiting<T> = { settle: (result: SaveResult) => void; value: T }

/**
 * Runs saves to one place one at a time. While a write is in flight only the latest value waits
 * behind it, so twenty quick changes are two writes, the second carrying the last value. A write
 * that is refused fails only its own save: the one waiting behind it still goes, and so does
 * the next.
 */
export function createWriteQueue<T>(write: (value: T) => Promise<void>): WriteQueue<T> {
  let running = false
  let waiting: Waiting<T> | null = null

  const run = ({ settle, value }: Waiting<T>) => {
    running = true
    let written: Promise<void>
    try {
      written = write(value)
    } catch (error) {
      written = Promise.reject(error instanceof Error ? error : new Error(String(error)))
    }
    void written.then(
      () => finish(settle, 'saved'),
      () => finish(settle, 'rejected'),
    )
  }

  const finish = (settle: (result: SaveResult) => void, result: SaveResult) => {
    running = false
    // The next write starts before the caller hears of this one.
    const next = waiting
    waiting = null
    if (next) run(next)
    settle(result)
  }

  return {
    save: (value) =>
      new Promise<SaveResult>((settle) => {
        if (!running) return run({ settle, value })
        waiting?.settle('superseded')
        waiting = { settle, value }
      }),
  }
}
