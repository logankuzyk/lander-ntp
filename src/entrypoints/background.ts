import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'

import { recordInstall } from '@/onboarding/install'

// Only here to learn whether this is a new install or an update, which the new tab page has
// no way to tell.
export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    void recordInstall(reason)
  })
})
