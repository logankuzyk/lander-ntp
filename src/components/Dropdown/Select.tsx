import { Dropdown } from './Dropdown'

type SelectProps<T extends string> = {
  labelId: string
  onChange: (value: T) => void
  options: readonly (readonly [T, string])[]
  value: T
}

/** Pick one option. The menu closes on a choice. */
export function Select<T extends string>({ labelId, onChange, options, value }: SelectProps<T>) {
  const current = options.find(([id]) => id === value)?.[1] ?? ''

  return (
    <Dropdown labelId={labelId} popup="listbox" value={current}>
      {(close) =>
        options.map(([id, text]) => (
          <button
            aria-selected={id === value}
            class="dropdown__option"
            key={id}
            onClick={() => {
              if (id !== value) onChange(id)
              close()
            }}
            role="option"
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
        ))
      }
    </Dropdown>
  )
}
