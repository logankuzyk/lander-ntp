# Privacy Policy

_Last updated: October 1, 2026_

Lander is a browser extension that replaces your new tab page with photography from [logankuzyk.com](https://logankuzyk.com). This policy covers the extension on the Chrome Web Store, Firefox Add-ons and Microsoft Edge Add-ons.

## In short

Lander does not collect, sell or share any personal information. It has no accounts, analytics, advertising or tracking. Your settings and Layout stay in your browser. Weather is not on a new install until you add the Weather Widget to your Layout; it sends the place you choose to Open-Meteo to get a forecast.

## What Lander stores

Lander uses the browser's extension storage (the `storage` permission) to keep:

- **Your settings**: how photos rotate, which tags or photo you picked, font, dimming and page-wide values such as 12- or 24-hour time.
- **Your Layout**: which Widgets you put on the Grid, their positions and sizes, and their options, including Weather options such as place, units and display choices. Your settings and Layout are kept in the browser's synced storage, so if you are signed in to your browser with sync turned on, your browser carries them between your devices. That sync is run by your browser vendor (for example Google, Mozilla or Microsoft) under their privacy policy. Lander never receives this data.
- **A cached copy of the photo list**, so the new tab loads quickly and works offline.
- **The weather for each place you use**, cached on your device so it does not need to be fetched in every new tab.
- **Which photo is showing** and which are up next, so the rotation continues where it left off.

All of this stays on your device (and in your browser's sync, if you use it). Uninstalling the extension deletes it.

## Network requests

Lander makes only these requests:

- It **downloads the photo list** from `https://logankuzyk.com/new-tab/photos.json`, at most about every six hours.
- It **loads photo images** from the addresses in that list, which are hosted by logankuzyk.com.

If you switch on the weather widget, it also makes these requests to [Open-Meteo](https://open-meteo.com/), a free weather service:

- It **searches for a place** by the name you type, when you search from the Weather Widget's options.
- It **downloads the forecast** for the place you picked, at most about every half hour. The request carries that place's coordinates, rounded to about a kilometre, and your choice of Celsius or Fahrenheit.

The place is whichever one you pick from the search. If you instead set a Weather Widget to "Use my location", its Setup button asks the browser for location permission. Lander reads your device's location when a new tab opens and about every half hour while it stays open, so the weather follows you. Coordinates are rounded to about a kilometre before they are sent to the weather service as the place to forecast and, when needed, to [BigDataCloud](https://www.bigdatacloud.com/) to look up the name of the town you are in. Forecasts are cached on your device for each place the Layout uses; readings for places no longer used are removed. Lander never reads your device's location unless a Weather Widget is set to use it. When Weather is not in your Layout, no weather requests are made. The photo list, which is published by logankuzyk.com, can switch Weather off or point the forecast, place search and town name requests at a different service, if Open-Meteo or BigDataCloud stops being available. Those requests would then carry the same place to that service instead, always over an encrypted (https) connection; this policy will be updated if that happens. Open-Meteo's handling of them is covered by [its own terms and privacy policy](https://open-meteo.com/en/terms). In Firefox, pressing the Weather Widget's Setup button is how you allow Lander to request location access.

Apart from the place you pick for the weather, these requests carry nothing about you, your settings or your browsing. As with any website visit, the servers that answer them can see standard request information such as your IP address and browser user agent. It is used only to serve the files, and is not used to identify or track you.

Lander does not read your browsing history, the pages you visit, your tabs or any other data in your browser.

## Links

The photo details include links to the photo's page on logankuzyk.com and, for some photos, to a page where you can buy a print. Nothing is sent until you click one of these links. Once you do, you are on that website and its own privacy policy applies.

## Children

Lander does not knowingly collect information from anyone, including children under 13.

## Changes

If this policy changes, the new version will be published here with a new "Last updated" date. The history of every change is available in this repository.

## Contact

Questions about this policy can be asked by [opening an issue](https://github.com/logankuzyk/lander-ntp/issues) on GitHub.
