import { browser } from 'wxt/browser'

import { settingsItem } from '@/settings/storage'

import { isTelemetryEnabled } from './consent'
import type { TelemetryEvent } from './events'
import { installId } from './storage'

export const TELEMETRY_URL =
  import.meta.env.WXT_TELEMETRY_URL || 'https://ntp.logankuzyk.com/events'

/** Past this a send is abandoned; nothing waits on it, but a stalled request shouldn't linger. */
export const SEND_TIMEOUT_MS = 5000

/**
 * Send one event, if the user allows it. Resolves to whether the endpoint took it, and never
 * throws: a lost event isn't worth an error on a new tab page, so there is no retry either.
 */
export async function track(event: TelemetryEvent): Promise<boolean> {
  try {
    if (!(await isTelemetryEnabled(await settingsItem.getValue()))) return false

    const response = await fetch(TELEMETRY_URL, {
      method: 'POST',
      // text/plain keeps this a simple request, with no CORS preflight in front of it. The
      // endpoint reads the body as JSON whatever the type says.
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        ...event,
        installId: await installId.getValue(),
        version: browser.runtime.getManifest().version,
        browser: import.meta.env.BROWSER,
      }),
      // Lets an event sent as a link is followed finish after the page has gone.
      keepalive: true,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    return false
  }
}
