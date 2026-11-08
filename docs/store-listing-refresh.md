# Store listing refresh

Owner checklist for the next phase 2 store refresh. This is preparation for the owner; no listing is published by this document.

## Text

- Describe Lander as a new tab page with a photo and a Grid of Widgets, including a Clock and optional Weather.
- Explain Edit mode, where people can add, move, resize and remove Widgets.
- Explain that Widget options open beside the Widget and that Weather needs a chosen place or location permission before showing a forecast. On Firefox it also first asks you to agree to Lander sending location information (the Weather's "Allow sending your place" button).
- Remove any claim, and any screenshot, that says the weather is "switched on" in settings or that shows the old Clock and Weather tabs in the settings panel: those options are on the Widgets now.
- Refresh permission and privacy wording to match `PRIVACY.md` and each store's current permission screen.

## Screenshots

- New install with the Clock on the Grid over a photo.
- Edit mode with the Grid visible and the Add and Done buttons in the Bottom bar.
- Add menu showing the Widgets available to add.
- Weather options beside the Widget, including place search and the Setup button state.

## Forms and release notes

- Chrome Web Store and Edge Add-ons: update the data-disclosure (privacy practices) forms to match `PRIVACY.md`, in particular what the Weather Widget sends (a place, rounded to about a kilometre, to Open-Meteo and, for the device's position, to BigDataCloud).
- Firefox Add-ons: the manifest's `data_collection_permissions` has `locationInfo` as an optional data permission (required: none); the listing's data-collection text should say the same, and that nothing is sent until the person agrees.
- Release notes for 0.3.0 (the phase 2 release): the Grid of Widgets, edit mode, options beside the Widgets, the Weather as a Widget you add, and the guided tour for new installs.
