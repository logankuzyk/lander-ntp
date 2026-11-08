import type { ComponentChildren } from 'preact'

import { Dropdown } from './Dropdown'

type SelectProps<T extends string> = {
  /** Shows the value but does not open. */
  disabled?: boolean
  emptyContent?: ComponentChildren
  labelId: string
  onChange: (value: T) => void
  onOpen?: () => void
  options: readonly (readonly [T, string, number?])[]
  value: T
}

/** Pick one option. The menu closes on a choice. */
export function Select<T extends string>({
  disabled,
  emptyContent,
  labelId,
  onChange,
  onOpen,
  options,
  value,
}: SelectProps<T>) {
  const current = options.find(([id]) => id === value)?.[1] ?? ''

  return (
    <Dropdown disabled={disabled} labelId={labelId} onOpen={onOpen} popup="listbox" value={current}>
      {(close) => (
        <>
          {emptyContent}
          {options.map(([id, text, depth]) => (
            <button
              aria-selected={id === value}
              class="dropdown__option"
              key={id}
              onClick={() => {
                if (id !== value) onChange(id)
                close()
              }}
              role="option"
              style={depth ? { paddingInlineStart: `calc(0.5rem + ${depth * 16}px)` } : undefined}
              tabIndex={-1}
              type="button"
            >
              {text}
              {id === value && (
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="14"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                  width="14"
                >
                  <path d="M5 12l5 5 9-10" />
                </svg>
              )}
            </button>
          ))}
        </>
      )}
    </Dropdown>
  )
}
