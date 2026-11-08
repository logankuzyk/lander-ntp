import { act, fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { afterEach, describe, expect, it } from 'vitest'

import { createFakeBookmarksPort } from '@/bookmarks/fake'
import { EditModeProvider, useEditMode } from '@/components/EditMode/useEditMode'
import { OptionsPopover } from '@/widgetSystem/OptionsPopover'
import { WidgetBox } from '@/widgetSystem/WidgetBox'

import { createBookmarksDefinition } from './definition'

const RECT = { col: 1, h: 4, row: 1, w: 6 }
const PAGE = { hour12: false }
const TREE = [
  {
    children: [
      {
        children: [
          { id: 'one', title: 'One bookmark', url: 'https://example.com/one' },
          { id: 'two', title: 'Two bookmark', url: 'https://example.com/two' },
        ],
        folderType: 'bookmarks-bar',
        id: 'bar',
        title: 'Bookmarks bar',
      },
    ],
    id: 'root',
    title: '',
  },
]

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the Bookmarks Widget', () => {
  it('shows the stored folder name as soon as its options open', () => {
    const port = createFakeBookmarksPort({ granted: true, tree: TREE })
    render(
      <OptionsPopover
        box={() => null}
        definition={createBookmarksDefinition(port)}
        name="Bookmarks, Reading"
        onChange={() => undefined}
        onClose={() => undefined}
        onPageValueChange={() => undefined}
        options={{
          folder: JSON.stringify({ id: 'reading', title: 'Reading' }),
          openInNewTab: false,
          showFolderName: true,
        }}
        page={PAGE}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Folder' }).textContent).toContain('Reading')
  })

  it('shows the portable Bookmarks bar name before loading choices', () => {
    const port = createFakeBookmarksPort({ granted: true, tree: TREE })
    render(
      <OptionsPopover
        box={() => null}
        definition={createBookmarksDefinition(port)}
        name="Bookmarks, Bookmarks bar"
        onChange={() => undefined}
        onClose={() => undefined}
        onPageValueChange={() => undefined}
        options={{ folder: 'bar', openInNewTab: false, showFolderName: true }}
        page={PAGE}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Folder' }).textContent).toContain('Bookmarks bar')
  })

  it('labels a saved folder missing from this device in its options', async () => {
    const port = createFakeBookmarksPort({ granted: true, tree: TREE })
    render(
      <OptionsPopover
        box={() => null}
        definition={createBookmarksDefinition(port)}
        name="Bookmarks, Reading"
        onChange={() => undefined}
        onClose={() => undefined}
        onPageValueChange={() => undefined}
        options={{
          folder: JSON.stringify({ id: 'gone', title: 'Reading' }),
          openInNewTab: false,
          showFolderName: true,
        }}
        page={PAGE}
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Folder' }))

    expect(await screen.findByRole('option', { name: 'Reading (folder missing)' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Folder' }).textContent).toContain(
      'Reading (folder missing)',
    )
  })

  it('clearly labels a missing saved folder that has no stored title', async () => {
    const port = createFakeBookmarksPort({ granted: true, tree: TREE })
    render(
      <OptionsPopover
        box={() => null}
        definition={createBookmarksDefinition(port)}
        name="Bookmarks"
        onChange={() => undefined}
        onClose={() => undefined}
        onPageValueChange={() => undefined}
        options={{ folder: 'gone', openInNewTab: false, showFolderName: true }}
        page={PAGE}
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Folder' }))

    expect(await screen.findByRole('option', { name: 'Folder missing' })).toBeTruthy()
  })

  it('lists the portable Bookmarks bar once, without a device-specific bar choice', async () => {
    const port = createFakeBookmarksPort({
      granted: true,
      tree: [
        {
          children: [
            {
              children: [{ children: [], id: 'reading', title: 'Reading' }],
              folderType: 'bookmarks-bar',
              id: 'bar-device-id',
              title: 'Bookmarks bar',
            },
          ],
          id: 'root',
          title: '',
        },
      ],
    })
    const [folderOption] = createBookmarksDefinition(port).options
    if (folderOption?.control !== 'pick') throw new Error('Folder is a pick option')

    const choices = await folderOption.load()

    expect(choices.filter(({ value }) => value === 'bar')).toEqual([
      { label: 'Bookmarks bar', value: 'bar' },
    ])
    expect(
      choices.some(
        ({ value }) => value === JSON.stringify({ id: 'bar-device-id', title: 'Bookmarks bar' }),
      ),
    ).toBe(false)
    expect(choices.map(({ label }) => label)).toContain('Reading')
  })

  it('draws links in rows before columns and uses the URL as their title', async () => {
    const port = createFakeBookmarksPort({ granted: true, tree: TREE })
    render(
      <WidgetBox
        definition={createBookmarksDefinition(port)}
        options={{ folder: 'bar', openInNewTab: false, showFolderName: true }}
        page={PAGE}
        rect={RECT}
      />,
    )

    const links = await screen.findAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['One bookmark', 'Two bookmark'])
    expect(links[0]?.getAttribute('title')).toBe('https://example.com/one')
    expect(links[0]?.hasAttribute('target')).toBe(false)
    expect(document.querySelector('.bookmarks__items')?.getAttribute('style')).toContain(
      '--bookmarks-columns: 3; --bookmarks-rows: 7',
    )
    expect(screen.getByText('Bookmarks bar')).toBeTruthy()
  })

  it('opens links in a new tab when that option is on', async () => {
    const port = createFakeBookmarksPort({ granted: true, tree: TREE })
    render(
      <WidgetBox
        definition={createBookmarksDefinition(port)}
        options={{ folder: 'bar', openInNewTab: true, showFolderName: false }}
        page={PAGE}
        rect={RECT}
      />,
    )

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2))
    expect(screen.getAllByRole('link')[0]?.getAttribute('target')).toBe('_blank')
    expect(screen.getAllByRole('link')[0]?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('requests bookmark access from the setup click before awaiting the request', async () => {
    const port = createFakeBookmarksPort({ tree: TREE })
    const setup = render(
      <WidgetBox
        definition={createBookmarksDefinition(port)}
        options={{ folder: 'bar', openInNewTab: false, showFolderName: true }}
        page={PAGE}
        rect={RECT}
      />,
    )
    const button = await screen.findByRole('button', {
      name: 'Bookmarks, Allow access to bookmarks',
    })
    let requested = false
    const request = port.request
    port.request = () => {
      requested = true
      return request()
    }

    await act(async () => {
      button.click()
      expect(requested).toBe(true)
    })
    setup.unmount()
  })

  it('replaces the permission Setup button with the Widget after access is granted', async () => {
    const port = createFakeBookmarksPort({ tree: TREE })
    render(
      <WidgetBox
        definition={createBookmarksDefinition(port)}
        options={{ folder: 'bar', openInNewTab: false, showFolderName: true }}
        page={PAGE}
        rect={RECT}
      />,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: 'Bookmarks, Allow access to bookmarks' }),
    )
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2), { timeout: 1000 })
  })

  it('shows the folder Need when its saved id and title are not on this device', async () => {
    const port = createFakeBookmarksPort({ granted: true, tree: TREE })
    render(
      <WidgetBox
        definition={createBookmarksDefinition(port)}
        options={{
          folder: JSON.stringify({ id: 'other-device', title: 'Reading' }),
          openInNewTab: false,
          showFolderName: true,
        }}
        page={PAGE}
        rect={RECT}
      />,
    )

    expect(await screen.findByRole('button', { name: 'Bookmarks, Choose a folder' })).toBeTruthy()
  })

  it('shows an empty-folder message and a count for overflow', async () => {
    const empty = createFakeBookmarksPort({
      granted: true,
      tree: [
        {
          children: [{ children: [], folderType: 'bookmarks-bar', id: 'bar', title: 'Bar' }],
          id: 'root',
          title: '',
        },
      ],
    })
    const { unmount } = render(
      <WidgetBox
        definition={createBookmarksDefinition(empty)}
        options={{ folder: 'bar', openInNewTab: false, showFolderName: false }}
        page={PAGE}
        rect={{ ...RECT, h: 2, w: 2 }}
      />,
    )
    expect(await screen.findByText('This folder is empty')).toBeTruthy()
    unmount()

    const items = Array.from({ length: 10 }, (_, index) => ({
      id: String(index),
      title: `Bookmark ${index}`,
      url: `https://example.com/${index}`,
    }))
    const overflow = createFakeBookmarksPort({
      granted: true,
      tree: [
        {
          children: [{ children: items, folderType: 'bookmarks-bar', id: 'bar', title: 'Bar' }],
          id: 'root',
          title: '',
        },
      ],
    })
    render(
      <WidgetBox
        definition={createBookmarksDefinition(overflow)}
        options={{ folder: 'bar', openInNewTab: false, showFolderName: false }}
        page={PAGE}
        rect={{ ...RECT, h: 2, w: 2 }}
      />,
    )
    await waitFor(() =>
      expect(document.querySelector('.bookmarks__more')?.textContent).toBe('+7 more'),
    )
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('does not navigate when a bookmark is pressed in edit mode', async () => {
    const port = createFakeBookmarksPort({ granted: true, tree: TREE })
    const definition = createBookmarksDefinition(port)
    function Editing() {
      return (
        <EditModeProvider>
          <EditMode />
        </EditModeProvider>
      )
    }
    function EditMode() {
      const { enter } = useEditMode()
      return (
        <>
          <button onClick={enter} type="button">
            Edit
          </button>
          <WidgetBox
            definition={definition}
            options={{ folder: 'bar', openInNewTab: false, showFolderName: false }}
            page={PAGE}
            rect={RECT}
          />
        </>
      )
    }
    const { container } = render(<Editing />)
    await screen.findAllByRole('link')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const link = container.querySelector('a')!
    const arrow = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowDown',
    })
    link.dispatchEvent(arrow)
    expect(arrow.defaultPrevented).toBe(false)
    const enterKey = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' })
    link.dispatchEvent(enterKey)
    expect(enterKey.defaultPrevented).toBe(true)
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })

  it('explains unsupported browser APIs in the Widget', async () => {
    const port = createFakeBookmarksPort({ supported: false })
    render(
      <WidgetBox
        definition={createBookmarksDefinition(port)}
        options={{ folder: 'bar', openInNewTab: false, showFolderName: true }}
        page={PAGE}
        rect={RECT}
      />,
    )
    expect(
      await screen.findByText("Bookmarks aren't available in this browser", {}, { timeout: 1000 }),
    ).toBeTruthy()
  })

  it('names two Bookmarks Widgets by their saved folder titles', () => {
    const port = createFakeBookmarksPort({ granted: true, tree: TREE })
    render(
      <>
        <WidgetBox
          definition={createBookmarksDefinition(port)}
          id="reading"
          options={{
            folder: JSON.stringify({ id: 'reading', title: 'Reading' }),
            openInNewTab: false,
            showFolderName: true,
          }}
          page={PAGE}
          rect={RECT}
        />
        <WidgetBox
          definition={createBookmarksDefinition(port)}
          id="work"
          options={{
            folder: JSON.stringify({ id: 'work', title: 'Work' }),
            openInNewTab: false,
            showFolderName: true,
          }}
          page={PAGE}
          rect={{ ...RECT, row: 4 }}
        />
      </>,
    )
    expect(screen.getByRole('group', { name: 'Bookmarks, Reading' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Bookmarks, Work' })).toBeTruthy()
  })
})
