# Lander NTP

A new tab page that shows a full-screen photo with things the user chooses to put on top of it.

## Language

**Widget**:
Something the user places on the grid and configures, such as a clock or the weather.
_Avoid_: Component, tile, card

**Grid**:
The area of the page where widgets are placed and aligned. It excludes the bottom bar.
_Avoid_: Canvas, board

**Layout**:
The widgets a user has placed on the grid, with their places, sizes and options. It is the same on every device.
_Avoid_: Arrangement, dashboard

**Bottom bar**:
The fixed strip along the bottom of the page holding the photo credit and the page's buttons. It belongs to the page, not to the user's layout.
_Avoid_: Footer, controls, toolbar

**Edit mode**:
How the page is while the user arranges it: the Grid shows a dot at every cell corner and each widget sits in a frame with its name. Entered with the Edit button in the bottom bar or the E key, and left with Done, E or Escape. It belongs to the open tab and is never stored, so every new tab starts out of it.
_Avoid_: Design mode, layout mode

**Add menu**:
The menu opened by Add in the Bottom bar while in Edit mode. It lists Widgets that can be added to the Grid and explains when an item is unavailable.
_Avoid_: Widget picker

**Options popover**:
A Widget's options shown in a popover beside it. It opens from the Widget's options button in Edit mode or from its Setup button when a Need is unmet. Changes save as they are made.
_Avoid_: Settings panel

**Need**:
Something that must be true before a widget can show anything, such as a granted permission, a chosen place, or a connected account. A widget lists its needs in order.
_Avoid_: Requirement, prerequisite

**Setup button**:
The button a widget shows in place of its content while a need is unmet. Pressing it meets the next need: it asks for a permission, opens the widget's options at what is missing, or starts sign-in.
_Avoid_: Call to action, CTA, onboarding button

**Source**:
Where a widget's data comes from, such as a weather service. One shared loader fetches, caches and refreshes every source.
_Avoid_: Provider, feed, data fetcher

**Page-wide value**:
A setting shared by the whole page that widgets can show as one of their options, such as 12- or 24-hour time. Changing it on one widget changes it everywhere.
_Avoid_: Global option, shared option

**Waiting options**:
Options carried over from the settings (or the defaults) for a Widget type that was off, used for the first one added. That Widget gets them, then they are removed from the waiting options.
_Avoid_: Pending options

**Widget limit**:
The number of widgets a user may place on the grid at once (8). Each widget the page draws counts as one, at any size; one that is kept but never drawn (malformed, or with no free place) does not, since it has no × to remove it by. A layout already over it loads whole; only adding stops.
_Avoid_: Cap, quota

**Background**:
The page behind the Widgets: either the photo currently shown or a colour chosen in the Background tab.
_Avoid_: Wallpaper

**Favourite**:
A photo marked to be included in the Favourites photo pool. Its id is kept even when the photo is temporarily absent from the current photo list.
_Avoid_: Saved photo

**Pattern tag**:
A photo tag marked `optIn` by the website. Photos with a Pattern tag are left out of All and can be included by choosing one of their tags.
_Avoid_: Pattern category

**Quick dial**:
A Widget with a link to a site and its icon. It can use the site's favicon or an uploaded Icon.
_Avoid_: Bookmark tile

**Icon**:
The image shown for a Quick dial, either the site's favicon or a small uploaded image.
_Avoid_: Logo

**Walk**:
The guided tour through actions on the page and in Settings.
_Avoid_: Tutorial mode

**New mark**:
The small indicator beside a new feature until it has been shown once.
_Avoid_: Badge

**Run**:
One active Walk or update callout flow, made up of ordered stops.
_Avoid_: Session
