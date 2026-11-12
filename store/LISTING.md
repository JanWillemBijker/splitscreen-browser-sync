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
• Pixel-exact scroll sync in both directions, without smoothing or lag
• Every Split View pair stays separate, even with ten pairs open
• Keeps syncing after a normal or hard reload of either side
• Sync navigation (on by default): follow a link on one side and the other side opens the same path on its own domain (live ↔ staging)
• Origin pinning: everything is mirrored only between the two sites you pressed Start sync for; if a pane opens another site, sync pauses until you start it again
• Mirror hover effects (on by default): see CSS hover styles and hover menus on both sides
• Mirror clicks (off by default): open menus, accordions and modals on both sides at once. Submit buttons, forms that post data and delete/pay/confirm/log-out actions are never clicked on the other side
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
No account, no tracking, no analytics, no remote code, and nothing is sent to the developer. To sync, the extension passes the scroll position, the path of the page you navigate to and (if enabled) the element you hover or click from one pane to the other, only between the two sites you started sync for. Password, PIN and payment fields are never read or mirrored.

Made by BijBijker – https://bijbijker.nl

## Detailed description – Nederlands

SplitScreen Browser Sync houdt de twee helften van de Split View in Chrome op precies dezelfde scrollpositie. Zet je live site naast de staging-versie, een ontwerp naast de bouw, of twee versies van een pagina naast elkaar, en scroll maar één keer.

Wat het doet
• Pixel-exacte scroll-sync in beide richtingen, zonder vertraging
• Elk Split View-paar blijft apart, ook met tien paren open
• Blijft syncen na normaal of hard herladen van een kant
• Navigatie synchroniseren (standaard aan): volg een link aan de ene kant en de andere kant opent hetzelfde pad op het eigen domein (live ↔ staging)
• Origin pinning: er wordt alleen gespiegeld tussen de twee sites waarvoor je op Sync starten klikte; opent een helft een andere site, dan pauzeert de sync tot je hem opnieuw start
• Hover-effecten spiegelen (standaard aan): CSS-hoverstijlen en hover-menu's aan beide kanten zien
• Klikken spiegelen (standaard uit): menu's, accordeons en modals aan beide kanten tegelijk openen. Verzendknoppen, formulieren die gegevens versturen en acties als verwijderen, betalen, bevestigen of uitloggen worden aan de andere kant nooit aangeklikt
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
Geen account, geen tracking, geen analytics, geen externe code, en er gaat niets naar de ontwikkelaar. Om te syncen geeft de extensie de scrollpositie, het pad van de pagina waar je naartoe navigeert en (als dat aan staat) het element waar je overheen beweegt of op klikt door van de ene helft naar de andere, alleen tussen de twee sites waarvoor je de sync startte. Wachtwoord-, pincode- en betaalvelden worden nooit gelezen of gespiegeld.

Gemaakt door BijBijker – https://bijbijker.nl

## Single purpose (dashboard field)

EN: Keep the two tabs of a Chrome Split View in sync (scroll position, navigation and hover, and optionally clicks, only between the two sites the user started sync for) so two versions of a website can be compared side by side.

NL: De twee tabbladen van een Chrome Split View gelijk houden (scrollpositie, navigatie en hover, en optioneel klikken, alleen tussen de twee sites waarvoor de gebruiker de sync startte) zodat twee versies van een website naast elkaar vergeleken kunnen worden.

## Permission justifications (dashboard fields)

| Permission | Justification |
|---|---|
| Host permissions `http://*/*`, `https://*/*` | The user can open any website in either pane of a Split View. The content script must run on both pages to read and apply the scroll position and, when enabled, mirror clicks, hover and navigation. It does nothing on tabs that are not part of a Split View pair. `activeTab` is not enough: it only grants access to one tab after a click, not to the second pane, and it is lost on reload or navigation, which would break sync. |
| `scripting` | Injects the bundled `content.js`/`content.css` into Split View tabs that were already open before the extension was installed, updated or restarted, so the user does not have to reload them. Only files packaged with the extension are injected. |
| `storage` | Saves the user's settings (`chrome.storage.local`) and the per-pair sync state such as offset and ruler lines (`chrome.storage.session`, cleared when the browser closes). |
| Remote code | None. All JavaScript is in the package; no `eval`, no `new Function`, no remote scripts. |

Removed in 1.1.0 for least privilege: `tabs` (host permissions already give access to the URL of http/https tabs) and `web_accessible_resources` (the on-page button icon is now drawn inline, so no extension file is exposed to websites).

## Data usage disclosures (privacy tab)

- Does the extension collect user data? **No** — nothing is sent to the developer or any server. Tick none of the data categories. (Decision point before submitting: the path/query of navigations and hover/click targets are handed from one user-chosen site to the other as the core function. If a reviewer treats that as "transfer", tick *Web history* and *User activity* and keep the certifications below; the privacy policy already describes it.)
- Certify: does not sell or transfer user data to third parties; does not use or transfer data for purposes unrelated to the single purpose; does not use or transfer data to determine creditworthiness or for lending.
- Note for reviewers: to perform the sync, the scroll position, the path/query/hash of a navigation and (if enabled) a description of the hovered or clicked element are passed from one pane to the other. This only happens between the two origins the user pinned by pressing Start sync; if a pane opens another site, the pair pauses. Click mirroring is off by default and never activates submit buttons, POST forms or delete/pay/confirm/log-out actions. Nothing is sent to the developer and nothing is stored beyond the browser session.

## Assets

All images are 24-bit PNG without alpha, in `store/images/`.

| Asset | English | Dutch |
|---|---|---|
| Store icon 128×128 (96 px artwork + padding) | `icons/icon128.png` | same |
| Screenshot 1 – scroll sync | `en-screenshot-1-sync.png` | `nl-screenshot-1-sync.png` |
| Screenshot 2 – clicks and hover | `en-screenshot-2-clicks-hover.png` | `nl-screenshot-2-clicks-hover.png` |
| Screenshot 3 – on-page controls | `en-screenshot-3-on-page-controls.png` | `nl-screenshot-3-on-page-controls.png` |
| Screenshot 4 – setup | `en-screenshot-4-setup.png` | `nl-screenshot-4-setup.png` |
| Small promo tile 440×280 | `en-promo-tile-440x280.png` | `nl-promo-tile-440x280.png` |
| Marquee 1400×560 | `en-marquee-1400x560.png` | `nl-marquee-1400x560.png` |

The popup and on-page panel in the screenshots are captures of the real extension UI. The websites shown are fictional (`example.com`).

## Publishing checklist

- [ ] Run `./package.sh` and upload `dist/splitscreen-browser-sync-1.1.0.zip`
- [ ] Store listing: paste the EN detailed description; add Dutch under "Add localized listing" and paste the NL text
- [ ] Upload the EN screenshots, promo tile and marquee; upload the NL set to the Dutch listing
- [ ] Category: Developer Tools; language: English
- [ ] Privacy tab: single purpose text, the three permission justifications, "no remote code", data usage: nothing collected, tick the three certifications
- [ ] Privacy policy URL: publish `store/PRIVACY.md` and paste the public link
- [ ] Homepage and support URL: https://bijbijker.nl
- [ ] Distribution: public, all regions
- [ ] Test the zip once via "Load unpacked" (unzipped) in Chrome 140+ with a real Split View before submitting
- [ ] Submit for review
