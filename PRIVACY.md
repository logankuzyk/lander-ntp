# Privacy Policy

_Last updated: November 8, 2026_

Lander is a browser extension that replaces your new tab page with photography from [logankuzyk.com](https://logankuzyk.com). This policy covers the extension on the Chrome Web Store, Firefox Add-ons and Microsoft Edge Add-ons.

## Without an account

Without an account, Lander sends no account data to its server. It still stores your Layout, settings, photo list cache, current photo and weather cache in your browser. If browser sync is enabled, the browser vendor may sync extension settings under its own privacy policy. Lander does not receive those settings unless you choose to sign in and sync them through a Lander account.

The extension downloads the photo list from `https://logankuzyk.com/new-tab/photos.json` and loads the photo images listed there. It caches the list and images for loading and offline use. Photo details may link to logankuzyk.com or a print page; no request to those pages is made until you follow a link.

The optional Weather Widget is off until you switch it on. It asks [Open-Meteo](https://open-meteo.com/) for the forecast for the place you choose. Place search sends the search text when you press Search. Forecast requests send the chosen place's coordinates and your Celsius or Fahrenheit choice. If you choose **Use my location**, the browser asks for permission; Lander reads your position while the new tab is open and sends the rounded position to the configured weather Source and, when needed, [BigDataCloud](https://www.bigdatacloud.com/) to look up the town name. The position is not stored in synced settings. Firefox asks for data collection consent before location or account features are used. The photo list can configure the weather Source; if it changes, the request recipient changes accordingly.

The photo list, photos and weather Sources can receive standard web request information, such as an IP address and browser user agent, as part of serving a request. See those services' policies for their handling. Lander does not read browsing history, visited pages or tabs.

## If you sign in

This section covers data sent to Lander's account server at `https://api.lander-ntp.com` when you choose to sign in. Sign-in is optional. You enter an email address and receive a one-time code, which expires after five minutes. Lander does not ask for or store a password.

The server stores your email address, synced Layout, settings and onboarding state, and session records used to keep you signed in and manage your devices. Synced settings can include the Weather place you chose. A session record includes a bearer session token, expiry, creation and last-use times, and a reduced browser and operating system label. The server does not put an IP address in device rows. The server also temporarily processes an IP address to limit sign-in email requests. It does not collect your browsing history or pages visited, and does not use analytics or advertising. The account service does not collect payment details or device position.

Lander uses this data to authenticate you, sync your Layout and settings between your devices, show and remove signed-in devices, enforce the three-device limit, and provide account deletion and export. The one-time code is stored hashed for verification and expires after five minutes. Session tokens expire after 60 days; activity updates the session. Accounts unused for 12 months are deleted. Device sessions are removed when you sign out, remove the device, or the session expires.

Account data is stored in the server database and included in nightly database dumps. Dumps older than 30 days are removed. A separate deleted-account list contains a random account id and deletion time for up to 30 days, so a deleted account is not restored from an older dump. A deletion may remain in a dump already made until that dump ages out. The service is configured to use Cloudflare R2 for dumps when production backup credentials are configured; otherwise it uses the server's object store. The production hosting location, backup volume retention and data-processing countries require confirmation from the service operator before publication.

The server sends sign-in email through Resend. Your email address and the one-time code are sent to that provider to deliver the message. Resend's retention period and processing country require confirmation from the service operator. The account server runs on a VPS; its operator and hosting country require confirmation. Cloudflare processes stored dumps when R2 is configured; the applicable data location requires confirmation. Your browser vendor may receive synced data through its own extension storage when browser sync is enabled.

You can review or correct account details and synced items through the account settings where available, or request access, correction, deletion or a JSON copy by contacting the privacy address. You can withdraw Firefox data collection consent in Firefox's `about:addons` page. Requests will be answered within 30 days. You may also complain to your local data protection authority. The privacy contact address must be supplied by the service operator before publication.

For Chrome Web Store users: Lander's use and transfer of information received from Google APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data), including the Limited Use requirements.

Lander is not directed to children under 13. If the operator learns that an account belongs to a child under 13, it will delete the account and associated data.

Lander uses HTTPS for account requests and stores bearer tokens in browser extension storage. Access to an account API requires a valid bearer token. No system can be guaranteed completely secure; contact the privacy address if you believe account data has been exposed.

## Contact

Contact the operator about this policy or your account at the privacy address, which must be supplied by the service operator before publication.
