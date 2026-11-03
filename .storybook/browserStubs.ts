import { fakeBrowser } from 'wxt/testing/fake-browser'

declare global {
  /**
   * Which browser the stories are for. `main.ts` makes `import.meta.env.BROWSER` read this, so a
   * story can be the page as Firefox draws it; everything else is Chrome. Set by `fake-browser`,
   * and put back by what `asFirefox` returns.
   */
  var __storyBrowser: string | undefined
}

/**
 * Makes the story's page Firefox, where the user is asked to agree to sending a place before the
 * weather may be fetched, and the browser says whether they have. Pressing the setup button in
 * the story records the agreement, so the box can be taken from the button to the next state by
 * hand. Returns what puts Chrome and the browser's own answers back; call it from the story's
 * `beforeEach` cleanup.
 */
export function asFirefox({ consented }: { consented: boolean }): () => void {
  const { contains, request } = fakeBrowser.permissions
  let agreed = consented
  globalThis.__storyBrowser = 'firefox'
  fakeBrowser.permissions.contains = (() => Promise.resolve(agreed)) as never
  fakeBrowser.permissions.request = (() => {
    agreed = true
    return Promise.resolve(true)
  }) as never
  return () => {
    globalThis.__storyBrowser = 'chrome'
    fakeBrowser.permissions.contains = contains
    fakeBrowser.permissions.request = request
  }
}

/**
 * Has the browser say this page has not yet been allowed to read the device's location (the
 * state a permission starts in), so a Weather that follows the device asks for it with its setup
 * button. Pressing the button in the story shows the browser's own prompt. Returns what puts the
 * browser's answer back.
 */
export function locationNotAllowed(): () => void {
  const own = Object.getOwnPropertyDescriptor(navigator, 'permissions')
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: {
      query: () =>
        Promise.resolve({
          addEventListener: () => {},
          removeEventListener: () => {},
          state: 'prompt',
        }),
    },
  })
  return () => {
    if (own) Object.defineProperty(navigator, 'permissions', own)
    else Reflect.deleteProperty(navigator, 'permissions')
  }
}
