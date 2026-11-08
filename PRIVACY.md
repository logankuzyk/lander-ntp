# Privacy Policy

_Last updated: October 1, 2026_

Lander is a browser extension that replaces your new tab page with photography from [logankuzyk.com](https://logankuzyk.com). This policy covers the extension on the Chrome Web Store, Firefox Add-ons and Microsoft Edge Add-ons.

## In short

Lander does not collect, sell or share any personal information. It has no accounts, analytics, advertising or tracking. Your settings and Layout stay in your browser. Weather is not on a new install until you add the Weather Widget to your Layout; it sends the place you choose to Open-Meteo to get a forecast and, if it follows your location, sends your rounded position to Open-Meteo and to BigDataCloud (for the name of the town).

## What Lander stores

Lander uses the browser's extension storage (the `storage` permission) to keep:

- **Your settings**: how photos rotate, which tags or photo you picked, font, dimming and page-wide values such as 12- or 24-hour time. They also still hold a clock block and a weather block: if you set up the clock or the weather in an earlier version, the choices you made then, including the place you picked and whether the weather followed your location, and otherwise the defaults. This version does not rewrite those blocks.
- **Your Layout**: which Widgets you put on the Grid, their positions and sizes, and their options, including Weather options such as place, units and display choices. Your settings and Layout are kept in the browser's synced storage, so if you are signed in to your browser with sync turned on, your browser carries them between your devices. That sync is run by your browser vendor (for example Google, Mozilla or Microsoft) under their privacy policy. Lander never receives this data.
- **Which welcome and update notes you have seen**, so each is shown once. This is kept in synced storage too, with a copy on your device for a new install until you have answered the welcome.
- **A cached copy of the photo list**, so the new tab loads quickly and works offline.
- **The weather for each place you use**, cached on your device so it does not need to be fetched in every new tab. These are not synced.
- **Your device's last position, rounded to about a kilometre, with the name of the town**, only if a Weather follows your location. This is not synced.
- **Which photo is showing** and which are up next, so the rotation continues where it left off.

All of this stays on your device (and in your browser's sync, if you use it). Uninstalling the extension deletes it.

## Network requests

Lander makes only these requests:

- It **downloads the photo list** from `https://logankuzyk.com/new-tab/photos.json`, at most about every six hours.
- It **loads photo images** from the addresses in that list, which are hosted by logankuzyk.com.
- When a **Quick dial Widget** is on the Grid, it may load that site's icon from `https://<site-host>/favicon.ico`. The request goes directly to the site whose address you chose, without a referrer; no host permission or icon service is used. If no icon is available, Lander draws a letter instead.

If you add the Weather Widget, it also makes these requests to [Open-Meteo](https://open-meteo.com/), a free weather service:

- It **searches for a place** as you type in the Weather Widget's place box: once the typing pauses for about a third of a second and there are at least two characters, one request for each pause. The request carries the text you have typed and your browser's language.
- It **downloads the forecast** for the place the Weather is set to, at most about every half hour. The request carries that place's coordinates, rounded to about a kilometre, and your choice of Celsius or Fahrenheit.

How the place is chosen:

- **A place you search for**: the place you pick from the results is the one whose forecast is shown.
- **"Current location"**: choosing it in the place box asks the browser for permission to read your device's location (the browser's own prompt). A Weather that follows your location also shows a Setup button, "Allow location", when this device has not allowed it (the setting is synced and the permission is not); the button asks the browser, and Lander never asks on its own.
- **Following your location**: Lander then reads your device's location when a new tab opens and about every half hour while it stays open, so the weather follows you. Coordinates are rounded to about a kilometre before they are sent to Open-Meteo as the place to forecast and, to look up the name of the town you are in, to [BigDataCloud](https://www.bigdatacloud.com/) (`api-bdc.io`) along with your browser's language. The town lookup is made only when the position is new (about 5 kilometres from the last one) or the town's name is missing. The last position and the town's name are kept on your device only, are not synced, and are replaced as you move.
- Lander never reads your device's location unless a Weather is set to use it.

Other things about the weather requests:

- **Firefox** asks you to agree to Lander sending location information. That is a separate agreement from the device's location permission, and it is the first thing a Weather needs, whether it uses a place you picked or follows your location. A Setup button, "Allow sending your place", on the Weather (and the same button in its options) asks for it. Until you agree, Lander sends nothing for that Weather: no place search, no forecast and no town lookup, and it does not read your position.
- **Other devices**: Chrome and Edge have no such prompt, so the agreement is met at once there. A Weather you add on one device with a place chosen is part of your synced Layout, so on every other device signed in with sync it starts fetching its forecast for that place from Open-Meteo, with nothing to do on that device. Only Firefox, and a Weather that follows your location (each device must allow it), wait for something on the device itself.
- **Cache**: forecasts are cached on your device for each place the Layout uses, and readings for places no longer used are removed. A single reading saved by version 0.2.x is no longer used; it stays in your browser's local storage until you uninstall the extension.
- **No Weather, no requests**: when Weather is not in your Layout, no weather requests are made.
- **Other services**: the photo list, which is published by logankuzyk.com, can switch Weather off or point the forecast, place search and town name requests at a different service, if Open-Meteo or BigDataCloud stops being available. Those requests would then carry the same information to that service instead, always over an encrypted (https) connection; this policy will be updated if that happens. Open-Meteo's handling of the requests is covered by [its own terms and privacy policy](https://open-meteo.com/en/terms).

Apart from the place you pick for the weather, and the site whose icon a Quick dial loads, these requests carry nothing about you, your settings or your browsing. As with any website visit, the servers that answer them can see standard request information such as your IP address and browser user agent. It is used only to serve the files, and is not used to identify or track you.

Lander does not read your browsing history, the pages you visit, your tabs or any other data in your browser.

## Links

The photo details include links to the photo's page on logankuzyk.com and, for some photos, to a page where you can buy a print. The Weather Widget's options show a "Weather data by Open-Meteo.com" link to the Open-Meteo website. Nothing is sent until you click one of these links. Once you do, you are on that website and its own privacy policy applies.

## Children

Lander does not knowingly collect information from anyone, including children under 13.

## Changes

If this policy changes, the new version will be published here with a new "Last updated" date. The history of every change is available in this repository.

## Contact

Questions about this policy can be asked by [opening an issue](https://github.com/logankuzyk/lander-ntp/issues) on GitHub.
