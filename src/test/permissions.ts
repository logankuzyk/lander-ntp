import type { Browser } from 'wxt/browser'
import { fakeBrowser } from 'wxt/testing/fake-browser'

type Permissions = Browser.permissions.Permissions & { data_collection?: string[] }

/**
 * fakeBrowser.permissions, typed by the promise overloads the code calls. vi.spyOn types a
 * method by its last overload, which here is the callback form, so mocks wouldn't type-check.
 */
export const fakePermissions = fakeBrowser.permissions as unknown as {
  getAll(): Promise<Permissions>
  request(permissions: Permissions): Promise<boolean>
  remove(permissions: Permissions): Promise<boolean>
}
