# SplitScreen Browser Sync

Version: 1.1.0 · Made by [BijBijker](https://bijbijker.nl)

Manifest V3 Chrome Extension for pixel-perfect scroll sync between two tabs in Chrome native Split View. Requires Chrome 140 or newer. Available in English, Dutch, German, French, Spanish, Italian, Brazilian Portuguese and Polish.

## Install

From the Chrome Web Store (once published), or locally:

1. Download or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the repository folder.
4. Right-click a tab and choose **Add tab to new split view**, then pick a second http/https page.
5. Click the extension icon and press **Start sync** (or use the floating button on the page, or `Alt+Shift+S`).

## Privacy

Nothing is sent to the developer or any server: no analytics and no remote code; settings, checklists, the pair history and per-pair state stay in `chrome.storage.local` / `chrome.storage.session`. Between the two panes of a pair the extension does pass data from one site to the other: the scroll position (and a description of the top element in "on element" alignment), scroll positions of scroll areas, the zoom level, the path/query/hash of a navigation, the mouse position and (when enabled) a description of the clicked or hovered element, what you type (Sync typing, **off** by default), an image of the other pane (Overlay, only when you turn it on) and CSS values of the inspected element (Inspect differences, only while on). That only happens between the two sites (origins) the pair was started on. The toolbar badge and the sync suggestion are worked out locally from the two tab URLs; only pairs you chose not to be suggested again are stored (`chrome.storage.local`). Password, one-time-code, PIN and payment card fields are never read and never mirrored. Full policy: [store/PRIVACY.md](store/PRIVACY.md).

## Packaging for the Chrome Web Store

```sh
./package.sh
```

Runs `node --check` on all scripts, validates the JSON files and writes `dist/splitscreen-browser-sync-<version>.zip` containing only the runtime files. Store texts, permission justifications and the publishing checklist are in [store/LISTING.md](store/LISTING.md); screenshots and promo images in `store/images/`.

## Credits

Made by BijBijker – https://bijbijker.nl

## What it does

- Detects existing Chrome native Split Views through `tab.splitViewId`.
- Treats every valid Split View group as its own isolated pair.
- A valid group has exactly two HTTP/HTTPS tabs with the same `splitViewId`.
- Synchronizes `scrollX` and `scrollY` in pixels.
- Pixel-exact by default (no percentages); the optional *On element/content* alignment falls back to the scroll percentage only when no matching element is found.
- Syncs bidirectionally.
- Keeps multiple Split View pairs separated, including larger test sets such as 10 pairs.
- Keeps sync active after normal reloads and hard reloads.
- Reloads one pane without reloading the other pane.
- Can temporarily hide the WordPress admin bar while sync is active.
- Pins the two origins when sync starts (origin pinning) and pauses the pair when either pane opens a different site.
- Mirrors navigation between the two pinned origins (live/staging) while preserving each side's origin (default on).
- Optionally mirrors interactive clicks between panes, including closing overlays by clicking outside them (default off; never submits forms or triggers delete/pay/log-out style actions).
- Mirrors hover effects (CSS `:hover` styling and JS-driven hover menus) between panes (default on).
- Shows a virtual mouse cursor in the other pane where your mouse is, with a short ripple when you click (default on; display only, never clicks anything).
- Alignment: pixel-exact (default) or on element/content.
- Hold Alt (Option) to scroll one side on its own; the difference becomes the offset.
- Syncs scrolling inside scroll areas (modals, side panels) and the zoom level (default on).
- Optionally mirrors typing and form choices (default **off**).
- Page checklist for live vs staging, with export.
- Remembers pairs and reopens them as a Split View with one click.
- Overlay mode: one side on top of the other with opacity, difference blend and a swipe divider.
- Inspect CSS differences of the element under the cursor.
- Shows the size of each pane and resizes the window to width presets.

## New in 1.1.0 (third round)

### Status on the toolbar icon

Each pane of a pair gets its own badge on the extension icon (`chrome.action` per `tabId`, no extra permission):

| Badge | Meaning |
|---|---|
| green dot | synced |
| grey dot | synced, a pane is reloading |
| orange `II` | paused because a pane opened another site (press Start sync again) |
| red `!` | other pane not responding |
| none | not in a Split View pair, or sync is off |

The tooltip says the same per tab, for example *Synced with staging.example.com* (the host of the other pane). The badge follows every state change of the pair and is cleared when the pair dissolves. Chrome resets tab-specific badges when a tab navigates, so the extension sets it again after every load.

### Sync suggestion

When a pair is **not** syncing and both panes look like two versions of one site, the extension offers to start sync. It never starts by itself.

How it decides (only from the two tab URLs, locally):

1. Both panes are http/https on **different origins** (an origin is scheme + host + port).
2. And either the **same path** (trailing slash ignored, query and `#` ignored; a bare `/` does not count, otherwise any two home pages would match),
3. or the **hosts look related**: equal after removing leading environment labels (`www`, `staging`, `stage`, `test`, `dev`, `acc`, `uat`, `qa`, `preview`, `preprod`, `beta`, `demo`, `live`, `prod`, …), the same site name before the public suffix (`site.nl` ~ `site.test` ~ `staging.site.co.uk`; hosting suffixes such as `netlify.app`, `vercel.app`, `github.io`, `pages.dev`, `wpengine.com`, `ddev.site` count as suffix), or an environment part in the first label (`site-staging.netlify.app` ~ `site.nl`). IP addresses only match on the path.
4. Not shown after you stopped sync for those two sites (this session), for a pair you dismissed, while the pair is paused for another site, or when **Settings → Suggest sync** is off.

Where it shows:

- On the page, next to the floating button (in the same closed shadow root): *Start sync? site.nl ↔ staging.site.nl* with **Start**, **×** (not now: this pair of tabs and sites, this session) and **Don't suggest for this pair again**. **Start** is the normal start command from a trusted click (user-gesture flag), exactly like the panel's Start sync. Hidden while the panel is open; only shown where the floating button is shown.
- In the popup, in the status card: *Suggestion: site.nl ↔ staging.site.nl* above **Start sync**, with **Don't suggest for this pair again**.
- **Settings → Suggestions**: *Suggest sync* (default on) and *Suggest dismissed pairs again*.

"Don't suggest again" stores the two origins (sorted, so the order of the panes does not matter) in `chrome.storage.local`, at most 200 pairs (oldest dropped). Nothing leaves the browser.

### More languages

German, French, Spanish, Italian, Brazilian Portuguese and Polish UI (`_locales/de`, `fr`, `es`, `it`, `pt_BR`, `pl`); English stays the default. `node scripts/check-locales.mjs` (not packaged; also run by `package.sh`) checks that every locale has exactly the keys of `en`, the same placeholders, a store short description of at most 132 characters and a 6-column CSV header; `--lengths` lists strings much longer than English.

## New in 1.1.0 (second round)

Version stays 1.1.0 (not yet published). The popup now has four tabs: **Sync · Checklist · Compare · Settings**; the status and Start/Stop button stay on top and the popup never grows past Chrome's 600 px limit (the tab content scrolls).

### Page checklist (Checklist tab)

- Paste many paths or URLs (one per line; for a URL only the path, query and `#` part are kept; other schemes are refused) or **Add current page**.
- **Previous / Next** (and clicking a page in **All pages**) opens that path in both panes, each on its own pinned origin. Start sync once first so both sites are known; nothing navigates outside the two pinned origins. Both panes get a navigation lock, so navigation sync does not mirror the loads again.
- Per page **Good / Wrong / N/A** and a note; progress (`3 of 12 checked · 1 wrong`); remove a page; **Clear list** (click twice).
- **Export CSV** (UTF-8 with BOM, columns `#, Path, Result, Note, Left URL, Right URL`; cells starting with `= + - @` are prefixed with `'` so spreadsheets do not run them) and **Copy as text**.
- Stored per pair of sites (order does not matter) in `chrome.storage.local`; max 500 pages per list, 50 lists.
- The on-page panel shows a compact Checklist section (position, path, Previous/Next, result buttons) when the pair has a list.

### Overlay (Compare tab)

Lays an image of the other pane over this pane: opacity slider, **Difference blend** (identical pixels turn black) and a **Swipe divider** (drag the handle on the page, or use the arrow keys).

How it works and what we found while building it (Chrome 157, real Split View):

- `chrome.tabs.captureVisibleTab` captures only the **active** pane of the window (one pane's viewport, not the whole split). The extension therefore activates the other pane for a moment, captures it and re-activates the pane you were in (about 30 ms; keyboard focus returns). Its own UI in the captured pane (button, cursor, rulers) is hidden during the capture.
- `captureVisibleTab` does **not** accept the `http://*/*` / `https://*/*` host permissions: it needs `<all_urls>` or `activeTab` ("Either the '<all_urls>' or 'activeTab' permission is required"). `activeTab` only covers the pane you clicked in, so `<all_urls>` is an **optional** host permission, requested the first time you press **Allow capturing the panes**. Nothing changes at install time.
- Chrome allows at most 2 captures per second, so the image is refreshed 450 ms after scrolling, a scroll-area scroll, zoom, resize or a page load settles (throttled to one per 600 ms). In between, the image follows your scrolling.
- The iframe alternative (load the other site in an iframe and strip `X-Frame-Options` / CSP `frame-ancestors` with `declarativeNetRequest`) was not needed; it would have cost an extra permission and a heavier store review.
- The image only goes to the other pane of the same pair while both panes are on their pinned origins, is drawn in a closed shadow root with `pointer-events: none` (the page stays usable) and is never stored. Overlay turns off when sync stops or pauses.

### Inspect CSS differences (Compare tab, on-page panel, shortcut)

Turn on **Inspect differences** and point at an element: it is outlined, the matching element on the other side gets a dashed outline, and a small panel lists the checked properties that differ (font family/size/weight/style, line height, letter spacing, text align/transform/decoration, colour, background colour, margin, padding, border width/radius, display, position, box sizing, opacity, box shadow, gap, flex direction, justify/align, z-index) and both box sizes. Click freezes the selection (the click does not reach the page while inspecting), **Esc** stops. Only style values and box sizes of the two elements are exchanged, only while the mode is on.

### Pane sizes and width presets (Compare tab)

Shows width × height of both panes (also next to the Left/Right reload columns in the on-page panel). Presets **375 / 768 / 1024 / 1280 / 1440** for the chosen pane. Chrome has no API to move the Split View divider (`chrome.tabs` gained `createSplit`/`unsplit` in Chrome 155, nothing sets the ratio), so the window is resized with `chrome.windows.update` until the pane has that width; the other pane changes along. A maximized/fullscreen window is made normal first; if the screen is too narrow the popup says how wide the pane got.

### History of pairs (Sync tab)

Every pair you start sync for is remembered (origin and path of both panes; query string and `#` part are dropped): recent pairs (20) and pinned favourites (30), rename, remove, **Clear history** (keeps favourites) and an option **Remember pairs** in Settings. Click a pair to reopen it:

- Active tab already in a Split View → both URLs are loaded into that pair.
- Otherwise two tabs open next to each other and become a native Split View with `chrome.tabs.createSplit` (Chrome 155+; no extra permission).
- Chrome 140–154 has no API to create a Split View: the two tabs open next to each other with a short instruction to turn them into one.
- Sync starts (and pins the new origins) as soon as both pages have loaded.

### Hold Alt (Option) = decouple

While Alt (Option on macOS) is held, scrolling one pane is not mirrored. Release Alt and the new distance between the panes becomes the pair's scroll offset (toast: *Offset +120 px*). Alt is read from trusted key, wheel and pointer events (so it also works in the pane under the mouse that has no keyboard focus); nothing is blocked, so Alt shortcuts keep working.

### Alignment: pixel-exact or on element/content

Per pair and as a default. **On element/content** finds the top-most visible landmark element (id, heading, section, image, paragraph, ...) in the scrolling pane, matches it on the other side with the same descriptor matching as clicks/hover and puts it at the same spot (plus the offset). No match: falls back to the scroll percentage. Useful when a banner or extra content makes one page taller.

### Sync scroll areas and zoom

- **Sync scroll areas** (default on): scrolling inside an overflow area, modal or side panel scrolls the matching scrollable element on the other side (descriptor + class hint, closest to the same spot).
- **Sync zoom** (default on): zooming one pane (Ctrl/⌘ + / −) gives the other pane the same zoom factor via `chrome.tabs.setZoom` (no extra permission); the factor we set is remembered so the change does not bounce back. Note that Chrome's zoom is per site by default, so other tabs of that site follow too.

### Sync typing (default off)

Mirrors what you type into inputs, textareas and contenteditable areas, and checkbox, radio and select changes, into the matching field on the other side. Never password, one-time-code, payment card (`autocomplete="cc-*"`), hidden, file or button inputs, nor fields whose name/label looks sensitive; only trusted events; values are set directly with `input`/`change` events, so nothing is clicked, no key is pressed and forms are never submitted. **The other site receives what you type**, which is why it is off by default.

## Changes in 1.1.0

### Virtual mouse cursor

- New option **Show mouse cursor** (*Muiscursor tonen*), per pair and as a default for new pairs, **on by default**, in the popup and the on-page panel.
- While the pair is syncing on its pinned origins, the pane with the real mouse sends its pointer position (numbers only: viewport point and size; trusted events only; rAF-throttled to at most ~30 messages per second). The other pane draws a classic arrow pointer with a small label naming the side the mouse is on, mapped exactly like hover mirroring (same viewport point, X scaled to the pane width; scroll is synced so it points at the same content).
- Smooth movement (CSS transform with a short transition), hides after 1.5 s without movement, when the mouse leaves the source pane/window, when the real mouse enters the receiving pane, and when sync pauses or stops. A real click in the source pane shows a short ripple on the other side (visual only, also when click mirroring is off).
- The cursor lives in its own fresh host with a closed shadow root, `pointer-events: none` and maximum z-index; the page can see that the host exists but cannot read or move what is inside, and it holds no page data. The service worker only relays positions from a pane on its pinned origin and the receiving pane checks its own origin.

### Fixed: Start sync sometimes needed a second press

- Root cause: every window scan replaced each pair's state object. Start sync looked the pair up, awaited a few tab calls and then set `enabled = true`; when another event re-scanned the window in between (the other pane becoming active because you clicked into it, a content script reporting READY, the popup asking for status), the change landed on a detached copy and was lost, while the panes still received a "synced" state. Also, concurrent first loads of the session state after the service worker woke up could hand out two different state objects.
- Fix: pairs are updated in place, the session state and settings are loaded once and shared, Start first makes sure both panes have a live content script (injecting into tabs opened before install/update), then pins the origins, enables, saves and broadcasts. Every UI state carries a revision so a page ignores a state that arrives after a newer one. A content script that was orphaned by an extension update no longer blocks the freshly injected one.

### Fixed: status stuck on "Reloading" (orange) after opening another page

- Root cause: Chrome reports a navigation as `status: loading` together with the new URL. The handler first did the slow navigation work (window refresh, mirroring, content-script checks) and only then marked the pane as reloading, while the `complete` event of the same tab, handled in parallel, had usually already cleared it. The mark then stayed forever.
- Fix: tab events (and READY messages) are processed in order per tab and the pane is marked reloading before any slow work. READY from the page's content script also clears the mark (covers bfcache restores), every mark is re-checked against the real tab status after 1.2/3.5/8 s and dropped after 20 s at the latest, and popup/page status requests re-check marks too (survives a service-worker restart). Popup and on-page panel both return to *Synced* with a green dot.

### Redesigned interface

- New toolbar popup: the status of the current Split View pair (synced, paused, reloading, not responding, not in a Split View, unsupported page) is visible at a glance, with one primary **Start sync / Stop sync** button.
- The popup can now change the options of the current pair directly (sync navigation, mirror clicks, mirror hover, hide WordPress admin bar), add a ruler and show/hide the on-page button.
- Defaults for new Split Views and the on-page button setting are grouped in collapsible sections with helper text.
- Empty state with step-by-step instructions when the tab is not in a Split View.
- Redesigned on-page panel and floating button, light and dark mode (`prefers-color-scheme`), WCAG AA contrast, visible keyboard focus, Escape closes the panel, focus is kept when the panel re-renders.
- System fonts only; no remote fonts.
- New icon set: two panes linked by a sync arrow (128 px icon with 96 px artwork and padding, as the store requires).
- English and Dutch UI via `_locales` (default English).
- Footer credit "Made by BijBijker" in the popup.

### Security and store compliance

- **Origin pinning.** Start sync records the origin of both panes. Navigation, clicks, focus and hover are only mirrored while both panes are still on those origins; the service worker re-checks the real tab URLs before relaying, and the receiving pane checks its own origin again. When a pane opens another site (or a non-http page) the pair is paused with the status *Paused: a different site was opened* in the popup and the on-page panel, until Start sync is pressed again (which pins the new origins). Navigation is never mirrored to or from an origin outside the pinned pair.
- **Click mirroring is off by default** and never replays a click on a submit button, on anything inside a `method="post"` form (text fields only get focus), or on an element whose label/link reads like delete/remove/pay/confirm/buy/order/log out (also in Dutch). The other pane then shows *Click not mirrored (form/action)*.
- **Page cannot drive the extension UI.** The on-page panel and the ruler lines each live in a freshly created host with a **closed** shadow root (any pre-existing `#svss-root`/ruler node is removed, never reused). Every UI handler ignores untrusted (`isTrusted === false`) events and checks that the host is still ours and visibly rendered; panel commands that start sync, change mirroring, reload or swap carry a user-gesture flag and are rejected by the service worker without it.
- Scroll, navigation, click and hover messages are only sent by a page while its pair is syncing.
- The sensitive-field check also covers `contenteditable="plaintext-only"` and fields named or labelled like PIN, SSN/BSN, 2FA/MFA/OTP/TOTP, verification or (auth) code.
- Removed the `tabs` permission (host permissions already cover http/https tab URLs) and `web_accessible_resources` (the floating button icon is now drawn inline).
- The service worker validates every message sender: page-facing messages only from the extension's own top-frame content script on an http/https page, settings messages only from the extension's own pages. The content script only accepts messages from the extension's service worker.
- Ruler IDs, positions and thickness are validated; payloads are type-checked.
- Click/hover descriptors never include form field values. Password, one-time-code and payment card fields are excluded from click and focus mirroring.

### Synchronized ruler lines

- Added horizontal ruler lines that stay in sync between both panes, similar to the Grid Ruler extension.
- Add a ruler from the toolbar popup (**+ Add ruler**) or from the **+ Ruler** button next to **Swap left/right** in the on-page panel.
- Drag a ruler up or down; both sides update live.
- Click a ruler to select it — it turns turquoise and the same highlight appears on the peer side.
- A settings bar appears when a ruler is selected: adjust the line thickness (1–20 px) or delete it.
- Press **Backspace** or **Delete** to remove the selected ruler without opening the settings bar.
- Rulers are stored per Split View group for the current session and survive pane reloads.

### Panel improvements

- The **Offset** section title now shows the current offset value inline (e.g. `Current: +20px`) so the number input takes the full width.
- **+ Ruler** button added next to **Swap left/right** in the on-page panel.

### Improved click matching

- Click descriptors now include a short text fingerprint of the clicked element's content.
- When resolving a click on the peer pane, the fingerprint is used as a tie-breaker between coordinate-based and text-based matches, reducing mis-hits on pages with repeating components such as navigation items or cards.

## Changes in 0.4

- New app icon: a green-to-cyan gradient rounded square with a white sync motif (replaces the old dark panels icon; all PNG sizes regenerated from the SVG).
- The on-page floating button now matches the icon: a gradient rounded-square tile with the sync glyph and a soft shadow, so it visually connects with the toolbar icon.
- Shifted the extension's green accent toward `#3CDE95` (mint). Solid "synced" buttons use the brighter mint with dark text for contrast; outline/focus/toggle accents follow the same hue.
- Updated remaining in-app labels to the new name (SplitScreen Browser Sync).

## Changes in 0.3

- Renamed the extension to **SplitScreen Browser Sync**.
- The toolbar popup can now set the per-group **defaults for new sessions**: Hide WordPress admin bar, Sync navigation, Mirror clicks, and Mirror hover effects. These apply to each newly created split screen pairing; the current split is still changed from its on-page panel.
- Removed the **Reload active** and **Hard reload active** buttons from the on-page panel (the per-side Reload left/right and Hard reload left/right buttons remain).

## Changes in 0.2

- Reworked click mirroring so it is far more reliable across themes and page builders:
  - Mirrors every left click, not only a fixed list of selectors.
  - Closing an overlay by clicking outside the popup is now mirrored.
  - Resolves the target by strong selector, then by viewport coordinates, then by weak hints.
  - Replays a realistic pointer/mouse sequence and a single native activation, so `mousedown`-driven widgets work and toggles never double-fire.
  - Renamed the toggle from `Mirror button clicks` to `Mirror clicks`.
- Added **Mirror hover effects** (per group, default off): reproduces CSS `:hover` styling and JS-driven hover menus on the other pane.
- Loop prevention is now structural via `event.isTrusted`, so synthetic mirrored events can never bounce back.

## Changes in 0.1

- Cleaner floating popup UI.
- Removed visible technical details such as Split View ID and pair/debug information.
- Reload buttons now use a clear left/right two-column layout.
- Offset controls now use a custom pixel number input with `Apply` and `Reset` next to each other.
- Removed `+10` and `-10` offset buttons from the UI.
- Added per-group options:
  - `Hide WordPress admin bar`
  - `Sync navigation`
  - `Mirror button clicks`
- Added a toolbar popup for the extension icon.
- Added the global setting `Always show button on split screen`.
- Added `Show button on current split screen` for manually showing the in-page button when automatic display is disabled.
- Improved WordPress admin bar hiding with a dedicated style element and a MutationObserver.
- Kept direct pixel-based scroll sync without smooth animation.

## Files

```text
splitview-browser-sync/
├── manifest.json
├── background.js
├── content.js
├── content.css
├── popup.html
├── popup.css
├── popup.js
├── _locales/        UI strings: en (default), nl, de, fr, es, it, pt_BR, pl
├── icons/
├── package.sh       builds dist/splitscreen-browser-sync-<version>.zip
├── scripts/         check-locales.mjs (development check, not packaged)
├── store/           listing texts (LISTING.md, listings/<lang>.md), privacy policy, store images (not packaged)
└── README.md
```

## Toolbar popup

Click the extension icon in Chrome's toolbar to open the popup. The status of the current pair and the **Start sync / Stop sync** button are always on top; below are four tabs:

- **Sync**: options for the current pair (**This Split View**), Add ruler, show/hide the on-page button, and **Recent pairs**.
- **Checklist**: the page checklist for this pair of sites.
- **Compare**: pane sizes and width presets, **Inspect differences**, **Overlay**.
- **Settings**: defaults for new Split Views, **Remember pairs**, on-page button.

### Always show button on split screen (On-page button → Show in every Split View)

Default: enabled.

When enabled, the floating in-page button appears automatically when the current tab is part of a valid Chrome Split View pair.

When disabled, the floating button will not automatically appear in every Split View.

### Show button on current split screen

This button is enabled only when the current active tab is part of a valid Chrome Split View pair.

When clicked, the floating button is shown for the current Split View group for the current browser session.

### Defaults for new sessions

The popup also exposes the starting values for the per-group options, so a new
split screen pairing begins with your preferred configuration:

- Hide WordPress admin bar (default on)
- Sync navigation (default on)
- Mirror clicks (default off)
- Mirror hover effects (default on)
- Show mouse cursor (default on)
- Alignment (default pixel-exact)
- Sync scroll areas (default on)
- Sync zoom (default on)
- Sync typing (default off)

These defaults are applied when a split screen pairing is first detected. They
do not retroactively change a pairing that already exists in the current
session — change that one from its on-page panel. Defaults are stored in
`chrome.storage.local`.

## Floating UI

The floating UI appears only when:

- the current tab is a normal HTTP/HTTPS page;
- the current tab is in Chrome native Split View;
- exactly two tabs exist in that Split View group;
- `Always show button on split screen` is enabled, or the current Split View group was manually enabled through the toolbar popup.

The floating UI does not appear on normal pages outside Split View.

## Scroll sync

Scroll sync is pixel-based and direct (in the default *Pixel-exact* alignment):

- no smooth scroll;
- no delayed easing;
- no percentage mode (only *On element/content* alignment falls back to a percentage when no element matches);
- exact `scrollLeft` and `scrollTop` values are used;
- site CSS such as `html { scroll-behavior: smooth; }` is temporarily overridden during remote scroll.

## Offset

Offset is stored per Split View group.

- The offset number input accepts values such as `-50`, `0`, `32`, and `120`.
- Click **Apply** to set the offset for the current Split View pair.
- Click **Reset** to return the offset to `0px`.

The offset is applied relative to left/right direction. Left to right adds the offset; right to left subtracts it.

## WordPress admin bar hiding

The option **Hide WordPress admin bar** is enabled by default per Split View group.

When sync is active and the option is enabled, the content script injects a temporary style element with this ID:

```text
splitview-scroll-sync-wp-adminbar-hide
```

It hides `#wpadminbar`, removes the top offset from `html.wp-toolbar`, and removes top margin/padding from `body.admin-bar`.

A MutationObserver reapplies the fix if WordPress or admin scripts modify the DOM after page load.

When sync stops or the option is disabled, the style element is removed again and inline top offset changes are restored.

## Origin pinning

When you press **Start sync** (popup, on-page panel or shortcut) the extension
records the origin (scheme + host + port) of both panes, for example
`https://live.nl` and `https://staging.live.nl`. Navigation, clicks, focus and
hover are only mirrored while both panes are still on those two origins.

If either pane navigates to a different site (or to a non-http page), the pair
is paused and the popup and on-page panel show **Paused: a different site was
opened**. Press **Start sync** again to sync the two sites that are now open;
that pins the new origins.

## Navigation sync

Default: on for new pairs (change it under **Defaults for new Split Views** in the popup).

When **Sync navigation** is enabled for a Split View group, navigating one side mirrors the same path, query string, and hash to the other side while preserving the other side's pinned origin. URLs are only ever built on the pinned origin of the other pane; navigation to or from any other origin pauses the pair instead of being mirrored.

Example:

```text
Left:  https://live.nl/about/
Right: https://staging.live.nl/about/
```

If the left side navigates to:

```text
https://live.nl/contact/?x=1#form
```

The right side opens:

```text
https://staging.live.nl/contact/?x=1#form
```

The same works from right to left.

Navigation sync only mirrors normal HTTP/HTTPS URLs. It does not mirror `chrome://`, `chrome-extension://`, `about:`, `file://`, or Chrome Web Store pages.

Note that the path and query string (including any tokens in it) of one pinned site are opened on the other pinned site. Only start sync for two sites you trust with each other's URLs.

## Mirror clicks

Default: **off** for new pairs. Toggle: **Mirror clicks** (per Split View group).

Click mirroring replays your clicks on the other site, which can trigger actions
there. It is therefore opt-in, only works between the two pinned origins, and
never replays a click on:

- a submit button (`<button>` in a form, `input[type=submit|image]`);
- any control inside a `method="post"` form (text fields only receive focus);
- an element whose visible label, `aria-label`, `title` or link reads like
  delete, remove, pay, confirm, buy, order, checkout or log out (also
  verwijder, betaal, bevestig, koop, bestel, afrekenen, uitloggen, afmelden).

In those cases the other pane shows a short *Click not mirrored (form/action)*
message.

When enabled, every other primary (left) mouse click on one pane is reproduced on the
other pane. This intentionally includes clicks on non-button elements such as
modal backdrops, so closing an overlay by clicking outside the popup is mirrored
as well.

How a click is reproduced on the other pane:

1. **Strong selector match first.** If the clicked element has a strong,
   unique identifier (an `id`, a unique `data-*` attribute, an exact link
   path, or a unique `aria-label` / `name`), the same element is located by
   that selector. This is robust even when the two panes have different widths.
2. **Coordinate fallback.** Otherwise the element under the same viewport
   position is used (`elementFromPoint`). The horizontal position is scaled by
   the width ratio of the two panes (a no-op for an equal 50/50 split), and the
   vertical position is used as-is because scroll is already synced. This is
   what makes overlays, backdrops and custom widgets work.
3. **Weak fallback.** Visible text or a structural CSS path is used only as a
   last resort, and only when it does not contradict the coordinate result.

On the matched element a realistic event sequence is replayed
(`pointerover` → `pointerdown` → `mousedown` → `pointerup` → `mouseup`) so
widgets that listen for `mousedown`/`pointerdown` (menus, dropdowns) respond,
followed by exactly one real activation via the element's native `click()` so
default actions (links, form submit, checkbox toggles) work and the `click`
event never fires twice.

Loops are prevented structurally: mirrored interactions are dispatched
synthetically and are therefore never `isTrusted`, so they are ignored by the
local click listener and cannot bounce back.

This is best-effort. If no matching element is found, the extension fails
silently. Clicks inside the extension's own floating UI are never mirrored.

## Mirror hover effects

Default: on for new pairs. Toggle: **Mirror hover effects** (per Split View group). Like clicks, hover is only mirrored between the two pinned origins.

When enabled, hovering an element on one pane reproduces the hover state on the
matching element on the other pane, so hover styling can be checked visually
without moving the mouse to both sides.

Two things are mirrored:

- **CSS `:hover` styling.** Because the CSS `:hover` pseudo-class cannot be
  triggered from script, the extension reads the page's own stylesheets and
  duplicates every `:hover` rule into an equivalent rule that matches a private
  class `svss-force-hover` instead. That class is then applied to the mirrored
  element and all of its ancestors (matching how `:hover` cascades up the
  ancestor chain), reproducing colour, underline, transform and submenu-reveal
  hover styles. The duplicated rules use the same specificity as the originals,
  including rules nested inside `@media` / `@supports` blocks.
- **JS-driven hover.** Synthetic `pointerover` / `mouseover` / `mouseenter` /
  `mousemove` events (and matching `out` / `leave` events when the pointer
  moves away) are dispatched so dropdown menus and tooltips that open on hover
  also open on the mirrored side.

Limitations:

- Hover styling defined in a **cross-origin** stylesheet cannot be read by the
  browser (a standard security restriction) and is skipped. CSS served from the
  same origin as the page — the common case for a staging/live pair — is fully
  supported.
- The mirrored class is added/removed live; on pages with extremely large
  stylesheets there may be a brief style recalculation when hover starts.

Hover updates are sent only when the hovered element changes (throttled to the
animation frame), and the same `isTrusted` rule used for clicks prevents hover
loops.

## Show mouse cursor

Default: on for new pairs. Toggle: **Show mouse cursor** (per Split View group, popup and on-page panel). While the pair is syncing on its pinned origins, a pointer arrow in the other pane follows your mouse and shows a ripple when you click. It is drawn in a closed shadow root with `pointer-events: none`, so it never interacts with the page. Only the viewport position is passed between the panes; it is not stored.

## Keyboard shortcuts

| Command | Default shortcut | Action |
|---|---:|---|
| `sync-current-split-view` | `Alt+Shift+S` | Start sync for the current Split View |
| `sync-all-split-views` | `Alt+Shift+A` | Start sync for all valid Split Views in the current window |
| `stop-current-split-view` | `Alt+Shift+X` | Stop sync for the current Split View |
| `hard-reload-active-pane` | `Alt+Shift+R` | Hard reload the active pane |
| `toggle-inspect` | none (Chrome allows 4 suggested keys) | Inspect CSS differences on or off |

You can change shortcuts at:

```text
chrome://extensions/shortcuts
```

## Test checklist

### Outside Split View

- [ ] Open a normal HTTP/HTTPS page without Split View.
- [ ] No floating button is visible.
- [ ] No empty popup or placeholder is visible.

### One Split View pair

- [ ] Create a Chrome native Split View with exactly two normal HTTP/HTTPS tabs.
- [ ] The floating button appears when automatic display is enabled.
- [ ] The toolbar popup can hide automatic display.
- [ ] The toolbar popup button switches between `Show on-page button` and `Hide on-page button`.
- [ ] The popup shows `Synced` / `Paused` for the current pair and **Start sync / Stop sync** works from the popup.
- [ ] Popup options under `This Split View` change the current pair immediately (check the on-page panel).
- [ ] Outside a Split View the popup shows `Not in a Split View` with the three setup steps.
- [ ] On `chrome://` pages inside a Split View the popup shows `This page can't be synced`.
- [ ] With Chrome set to Dutch, the popup and panel are in Dutch (same for German, French, Spanish, Italian, Portuguese (Brazil), Polish).
- [ ] Toolbar icon: green dot on both panes after Start sync, tooltip "Synced with <other host>"; orange `II` after one pane opens another site; no badge after Stop sync or after leaving the Split View.
- [ ] Open `site.nl/about/` next to `staging.site.nl/about/` without syncing: the on-page card and the popup suggest sync; Start starts it; × hides it; "Don't suggest for this pair again" survives a browser restart; Settings → Suggest dismissed pairs again brings it back.
- [ ] Clicking a password field on one side does not focus or click the field on the other side.
- [ ] Manual hide overrides automatic display for the current Split View group during the current session.
- [ ] The popup contains no Split View ID or technical pair information.
- [ ] The popup's "Defaults for new sessions" toggles persist after closing/reopening the popup.
- [ ] Changing a default and then opening a new Split View pair starts that pair with the chosen value.
- [ ] The reload section shows left buttons on the left and right buttons on the right.
- [ ] Reload left/right and Hard reload left/right appear in a 2x2 grid (no Reload active / Hard reload active buttons).
- [ ] The Offset number input accepts custom positive and negative pixel values.
- [ ] `Apply` and `Reset` are next to each other.
- [ ] The popup does not show top status cards such as `Sync off`, `Offset: 0px`, `Navigation sync: on`, or `Click sync: on`.
- [ ] The system font is used in the floating UI and toolbar popup; no remote fonts are loaded.
- [ ] Click **Start sync**.
- [ ] Scrolling left moves right immediately.
- [ ] Scrolling right moves left immediately.
- [ ] There is no smooth or trailing scroll effect.
- [ ] Reloading one pane keeps sync active.
- [ ] Hard reloading one pane keeps sync active.
- [ ] WordPress admin bar hiding works if the bar is present at load.
- [ ] WordPress admin bar hiding works if the bar appears after load.
- [ ] Disabling the WordPress admin bar option removes the injected style.

### Navigation sync

- [ ] **Sync navigation** is on by default for a new pair.
- [ ] Navigate one pane to a different site: the pair pauses, the popup and panel show *Paused: a different site was opened*, nothing is mirrored to the other pane.
- [ ] Press **Start sync** again: the new origins are pinned and sync resumes.
- [ ] Open live/staging pages with different origins and the same path.
- [ ] Enable **Sync navigation**.
- [ ] Navigate on the left side.
- [ ] The right side opens the same path, search, and hash on its own origin.
- [ ] Navigate on the right side.
- [ ] The left side opens the same path, search, and hash on its own origin.
- [ ] No infinite navigation loop occurs.

### Mirror clicks

- [ ] **Mirror clicks** is off by default for a new pair; enable it.
- [ ] Clicking a submit button, a control in a POST form, or a *Delete*/*Log out* link on one side is not replayed; the other side shows *Click not mirrored (form/action)*.
- [ ] Click a normal button, menu button, search button, or accordion button on one side.
- [ ] The other side clicks the matching element.
- [ ] Open a modal/overlay, then click outside it (on the backdrop); the other side closes its overlay too.
- [ ] A toggle (open/close) button changes state once on the other side, not twice.
- [ ] Clicks inside the extension UI are not mirrored.
- [ ] No infinite click loop occurs.

### Mirror hover effects

- [ ] **Mirror hover effects** is on by default for a new pair.
- [ ] Hover a link or button with a CSS hover style on one side; the same element shows the hover style on the other side.
- [ ] Hover a menu that opens a submenu on hover; the submenu opens on the other side.
- [ ] Move the mouse away; the hover style and submenu clear on the other side.
- [ ] No infinite hover loop occurs.

### Show mouse cursor

- [ ] **Show mouse cursor** is on by default for a new pair (popup and panel).
- [ ] Moving the mouse in one pane shows a smooth arrow cursor at the same content in the other pane, labelled with the side the mouse is on.
- [ ] The cursor hides after about 1.5 s without movement, when the mouse leaves the pane or window, and when sync stops or pauses.
- [ ] A click shows a short ripple on the other side, also with Mirror clicks off.
- [ ] Turning the option off removes the cursor immediately.

### Second round (checklist, overlay, inspector, ...)

- [ ] Popup: four tabs, arrow keys switch tabs, height never above 600 px (synced state, Checklist with a long list), NL and EN, light and dark.
- [ ] Hold Alt/Option and scroll one pane: the other stays; release: toast *Offset ... px*, popup shows the offset, both panes scroll together again. Alt+arrow/Alt shortcuts of the browser still work.
- [ ] Alignment *On element/content*: open live vs a staging page with an extra banner; headings stay aligned while scrolling; with no match it follows the percentage.
- [ ] Scroll a side panel/modal list on one side: the same list scrolls on the other side. Zoom one side with Ctrl/⌘ +: the other follows, no flicker loop.
- [ ] Sync typing (turn on): text, textarea, contenteditable, checkbox, radio, select follow; password, card number, one-time code and file fields do not; nothing is submitted.
- [ ] Checklist: paste paths and URLs, Previous/Next opens both panes on their own site and sync stays on; statuses, note, progress, CSV opens in Excel/Numbers with correct columns, Copy as text.
- [ ] Recent pairs: Start sync adds the pair; rename, pin, remove; reopen inside the current Split View and from a normal tab (new Split View, sync starts).
- [ ] Overlay: *Allow capturing the panes* shows Chrome's permission prompt; overlay over left/right, opacity, difference, swipe (drag + arrow keys); image refreshes after scrolling; no visible flicker when the other pane is captured; turning sync off removes it.
- [ ] Inspect differences: outlines on both sides, panel lists differing CSS, click freezes, Esc stops, links are not followed while inspecting.
- [ ] Pane sizes shown; presets resize the window so the chosen pane has that width (or report the screen is too narrow).

### Multiple Split View pairs

- [ ] Create 10 Chrome native Split View pairs.
- [ ] Click **Sync all**.
- [ ] Scrolling in pair 1 affects only pair 1.
- [ ] Scrolling in pair 2 affects only pair 2.
- [ ] Each pair can keep its own offset.
- [ ] Reloading one pane affects only that pane.
