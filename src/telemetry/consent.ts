import { browser, type Browser } from 'wxt/browser'

import type { Settings } from '@/settings/schema'

/** Firefox's name for technical and interaction data, declared optional in wxt.config.ts. */
export const DATA_COLLECTION = 'technicalAndInteraction'

/** Firefox's data collection consent isn't in the Chrome-based types yet. */
type DataCollection = { data_collection?: string[] }

/**
 * The browser's own answer, where it asks the question. Firefox has a usage data switch in
 * its install prompt and in about:addons; Chrome and Edge have nothing like it, so they get
 * null and the extension's own setting decides alone. A Firefox build that finds no answer
 * at all takes it as a no. `firefox` is a parameter only so tests can reach both branches.
 */
export async function browserConsent(
  firefox = import.meta.env.BROWSER === 'firefox',
): Promise<boolean | null> {
  const all: Browser.permissions.Permissions & DataCollection = await browser.permissions.getAll()
  if (all.data_collection) return all.data_collection.includes(DATA_COLLECTION)
  return firefox ? false : null
}

/**
 * Grant or withdraw Firefox's consent, resolving to whether it is granted afterwards. Firefox
 * only shows the prompt from a user action, so call this straight from the event handler,
 * before anything is awaited.
 */
export function setBrowserConsent(allow: boolean): Promise<boolean> {
  const permissions = { data_collection: [DATA_COLLECTION] } as Browser.permissions.Permissions
  return allow
    ? browser.permissions.request(permissions)
    : browser.permissions.remove(permissions).then((removed) => !removed)
}

/**
 * Whether this build has telemetry at all. Off unless built with `WXT_TELEMETRY_ENABLED=1`,
 * so nothing is collected (and the switch isn't shown) until the privacy policy and store
 * declarations are published; see "Turning telemetry on" in AGENTS.md.
 */
export const telemetryBuilt = (): boolean => Boolean(import.meta.env.WXT_TELEMETRY_ENABLED)

/**
 * Whether this build sends. Dev builds send nothing unless asked to, so trying things out
 * doesn't skew the numbers.
 */
export const buildSends = (): boolean =>
  telemetryBuilt() && (!import.meta.env.DEV || Boolean(import.meta.env.WXT_TELEMETRY_DEV))

export async function isTelemetryEnabled(settings: Settings): Promise<boolean> {
  if (!buildSends() || !settings.telemetry) return false
  return (await browserConsent()) ?? true
}
