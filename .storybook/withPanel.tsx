import type { Decorator } from '@storybook/preact-vite'
import { useEffect, useState } from 'preact/hooks'

/**
 * Gives a lone settings control what the settings panel gives it: the popover look and the
 * section that stacks its rows. The panel is fixed to a corner of the page; here it sits in
 * the flow so the story is seen where it is. Use it inside `withPage`, as in
 * `decorators: [withPanel, withPage]`.
 */
export const withPanel: Decorator = (Story) => (
  <aside class="popover settings" style={{ position: 'static', width: 'min(24rem, 90%)' }}>
    <div class="settings__body" style={{ height: 'auto', margin: 0, overflow: 'visible' }}>
      <section>
        <Story />
      </section>
    </div>
  </aside>
)

/**
 * A control keeps nothing itself: whoever draws it owns the value. A story is that owner, so
 * the control responds in a published Storybook as it does on the page. Follows the Controls
 * panel when it hands over a new value.
 */
export function useStoryValue<T>(initial: T, onChange: (value: T) => void) {
  const [value, setValue] = useState(initial)
  useEffect(() => setValue(initial), [initial])
  return [
    value,
    (next: T) => {
      setValue(next)
      onChange(next)
    },
  ] as const
}
