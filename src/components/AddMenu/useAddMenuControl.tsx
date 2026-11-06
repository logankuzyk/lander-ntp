import type { ComponentChildren } from 'preact'
import { createContext } from 'preact'
import { useCallback, useContext, useMemo, useState } from 'preact/hooks'

/** The Add menu's state, for whoever has to open it besides the Add button and the A key. */
export type AddMenuControl = {
  /** Whether the menu is open. */
  open: boolean
  /**
   * Whether it was opened without taking focus (see `setOpen`). Always false once it is shut,
   * and when the Add button or the A key opened it.
   */
  quiet: boolean
  /**
   * Opens or shuts the menu. A `quiet` opening leaves focus where it was, instead of putting it
   * on the first item: for the tour, whose Next button keeps focus while the menu it is
   * describing opens.
   */
  setOpen: (open: boolean, how?: { quiet?: boolean }) => void
}

const AddMenuControlContext = createContext<AddMenuControl | null>(null)

/**
 * Holds whether the Add menu is open, so that the tour can open it. Page state, never stored.
 * Without one around it, the controls keep the state themselves, as a story or a test of them
 * on their own has it.
 */
export function AddMenuControlProvider({ children }: { children?: ComponentChildren }) {
  const [state, setState] = useState({ open: false, quiet: false })
  // The same function on every render, so that an effect can depend on it.
  const setOpen = useCallback<AddMenuControl['setOpen']>((open, how) => {
    const quiet = open && how?.quiet === true
    setState((was) => (was.open === open && was.quiet === quiet ? was : { open, quiet }))
  }, [])
  const value = useMemo<AddMenuControl>(
    () => ({ open: state.open, quiet: state.quiet, setOpen }),
    [state, setOpen],
  )
  return <AddMenuControlContext.Provider value={value}>{children}</AddMenuControlContext.Provider>
}

/** The handle on the Add menu, or null where there is no provider. */
export const useAddMenuControl = () => useContext(AddMenuControlContext)
