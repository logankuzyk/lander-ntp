import { Dropdown } from './Dropdown'

type SelectProps<T extends string> = {
  labelId: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (value: T) => void
}

/** Pick one option. The menu closes on a choice. */
export function Select<T extends string>({ labelId, value, options, onChange }: SelectProps<T>) {
  const current = options.find(([id]) => id === value)?.[1] ?? ''

  return (
    <Dropdown labelId={labelId} popup="listbox" value={current}>
      {(close) =>
        options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            role="option"
            class="dropdown__option"
            aria-selected={id === value}
            tabIndex={-1}
            onClick={() => {
              if (id !== value) onChange(id)
              close()
            }}
          >
            {text}
            {id === value && (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M5 12l5 5 9-10" />
              </svg>
            )}
          </button>
        ))
      }
    </Dropdown>
  )
}
