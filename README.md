# SplitScreen Browser Sync

Version: 1.1.0 · Made by [BijBijker](https://bijbijker.nl)

Manifest V3 Chrome Extension for pixel-perfect scroll sync between two tabs in Chrome native Split View. Requires Chrome 140 or newer. Available in English and Dutch.

## Install

From the Chrome Web Store (once published), or locally:

1. Download or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the repository folder.
4. Right-click a tab and choose **Add tab to new split view**, then pick a second http/https page.
5. Click the extension icon and press **Start sync** (or use the floating button on the page, or `Alt+Shift+S`).

## Privacy

Nothing is sent to the developer or any server: no analytics and no remote code; settings and per-pair state stay in `chrome.storage.local` / `chrome.storage.session`. Between the two panes of a pair the extension does pass data from one site to the other: the scroll position, the path/query/hash of a navigation and (when enabled) a description of the clicked or hovered element. That only happens between the two sites (origins) the pair was started on. Password, one-time-code, PIN and payment card fields are never read and clicks/focus on them are never mirrored. Full policy: [store/PRIVACY.md](store/PRIVACY.md).

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
- Uses no percentage-based scroll mode.
- Syncs bidirectionally.
- Keeps multiple Split View pairs separated, including larger test sets such as 10 pairs.
- Keeps sync active after normal reloads and hard reloads.
- Reloads one pane without reloading the other pane.
- Can temporarily hide the WordPress admin bar while sync is active.
- Pins the two origins when sync starts (origin pinning) and pauses the pair when either pane opens a different site.
- Mirrors navigation between the two pinned origins (live/staging) while preserving each side's origin (default on).
- Optionally mirrors interactive clicks between panes, including closing overlays by clicking outside them (default off; never submits forms or triggers delete/pay/log-out style actions).
- Mirrors hover effects (CSS `:hover` styling and JS-driven hover menus) between panes (default on).

## Changes in 1.1.0

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
├── _locales/        en + nl UI strings
├── icons/
├── package.sh       builds dist/splitscreen-browser-sync-<version>.zip
├── store/           listing texts, privacy policy, store images (not packaged)
└── README.md
```

## Toolbar popup

Click the extension icon in Chrome's toolbar to open a small settings popup.

The popup shows the status of the current pair, a **Start sync / Stop sync** button, the options for the current pair (**This Split View**), and two collapsible sections described below.

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

Scroll sync is pixel-based and direct:

- no smooth scroll;
- no delayed easing;
- no percentage mode;
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

## Keyboard shortcuts

| Command | Default shortcut | Action |
|---|---:|---|
| `sync-current-split-view` | `Alt+Shift+S` | Start sync for the current Split View |
| `sync-all-split-views` | `Alt+Shift+A` | Start sync for all valid Split Views in the current window |
| `stop-current-split-view` | `Alt+Shift+X` | Stop sync for the current Split View |
| `hard-reload-active-pane` | `Alt+Shift+R` | Hard reload the active pane |

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
- [ ] With Chrome set to Dutch, the popup and panel are in Dutch.
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

### Multiple Split View pairs

- [ ] Create 10 Chrome native Split View pairs.
- [ ] Click **Sync all**.
- [ ] Scrolling in pair 1 affects only pair 1.
- [ ] Scrolling in pair 2 affects only pair 2.
- [ ] Each pair can keep its own offset.
- [ ] Reloading one pane affects only that pane.
