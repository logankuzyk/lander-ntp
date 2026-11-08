import { useId, useRef, useState } from 'preact/hooks'

import { MultiSelect } from '@/components/Dropdown/MultiSelect'
import { Select } from '@/components/Dropdown/Select'

import type { PickChoice } from '../definition'

type PickFromListBaseProps = {
  disabled?: boolean
  emptyText: string
  failedText: string
  label: string
  load: () => Promise<readonly PickChoice[]>
}

type SingleProps = PickFromListBaseProps & {
  multiple?: false
  onChange: (value: string) => void
  value: string
}

type MultipleProps = PickFromListBaseProps & {
  multiple: true
  onChange: (value: string[]) => void
  value: readonly string[]
}

type PickFromListProps = MultipleProps | SingleProps

/** A choice whose list is read from this device when its menu opens. */
export function PickFromList(props: PickFromListProps) {
  const labelId = useId()
  const [choices, setChoices] = useState<readonly PickChoice[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const request = useRef(0)

  const load = async () => {
    const current = ++request.current
    setLoading(true)
    setFailed(false)
    setChoices(null)
    try {
      const next = await props.load()
      if (request.current === current) setChoices(next)
    } catch {
      if (request.current === current) setFailed(true)
    } finally {
      if (request.current === current) setLoading(false)
    }
  }

  const content = () => {
    if (failed) {
      return (
        <div class="dropdown__empty">
          <span>{props.failedText}</span>
          <button class="settings__link" onClick={() => void load()} type="button">
            Retry
          </button>
        </div>
      )
    }
    if (loading || choices === null) return <div class="dropdown__empty">Loading…</div>
    if (choices.length === 0) return <div class="dropdown__empty">{props.emptyText}</div>
    return null
  }

  if (props.multiple) {
    const current = props.value
    const known = new Set(choices?.map(({ value }) => value) ?? [])
    const missing = choices ? current.filter((value) => !known.has(value)) : []
    const options = [
      ...(choices ?? []),
      ...missing.map((value) => ({ label: 'Not on this device', value })),
    ]
    return (
      <div class="settings__row">
        <span id={labelId}>{props.label}</span>
        <MultiSelect
          allLabel="Choose"
          disabled={props.disabled}
          emptyContent={choices === null || failed || choices.length === 0 ? content() : undefined}
          labelId={labelId}
          onChange={props.onChange}
          onOpen={() => void load()}
          options={options}
          value={current}
        />
      </div>
    )
  }

  const known = new Set(choices?.map(({ value }) => value) ?? [])
  const value = props.value
  const options = [
    ...(choices ?? []).map(({ depth, label, value: id }) => [id, label, depth] as const),
    ...(choices && value && !known.has(value) ? ([[value, 'Not on this device']] as const) : []),
  ]
  return (
    <div class="settings__row">
      <span id={labelId}>{props.label}</span>
      <Select
        disabled={props.disabled}
        emptyContent={choices === null || failed || choices.length === 0 ? content() : undefined}
        labelId={labelId}
        onChange={props.onChange}
        onOpen={() => void load()}
        options={options}
        value={value}
      />
    </div>
  )
}
