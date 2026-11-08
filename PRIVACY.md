# Privacy Policy

_Last updated: November 8, 2026_

Lander is a browser extension that replaces your new tab page with photography from [logankuzyk.com](https://logankuzyk.com). This policy covers the extension on the Chrome Web Store, Firefox Add-ons and Microsoft Edge Add-ons.

## Without an account

Without an account, Lander sends no account data to its server. Lander has no analytics, advertising or tracking. It still stores your Layout, settings, photo list cache, current photo and weather cache in your browser. If browser sync is enabled, the browser vendor may sync extension settings under its own privacy policy. Lander does not receive those settings unless you choose to sign in and sync them through a Lander account. Weather is not on a new install until you add the Weather Widget to your Layout; it sends the place you choose to the configured weather service for a forecast and, if it follows your location, sends your rounded position to that service and to BigDataCloud for the town name.

The extension downloads the photo list from `https://logankuzyk.com/new-tab/photos.json` and loads the photo images listed there. It caches the list and images for loading and offline use. Photo details may link to logankuzyk.com or a print page; no request to those pages is made until you follow a link.

The photo list, photos and weather Sources can receive standard web request information, such as an IP address and browser user agent, as part of serving a request. See those services' policies for their handling. Lander does not read browsing history, visited pages or tabs.

### Information stored in your browser

- **Your settings**: how photos rotate, which tags or photo you picked, font, dimming and page-wide values such as 12- or 24-hour time. They also still hold a clock block and a weather block: if you set up the clock or the weather in an earlier version, the choices you made then, including the place you picked and whether the weather followed your location, and otherwise the defaults. This version does not rewrite those blocks.
- **Your Layout**: which Widgets you put on the Grid, their positions and sizes, and their options, including Weather options such as place, units and display choices. Your settings and Layout are kept in the browser's synced storage, so if you are signed in to your browser with sync turned on, your browser carries them between your devices. That sync is run by your browser vendor (for example Google, Mozilla or Microsoft) under their privacy policy. Lander never receives this data.
- **Which welcome and update notes you have seen**, so each is shown once. This is kept in synced storage too, with a copy on your device for a new install until you have answered the welcome.
- **A cached copy of the photo list**, so the new tab loads quickly and works offline.
- **The weather for each place you use**, cached on your device so it does not need to be fetched in every new tab. These are not synced.
- **Your device's last position, rounded to about a kilometre, with the name of the town**, only if a Weather follows your location. This is not synced.
- **Which photo is showing** and which are up next, so the rotation continues where it left off.

### Weather service requests

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

## If you sign in

This section covers data sent to Lander's account server at `https://api.lander-ntp.com` when you choose to sign in. Sign-in is optional. You enter an email address and receive a one-time code, which expires after five minutes. Lander does not ask for or store a password.

The server stores your email address, synced Layout, settings and onboarding state, and session records used to keep you signed in and manage your devices. Synced settings can include the Weather place you chose. A session record includes a bearer session token, expiry, creation and last-use times, and a reduced browser and operating system label. The server does not put an IP address in device rows. The server also temporarily processes an IP address to limit sign-in email requests. It does not collect your browsing history or pages visited, and does not use analytics or advertising. The account service does not collect payment details or device position.

Lander uses this data to authenticate you, sync your Layout and settings between your devices, show and remove signed-in devices, enforce the three-device limit, and provide account deletion and export. The one-time code is stored hashed for verification and expires after five minutes. Session tokens expire after 60 days; activity updates the session. Accounts unused for 12 months are deleted. Device sessions are removed when you sign out, remove the device, or the session expires.

Account data is stored in the server database and included in nightly database dumps. Dumps older than 30 days are removed. A separate deleted-account list contains a random account id and deletion time for up to 30 days, so a deleted account is not restored from an older dump. A deletion may remain in a dump already made until that dump ages out. The service is configured to use Cloudflare R2 for dumps when production backup credentials are configured; otherwise it uses the server's object store. The production hosting location, backup volume retention and data-processing countries require confirmation from the service operator before publication.

The server sends sign-in email through Resend. Your email address and the one-time code are sent to that provider to deliver the message. Resend's retention period and processing country require confirmation from the service operator. The account server runs on a VPS; its operator and hosting country require confirmation. Cloudflare processes stored dumps when R2 is configured; the applicable data location requires confirmation. Your browser vendor may receive synced data through its own extension storage when browser sync is enabled.

You can review or correct account details and synced items through the account settings where available, or request access, correction, deletion or a JSON copy by contacting the privacy address. You can withdraw Firefox data collection consent in Firefox's `about:addons` page. Requests will be answered within 30 days. You may also complain to your local data protection authority. The privacy contact address must be supplied by the service operator before publication.

For Chrome Web Store users: Lander's use and transfer of information received from Google APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data), including the Limited Use requirements.

Lander uses HTTPS for account requests and stores bearer tokens in browser extension storage. Access to an account API requires a valid bearer token. No system can be guaranteed completely secure; contact the privacy address if you believe account data has been exposed.

## Children

Lander is not directed to children under 13 and does not knowingly collect information from children under 13. If the operator learns that an account belongs to a child under 13, it will delete the account and associated data.

## Links

The photo details include links to the photo's page on logankuzyk.com and, for some photos, to a page where you can buy a print. The Weather Widget's options show a "Weather data by Open-Meteo.com" link to the Open-Meteo website. Nothing is sent until you click one of these links. Once you do, you are on that website and its own privacy policy applies.

## Changes

If this policy changes, the new version will be published here with a new "Last updated" date. The history of every change is available in this repository.

## Contact

Contact the operator about this policy or your account at the privacy address, which must be supplied by the service operator before publication.
