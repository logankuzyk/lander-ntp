import { afterEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

import { asFirefox, locationNotAllowed } from './browserStubs'

afterEach(() => {
  delete globalThis.__storyBrowser
})

describe('asFirefox', () => {
  it('makes the page Firefox until it is put back, and Chrome after', () => {
    const restore = asFirefox({ consented: false })
    expect(globalThis.__storyBrowser).toBe('firefox')

    restore()

    expect(globalThis.__storyBrowser).toBe('chrome')
  })

  it('has the browser say the user has not agreed to send a place', async () => {
    const restore = asFirefox({ consented: false })

    await expect(
      fakeBrowser.permissions.contains({ data_collection: ['locationInfo'] } as never),
    ).resolves.toBe(false)

    restore()
  })

  it('has the browser say the user has agreed, when told so', async () => {
    const restore = asFirefox({ consented: true })

    await expect(
      fakeBrowser.permissions.contains({ data_collection: ['locationInfo'] } as never),
    ).resolves.toBe(true)

    restore()
  })

  it('puts the browser’s permissions back as they were', () => {
    const { contains, request } = fakeBrowser.permissions
    asFirefox({ consented: true })()

    expect(fakeBrowser.permissions.contains).toBe(contains)
    expect(fakeBrowser.permissions.request).toBe(request)
  })
})

describe('locationNotAllowed', () => {
  it('has the browser say the page has not been allowed to read the location, until it is put back', async () => {
    const restore = locationNotAllowed()

    const status = await navigator.permissions.query({ name: 'geolocation' })
    expect(status.state).toBe('prompt')
    expect(() => status.addEventListener('change', () => {})).not.toThrow()

    restore()
    expect(Object.getOwnPropertyDescriptor(navigator, 'permissions')).toBeUndefined()
  })
})
