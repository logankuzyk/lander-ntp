import type { Onboarding } from './storage'

/**
 * The record once the welcome is answered, by either button: it only gains `welcomed`. Taking
 * the tour stores nothing more, so what a device still on v0.2.3 reads is the same record with
 * one flag turned on.
 */
export function answerWelcome(record: Onboarding): Onboarding {
  return record.welcomed ? record : { ...record, welcomed: true }
}
