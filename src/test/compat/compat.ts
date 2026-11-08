import { fakeBrowser } from 'wxt/testing/fake-browser'

import { moveWidget, removeWidget, setOptions } from '@/layout/ops'
import type { Layout } from '@/layout/types'

import { onboardingItem as onboardingItemV023 } from './v0.2.3/onboarding'
import { type Settings, settingsItem as settingsItemV023 } from './v0.2.3/settings'
import { checkV030Layout, storedLayout } from './v0.3.0/layout'
import { onboardingItem as onboardingItemV030 } from './v0.3.0/onboarding'
import { settingsItem as settingsItemV030 } from './v0.3.0/settings'

/** What `chrome.storage.sync.get(null)` returns: every synced key, as the browser holds it. */
export type RawSync = Record<string, unknown>

/** The sync area as a v0.2.3 device would meet it. */
const load = async (rawSync: RawSync) => {
  await fakeBrowser.storage.sync.clear()
  await fakeBrowser.storage.sync.set(rawSync)
}

/**
 * What a device on v0.2.3 draws from this synced storage, read with the frozen copy of its
 * check. `fellBack` is true when it rejected a stored `settings` value and drew the defaults;
 * nothing stored at all is a new install, not a fall back.
 */
export async function asV023(rawSync: RawSync) {
  await load(rawSync)
  const settings = await settingsItemV023.getValue()
  return {
    fellBack: settings === settingsItemV023.fallback,
    onboarding: await onboardingItemV023.getValue(),
    settings,
  }
}

/**
 * What the v0.2.3 panel does for any change: read the settings through its check, spread the
 * change over them and write the whole value back. Returns the synced storage afterwards, as
 * a dump (`raw`), with what v0.2.3 then draws from it.
 */
export async function saveLikeV023(rawSync: RawSync, change: Partial<Settings>) {
  await load(rawSync)
  await settingsItemV023.setValue({ ...(await settingsItemV023.getValue()), ...change })
  const raw = await fakeBrowser.storage.sync.get(null)
  return { ...(await asV023(raw)), raw }
}

type V030Change =
  | { col: number; id: string; kind: 'move'; row: number }
  | { id: string; kind: 'options'; options: Record<string, unknown> }
  | { id: string; kind: 'remove' }

type V030RawSync = RawSync & { layout: { v?: unknown; widgets: unknown[] } }

/** What a frozen v0.3.0 device reads and draws from the synced Layout. */
export async function asV030(rawSync: RawSync) {
  await load(rawSync)
  const raw = rawSync.layout
  const layout = checkV030Layout(raw)
  const settings = await settingsItemV030.getValue()
  return {
    fellBack: settings === settingsItemV030.fallback,
    layout,
    onboarding: await onboardingItemV030.getValue(),
    raw: rawSync as V030RawSync,
    settings,
  }
}

/** A v0.3.0 save writes the whole Layout after one of its own generic Widget operations. */
export async function saveLikeV030(rawSync: RawSync, change: V030Change) {
  const before = await asV030(rawSync)
  if (before.layout.readOnly) return { ...before, raw: rawSync as V030RawSync }
  const widgets = before.layout.widgets
  const base: Layout = {
    extra: before.layout.extra,
    widgets,
    ...(before.layout.waiting === undefined ? {} : { waiting: before.layout.waiting }),
  }
  const editable = { layout: base, readOnly: before.layout.readOnly }
  let next: Layout | undefined
  if (change.kind === 'move') {
    const moved = moveWidget(editable, change.id, { col: change.col, row: change.row })
    if (moved.ok) next = moved.layout
  } else if (change.kind === 'remove') {
    const removed = removeWidget(editable, change.id)
    if (removed.ok) next = removed.layout
  } else {
    const updated = setOptions(editable, change.id, change.options)
    if (updated.ok) next = updated.layout
  }

  const rawLayout = next ? storedLayout(next) : rawSync.layout
  const raw = { ...rawSync, layout: rawLayout } as V030RawSync
  return { ...(await asV030(raw)), raw }
}
