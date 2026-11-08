import { Pencil, X } from 'lucide-preact'
import { useRef, useState } from 'preact/hooks'

import { canvasIconEncoder, encodeIcon } from '@/quickDial/icon'
import { deleteIcon, saveIcon } from '@/quickDial/iconStorage'
import { useIcon } from '@/quickDial/useIcon'

const saveSucceeded = (result: unknown) =>
  result === true || result === 'saved' || result === 'superseded'

/** A Quick dial icon chooser; selection stays local until the person confirms it. */
export function IconControl({
  disabled,
  onChange,
  siteIcon,
  value,
}: {
  disabled: boolean
  onChange: (id: string | null) => Promise<unknown> | void
  siteIcon: string
  value: string | null
}) {
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const uploaded = useIcon(value)
  const preview = pending ?? uploaded ?? (siteIcon || null)
  const confirm = async () => {
    if (!pending || saving) return
    setSaving(true)
    setError('')
    try {
      const id = await saveIcon(pending)
      const outcome = await onChange(id)
      if (!saveSucceeded(outcome)) {
        await deleteIcon(id)
        throw new Error("Couldn't save that Layout change.")
      }
      if (value) await deleteIcon(value)
      setPending(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this icon.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div class="settings__row settings__row--icon">
      <span>Icon</span>
      <div class="quick-dial-icon-editor">
        <input
          accept="image/*"
          aria-label="Choose an icon image"
          hidden
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            setError('')
            setPending(null)
            if (!file) return
            try {
              setPending(await encodeIcon(file, canvasIconEncoder))
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Could not read this image.')
            }
          }}
          ref={input}
          type="file"
        />
        {preview ? (
          <img alt="" class="settings__icon-preview" src={preview} />
        ) : (
          <span aria-hidden="true" class="settings__icon-preview quick-dial-icon-editor__letter">
            A
          </span>
        )}
        <div class="quick-dial-icon-editor__actions">
          <button
            aria-label="Change icon"
            class="quick-dial-icon-editor__button"
            disabled={disabled}
            onClick={() => input.current?.click()}
            title="Change icon"
            type="button"
          >
            <Pencil aria-hidden="true" size={14} />
          </button>
          {value && (
            <button
              aria-label="Remove uploaded icon"
              class="quick-dial-icon-editor__button"
              disabled={disabled}
              onClick={async () => {
                setError('')
                try {
                  const outcome = await onChange(null)
                  if (saveSucceeded(outcome)) await deleteIcon(value)
                  else setError("Couldn't save that Layout change.")
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Could not save this icon.')
                }
              }}
              title="Use the site’s favicon"
              type="button"
            >
              <X aria-hidden="true" size={14} />
            </button>
          )}
        </div>
        {pending && (
          <button disabled={disabled || saving} onClick={() => void confirm()} type="button">
            Use this icon
          </button>
        )}
        {error && (
          <p class="settings__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
