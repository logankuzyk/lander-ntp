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

**Widget limit**:
The number of widgets a user may place on the grid at once.
_Avoid_: Cap, quota
