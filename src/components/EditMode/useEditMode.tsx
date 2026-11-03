import type { ComponentChildren } from 'preact'
import { createContext } from 'preact'
import { useCallback, useContext, useMemo, useState } from 'preact/hooks'

/** What the page says about edit mode (see CONTEXT.md). */
export type EditMode = {
  /**
   * Whether the Layout may be changed here: false while a newer version of the page wrote it.
   * Edit mode can still be entered, so that its controls can say why nothing changes.
   */
  canChange: boolean
  /** Whether the page is in edit mode. */
  editing: boolean
  /** Goes into edit mode. Does nothing if the page is already in it. */
  enter: () => void
  /** Comes out of it. Does nothing if the page is not in it. */
  leave: () => void
}

/**
 * Outside a provider the page is simply not editing, so that a Widget or a control can be drawn
 * on its own, in a test or a story, without one.
 */
const NOT_EDITING: EditMode = { canChange: true, editing: false, enter: () => {}, leave: () => {} }

const EditModeContext = createContext<EditMode>(NOT_EDITING)

type EditModeProviderProps = {
  /** True unless the Layout is read-only (see `useLayout`). */
  canChange?: boolean
  children?: ComponentChildren
}

/**
 * Holds whether the page is in edit mode. That is page state and nothing more: it starts out
 * off on every new tab, is never stored, and is not the same on two tabs.
 */
export function EditModeProvider({ canChange = true, children }: EditModeProviderProps) {
  const [editing, setEditing] = useState(false)
  const enter = useCallback(() => setEditing(true), [])
  const leave = useCallback(() => setEditing(false), [])
  const value = useMemo(
    () => ({ canChange, editing, enter, leave }),
    [canChange, editing, enter, leave],
  )
  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>
}

export const useEditMode = () => useContext(EditModeContext)
