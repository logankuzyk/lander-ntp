import type { Onboarding } from './storage'

/**
 * The record with one more news callout seen off. It only ever gains an id: a device still on
 * v0.2.3 reads the same record, and an id it already holds, from the Weather's old news, stays.
 * Everything else about the record is as it was.
 */
export function dismissNews(record: Onboarding, id: string): Onboarding {
  return record.dismissed.includes(id)
    ? record
    : { ...record, dismissed: [...record.dismissed, id] }
}
