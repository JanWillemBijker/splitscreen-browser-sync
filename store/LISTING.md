# Chrome Web Store listing – SplitScreen Browser Sync 1.1.0

Everything needed to fill in the Chrome Web Store Developer Dashboard. Primary language: English; Dutch is added as a second localized listing.

## Basics

| Field | Value |
|---|---|
| Name (from `_locales`, max 75) | SplitScreen Browser Sync (24 chars) |
| Short description EN (manifest, max 132) | Sync scrolling, clicks and hover between the two tabs of a Chrome Split View. Made for comparing live and staging sites. (120 chars) |
| Short description NL (manifest, max 132) | Synchroniseer scrollen, klikken en hover tussen de twee tabbladen van een Chrome Split View. Voor live en staging naast elkaar. (127 chars) |
| Category | Productivity → Developer Tools |
| Language | English (default), Dutch |
| Version | 1.1.0 |
| Minimum Chrome | 140 (needs Chrome's native Split View) |
| Homepage / support URL | https://bijbijker.nl |
| Privacy policy URL | Publish `store/PRIVACY.md` at a public URL (for example https://bijbijker.nl/splitscreen-browser-sync/privacy or the GitHub file view) and paste that link |
| Developer / credit | BijBijker – https://bijbijker.nl |

## Detailed description – English

SplitScreen Browser Sync keeps the two panes of Chrome's native Split View scrolled to exactly the same position. Put your live site next to its staging copy, a design next to its build, or two versions of a page side by side, and scroll once.

What it does
• Pixel-exact scroll sync in both directions, without smoothing or lag, or align on matching content when one page is taller
• Page checklist for live vs staging: paste your paths, step through them with Previous/Next on both sites, mark Good/Wrong/N/A with notes, export to CSV
• Overlay: lay one side over the other with an opacity slider, a difference blend that makes changed pixels light up, or a swipe divider
• Inspect differences: point at an element and see which CSS (font, size, colour, spacing, layout) differs from the same element on the other side
• Recent pairs: reopen two sites side by side as a Split View with one click; pin favourites
• Hold Alt (Option) to scroll one side on its own; letting go sets the scroll offset
• Also syncs scroll areas (modals, side panels) and the zoom level
• Shows the width and height of each pane, with width presets (375 to 1440 px)
• Every Split View pair stays separate, even with ten pairs open
• Keeps syncing after a normal or hard reload of either side
• Sync navigation (on by default): follow a link on one side and the other side opens the same path on its own domain (live ↔ staging)
• Origin pinning: everything is mirrored only between the two sites you pressed Start sync for; if a pane opens another site, sync pauses until you start it again
• Mirror hover effects (on by default): see CSS hover styles and hover menus on both sides
• Show mouse cursor (on by default): a pointer in the other pane follows your mouse, with a ripple when you click. Display only, it never clicks anything
• Mirror clicks (off by default): open menus, accordions and modals on both sides at once. Submit buttons, forms that post data and delete/pay/confirm/log-out actions are never clicked on the other side
• Sync typing (off by default): fill in a form once for both sides. Never password, code, payment or file fields, and never submits
• Scroll offset in pixels when one layout is taller than the other
• Synced ruler lines to check alignment
• Optionally hides the WordPress admin bar so both layouts line up
• Reload or hard reload just one side
• Keyboard shortcuts for starting and stopping sync

How to use it
1. Right-click a tab and choose "Add tab to new split view".
2. Pick the second page.
3. Open the extension and press Start sync, or use the floating button on the page.

Privacy
No account, no tracking, no analytics, no remote code, and nothing is sent to the developer. To sync, the extension passes the scroll position, the path of the page you navigate to, your mouse pointer position, the zoom level and (if enabled) the element you hover or click, what you type, an image of the other pane for the overlay and CSS values for the inspector from one pane to the other, only between the two sites you started sync for. Checklists and recent pairs stay on your device. Password, PIN and payment fields are never read or mirrored. The overlay asks once for permission to capture tabs; everything else works without it.

Made by BijBijker – https://bijbijker.nl

## Detailed description – Nederlands

SplitScreen Browser Sync houdt de twee helften van de Split View in Chrome op precies dezelfde scrollpositie. Zet je live site naast de staging-versie, een ontwerp naast de bouw, of twee versies van een pagina naast elkaar, en scroll maar één keer.

Wat het doet
• Pixel-exacte scroll-sync in beide richtingen, zonder vertraging, of uitlijnen op overeenkomende inhoud als één pagina hoger is
• Checklist voor live en staging: plak je paden, loop ze met Vorige/Volgende op beide sites langs, markeer Goed/Fout/N.v.t. met notities, exporteer naar CSV
• Overlay: leg de ene kant over de andere met een schuifregelaar voor de dekking, een verschil-weergave waarin gewijzigde pixels oplichten, of een schuifbalk
• Verschillen inspecteren: wijs een element aan en zie welke CSS (lettertype, grootte, kleur, ruimte, opmaak) afwijkt van hetzelfde element aan de andere kant
• Recente paren: open twee sites met één klik weer naast elkaar als Split View; zet favorieten vast
• Houd Alt (Option) ingedrukt om één kant los te scrollen; bij loslaten wordt dat de scroll-offset
• Synchroniseert ook scrollgebieden (modals, zijpanelen) en het zoomniveau
• Toont de breedte en hoogte van elke helft, met breedte-voorinstellingen (375 tot 1440 px)
• Elk Split View-paar blijft apart, ook met tien paren open
• Blijft syncen na normaal of hard herladen van een kant
• Navigatie synchroniseren (standaard aan): volg een link aan de ene kant en de andere kant opent hetzelfde pad op het eigen domein (live ↔ staging)
• Origin pinning: er wordt alleen gespiegeld tussen de twee sites waarvoor je op Sync starten klikte; opent een helft een andere site, dan pauzeert de sync tot je hem opnieuw start
• Hover-effecten spiegelen (standaard aan): CSS-hoverstijlen en hover-menu's aan beide kanten zien
• Muiscursor tonen (standaard aan): een aanwijzer in de andere helft volgt je muis, met een rimpeling als je klikt. Alleen tonen, er wordt nooit iets mee aangeklikt
• Klikken spiegelen (standaard uit): menu's, accordeons en modals aan beide kanten tegelijk openen. Verzendknoppen, formulieren die gegevens versturen en acties als verwijderen, betalen, bevestigen of uitloggen worden aan de andere kant nooit aangeklikt
• Typen synchroniseren (standaard uit): vul een formulier één keer in voor beide kanten. Nooit wachtwoord-, code-, betaal- of bestandsvelden, en verstuurt nooit iets
• Scroll-offset in pixels als de ene lay-out hoger is dan de andere
• Gesynchroniseerde linialen om uitlijning te controleren
• Verbergt desgewenst de WordPress-adminbalk zodat beide lay-outs gelijk lopen
• Eén kant herladen of hard herladen
• Sneltoetsen om de sync te starten en te stoppen

Zo werkt het
1. Klik met rechts op een tabblad en kies de optie voor een nieuwe gesplitste weergave (Split View).
2. Kies de tweede pagina.
3. Open de extensie en klik op Sync starten, of gebruik de zwevende knop op de pagina.

Privacy
Geen account, geen tracking, geen analytics, geen externe code, en er gaat niets naar de ontwikkelaar. Om te syncen geeft de extensie de scrollpositie, het pad van de pagina waar je naartoe navigeert, de positie van je muisaanwijzer, het zoomniveau en (als dat aan staat) het element waar je overheen beweegt of op klikt, wat je typt, een afbeelding van de andere helft voor de overlay en CSS-waarden voor de inspectie door van de ene helft naar de andere, alleen tussen de twee sites waarvoor je de sync startte. Checklists en recente paren blijven op je apparaat. Wachtwoord-, pincode- en betaalvelden worden nooit gelezen of gespiegeld. De overlay vraagt één keer toestemming om tabbladen vast te leggen; al het andere werkt zonder.

Gemaakt door BijBijker – https://bijbijker.nl

## Single purpose (dashboard field)

EN: Compare two versions of a website side by side in a Chrome Split View: keep both tabs in sync (scroll position, navigation, zoom, hover and mouse cursor, and optionally clicks and typing, only between the two sites the user started sync for) and help spot the differences (page checklist, overlay, CSS difference inspector).

NL: Twee versies van een website naast elkaar vergelijken in een Chrome Split View: beide tabbladen gelijk houden (scrollpositie, navigatie, zoom, hover en muiscursor, en optioneel klikken en typen, alleen tussen de twee sites waarvoor de gebruiker de sync startte) en helpen verschillen te vinden (checklist, overlay, CSS-verschillen).

## Permission justifications (dashboard fields)

| Permission | Justification |
|---|---|
| Host permissions `http://*/*`, `https://*/*` | The user can open any website in either pane of a Split View. The content script must run on both pages to read and apply the scroll position and, when enabled, mirror clicks, hover and navigation. It does nothing on tabs that are not part of a Split View pair. `activeTab` is not enough: it only grants access to one tab after a click, not to the second pane, and it is lost on reload or navigation, which would break sync. |
| `scripting` | Injects the bundled `content.js`/`content.css` into Split View tabs that were already open before the extension was installed, updated or restarted, so the user does not have to reload them. Only files packaged with the extension are injected. |
| `storage` | Saves the user's settings (`chrome.storage.local`) and the per-pair sync state such as offset and ruler lines (`chrome.storage.session`, cleared when the browser closes). |
| Optional host permission `<all_urls>` | Requested at runtime, only when the user turns on the Overlay ("Allow capturing the panes"). `chrome.tabs.captureVisibleTab` refuses to run with only `http://*/*`/`https://*/*` ("Either the '<all_urls>' or 'activeTab' permission is required"); `activeTab` is not enough because the overlay captures the *other* pane of the Split View, not the one the user clicked in, and keeps refreshing the image after scrolling. The image is only drawn over the other pane of the same pair and never stored or sent anywhere. Content scripts still only match http/https. Without this permission everything except the overlay works. |
| Remote code | None. All JavaScript is in the package; no `eval`, no `new Function`, no remote scripts. |
| APIs without extra permission | `chrome.tabs.setZoom`/`onZoomChange` (sync zoom), `chrome.tabs.createSplit` (reopen a remembered pair as a Split View, Chrome 155+), `chrome.windows.update` (width presets), `chrome.permissions` (the optional permission above). |

Removed in 1.1.0 for least privilege: `tabs` (host permissions already give access to the URL of http/https tabs) and `web_accessible_resources` (the on-page button icon is now drawn inline, so no extension file is exposed to websites).

## Data usage disclosures (privacy tab)

- Does the extension collect user data? **No** — nothing is sent to the developer or any server. Tick none of the data categories. (Decision point before submitting: the path/query of navigations and hover/click targets are handed from one user-chosen site to the other as the core function. If a reviewer treats that as "transfer", tick *Web history* and *User activity* and keep the certifications below; the privacy policy already describes it.)
- Certify: does not sell or transfer user data to third parties; does not use or transfer data for purposes unrelated to the single purpose; does not use or transfer data to determine creditworthiness or for lending.
- With "Sync typing" (off by default) the text a user types is passed from one of their two chosen sites to the other. It never reaches the developer; if a reviewer considers this a transfer, tick *Personally identifiable information*/*User activity* accordingly. Checklists (paths and notes) and the recent-pairs list (site + path) are stored only in `chrome.storage.local`.
- Note for reviewers: to perform the sync, the scroll position, the path/query/hash of a navigation, the mouse pointer position (for the virtual cursor, coordinates only) and (if enabled) a description of the hovered or clicked element are passed from one pane to the other. This only happens between the two origins the user pinned by pressing Start sync; if a pane opens another site, the pair pauses. Click mirroring is off by default and never activates submit buttons, POST forms or delete/pay/confirm/log-out actions. Nothing is sent to the developer and nothing is stored beyond the browser session.

## Assets

All images are 24-bit PNG without alpha, in `store/images/`.

| Asset | English | Dutch |
|---|---|---|
| Store icon 128×128 (96 px artwork + padding) | `icons/icon128.png` | same |
| **Upload 1** – scroll sync (new popup with tabs) | `en-screenshot-1-sync.png` | `nl-screenshot-1-sync.png` |
| **Upload 2** – page checklist | `en-screenshot-5-checklist.png` | `nl-screenshot-5-checklist.png` |
| **Upload 3** – overlay, difference mode | `en-screenshot-6-overlay.png` | `nl-screenshot-6-overlay.png` |
| **Upload 4** – CSS difference inspector | `en-screenshot-7-css-inspector.png` | `nl-screenshot-7-css-inspector.png` |
| **Upload 5** – clicks, hover and mouse cursor | `en-screenshot-2-clicks-hover.png` | `nl-screenshot-2-clicks-hover.png` |
| Not uploaded (store max 5) – on-page controls (older panel) | `en-screenshot-3-on-page-controls.png` | `nl-screenshot-3-on-page-controls.png` |
| Not uploaded (store max 5) – setup | `en-screenshot-4-setup.png` | `nl-screenshot-4-setup.png` |
| Small promo tile 440×280 | `en-promo-tile-440x280.png` | `nl-promo-tile-440x280.png` |
| Marquee 1400×560 | `en-marquee-1400x560.png` | `nl-marquee-1400x560.png` |

The popup and on-page panel in the screenshots are captures of the real extension UI; in screenshots 5–7 the panes are real captures of a fictional test site (overlay in difference mode, inspector panel), shown under `example.com` addresses. Upload them in the order above (the store allows 5 per language).

## Publishing checklist

- [ ] Run `./package.sh` and upload `dist/splitscreen-browser-sync-1.1.0.zip`
- [ ] Store listing: paste the EN detailed description; add Dutch under "Add localized listing" and paste the NL text
- [ ] Upload the 5 EN screenshots marked *Upload 1–5*, promo tile and marquee; the same 5 NL screenshots to the Dutch listing
- [ ] Category: Developer Tools; language: English
- [ ] Privacy tab: single purpose text, the permission justifications (including the optional `<all_urls>`), "no remote code", data usage: nothing collected, tick the three certifications
- [ ] Privacy policy URL: publish `store/PRIVACY.md` and paste the public link
- [ ] Homepage and support URL: https://bijbijker.nl
- [ ] Distribution: public, all regions
- [ ] Test the zip once via "Load unpacked" (unzipped) in Chrome 140+ with a real Split View before submitting
- [ ] Submit for review
