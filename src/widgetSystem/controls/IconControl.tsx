import { useRef, useState } from 'preact/hooks'

import { canvasIconEncoder, encodeIcon } from '@/quickDial/icon'
import { deleteIcon, saveIcon } from '@/quickDial/iconStorage'
import { useIcon } from '@/quickDial/useIcon'

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
      if (outcome === false) {
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
      <div>
        <input
          accept="image/*"
          aria-label="Upload an icon"
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
        {pending && <img alt="Icon preview" class="settings__icon-preview" src={pending} />}
        {!pending && (
          <span class="settings__note">
            {uploaded ? 'Uploaded icon' : siteIcon ? 'The site’s own icon' : 'A letter'}
          </span>
        )}
        <div class="settings__icon-actions">
          <button disabled={disabled} onClick={() => input.current?.click()} type="button">
            Upload
          </button>
          {pending && (
            <button disabled={disabled || saving} onClick={() => void confirm()} type="button">
              Use this icon
            </button>
          )}
          {value && (
            <button
              disabled={disabled}
              onClick={async () => {
                const outcome = await onChange(null)
                if (outcome !== false) await deleteIcon(value)
              }}
              type="button"
            >
              Use the site’s icon
            </button>
          )}
        </div>
        {error && (
          <p class="settings__error" role="alert">
            {error}
          </p>
        )}
        {preview && !pending && <img alt="" class="settings__icon-preview" src={preview} />}
      </div>
    </div>
  )
}
