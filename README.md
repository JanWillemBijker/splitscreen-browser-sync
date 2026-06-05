# SplitScreen Browser Sync

Version: 1.0.0

Manifest V3 Chrome Extension for pixel-perfect scroll sync between two tabs in Chrome native Split View.

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
- Optionally mirrors navigation between live/staging domains while preserving each side's origin.
- Optionally mirrors interactive clicks between panes, including closing overlays by clicking outside them.
- Optionally mirrors hover effects (CSS `:hover` styling and JS-driven hover menus) between panes.

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
splitview-scroll-sync/
├── manifest.json
├── background.js
├── content.js
├── content.css
├── popup.html
├── popup.css
├── popup.js
├── README.md
└── icons/
```

## Installation

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `splitview-scroll-sync` folder.
5. Open two normal HTTP/HTTPS pages.
6. Put the two tabs in Chrome native Split View.
7. Click the floating button in the lower-left corner.
8. Click **Start sync**.

## Toolbar popup

Click the extension icon in Chrome's toolbar to open a small settings popup.

### Always show button on split screen

Default: enabled.

When enabled, the floating in-page button appears automatically when the current tab is part of a valid Chrome Split View pair.

When disabled, the floating button will not automatically appear in every Split View.

### Show button on current split screen

This button is enabled only when the current active tab is part of a valid Chrome Split View pair.

When clicked, the floating button is shown for the current Split View group for the current browser session.

### Defaults for new sessions

The popup also exposes the starting values for the per-group options, so a new
split screen pairing begins with your preferred configuration:

- Hide WordPress admin bar
- Sync navigation
- Mirror clicks
- Mirror hover effects

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

## Navigation sync

Default: off.

When **Sync navigation** is enabled for a Split View group, navigating one side mirrors the same path, query string, and hash to the other side while preserving the other side's origin.

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

## Mirror clicks

Default: off. Toggle: **Mirror clicks** (per Split View group).

When enabled, every primary (left) mouse click on one pane is reproduced on the
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

Default: off. Toggle: **Mirror hover effects** (per Split View group).

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

## v1.3.0 UI refinements

- Uses `Roboto Flex`, `Roboto`, `Arial`, `sans-serif` across the extension UI without loading external fonts.
- Removes duplicate Offset labeling in the floating popup.
- Removes the top status cards from the floating popup.
- Keeps `Start sync` as a green outline button until sync is active, then fills it green.
- Keeps `Apply` as a green outline button.
- Adds dynamic toolbar popup text for showing or hiding the button on the current split screen.
- Adds version and author metadata to the toolbar popup footer.

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
- [ ] The toolbar button switches between `Show button on current split screen` and `Hide button on current split screen`.
- [ ] Manual hide overrides automatic display for the current Split View group during the current session.
- [ ] The popup contains no Split View ID or technical pair information.
- [ ] The popup's "Defaults for new sessions" toggles persist after closing/reopening the popup.
- [ ] Changing a default and then opening a new Split View pair starts that pair with the chosen value.
- [ ] The reload section shows left buttons on the left and right buttons on the right.
- [ ] Reload left/right and Hard reload left/right appear in a 2x2 grid (no Reload active / Hard reload active buttons).
- [ ] The Offset number input accepts custom positive and negative pixel values.
- [ ] `Apply` and `Reset` are next to each other.
- [ ] The popup does not show top status cards such as `Sync off`, `Offset: 0px`, `Navigation sync: on`, or `Click sync: on`.
- [ ] Roboto Flex is used in the floating UI and toolbar popup, with safe fallbacks.
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

- [ ] Keep **Sync navigation** off by default.
- [ ] Open live/staging pages with different origins and the same path.
- [ ] Enable **Sync navigation**.
- [ ] Navigate on the left side.
- [ ] The right side opens the same path, search, and hash on its own origin.
- [ ] Navigate on the right side.
- [ ] The left side opens the same path, search, and hash on its own origin.
- [ ] No infinite navigation loop occurs.

### Mirror clicks

- [ ] Keep **Mirror clicks** off by default.
- [ ] Enable **Mirror clicks**.
- [ ] Click a normal button, menu button, search button, or accordion button on one side.
- [ ] The other side clicks the matching element.
- [ ] Open a modal/overlay, then click outside it (on the backdrop); the other side closes its overlay too.
- [ ] A toggle (open/close) button changes state once on the other side, not twice.
- [ ] Clicks inside the extension UI are not mirrored.
- [ ] No infinite click loop occurs.

### Mirror hover effects

- [ ] Keep **Mirror hover effects** off by default.
- [ ] Enable **Mirror hover effects**.
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
