// Must be the first import of preview.tsx: wxt/utils/storage looks for the global once, on load.
import { fakeBrowser } from 'wxt/testing/fake-browser'

fakeBrowser.runtime.getURL = ((path: string) => path) as typeof fakeBrowser.runtime.getURL
Object.assign(globalThis, { browser: fakeBrowser, chrome: fakeBrowser })
