import { cleanup } from '@testing-library/preact'
import { afterEach } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

afterEach(() => {
  cleanup()
  fakeBrowser.reset()
})
