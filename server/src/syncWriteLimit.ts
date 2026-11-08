export function pruneExpiredSyncWrites(writesBySession: Map<string, number[]>, now: number): void {
  for (const [sessionId, writes] of writesBySession) {
    const activeWrites = writes.filter((writtenAt) => now - writtenAt < 60_000)
    if (activeWrites.length === 0) writesBySession.delete(sessionId)
    else writesBySession.set(sessionId, activeWrites)
  }
}
