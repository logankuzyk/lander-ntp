import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'

import { PickFromList } from './PickFromList'

const CHOICES = [
  { label: 'Work', value: 'work' },
  { depth: 1, label: 'Team', value: 'team' },
] as const

describe('PickFromList', () => {
  it('loads only when opened, shows loading, then the choices with indentation', async () => {
    let resolve!: (choices: typeof CHOICES) => void
    const load = vi.fn(() => new Promise<typeof CHOICES>((done) => (resolve = done)))
    render(
      <PickFromList
        emptyText="No lists"
        failedText="Could not load lists"
        label="Folder"
        load={load}
        onChange={vi.fn()}
        value="work"
      />,
    )

    expect(load).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('combobox', { name: 'Folder' }))
    expect(load).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Loading…')).toBeTruthy()
    resolve(CHOICES)

    expect(await screen.findByRole('option', { name: 'Work' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Team' }).getAttribute('style')).toContain('16px')
  })

  it('shows an empty row when loading succeeds without choices', async () => {
    render(
      <PickFromList
        emptyText="No lists here"
        failedText="Could not load lists"
        label="Folder"
        load={async () => []}
        onChange={vi.fn()}
        value=""
      />,
    )
    fireEvent.click(screen.getByRole('combobox', { name: 'Folder' }))
    expect(await screen.findByText('No lists here')).toBeTruthy()
  })

  it('offers Retry after a failure and loads again when pressed', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(CHOICES)
    render(
      <PickFromList
        emptyText="No lists"
        failedText="Could not load lists"
        label="Folder"
        load={load}
        onChange={vi.fn()}
        value="work"
      />,
    )
    fireEvent.click(screen.getByRole('combobox', { name: 'Folder' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('option', { name: 'Work' })).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('keeps a missing stored value visible until a choice is picked', async () => {
    const onChange = vi.fn()
    render(
      <PickFromList
        emptyText="No lists"
        failedText="Could not load lists"
        label="Folder"
        load={async () => CHOICES}
        onChange={onChange}
        value="gone"
      />,
    )
    fireEvent.click(screen.getByRole('combobox', { name: 'Folder' }))
    expect(
      (await screen.findByRole('option', { name: 'Not on this device' })).getAttribute(
        'aria-selected',
      ),
    ).toBe('true')
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('option', { name: 'Work' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('work')
  })

  it('adds and removes several choices with one change per pick', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <PickFromList
        emptyText="No lists"
        failedText="Could not load lists"
        label="Calendars"
        load={async () => CHOICES}
        multiple
        onChange={onChange}
        value={['work']}
      />,
    )
    fireEvent.click(screen.getByRole('combobox', { name: 'Calendars' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Team' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['work', 'team'])
    rerender(
      <PickFromList
        emptyText="No lists"
        failedText="Could not load lists"
        label="Calendars"
        load={async () => CHOICES}
        multiple
        onChange={onChange}
        value={['work', 'team']}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remove Work' }))
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith(['team'])
  })
})
