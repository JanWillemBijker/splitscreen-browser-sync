'use strict';

(() => {
  // Runs once per page. A previous instance only counts while its extension
  // context is still alive: after an extension update or reload the old
  // script is orphaned and must not block the freshly injected one.
  const previousInstance = window.__SVSS_CONTENT_LOADED__;
  if (previousInstance && typeof previousInstance.isAlive === 'function' && previousInstance.isAlive()) return;
  window.__SVSS_CONTENT_LOADED__ = Object.freeze({ isAlive: () => Boolean(chrome?.runtime?.id) });

  const DEBUG = false;

  const MSG = Object.freeze({
    READY: 'SVSS_READY',
    PING: 'SVSS_PING',
    STATE: 'SVSS_STATE',
    HIDE_FLOATING_UI: 'SVSS_HIDE_FLOATING_UI',
    GET_SPLIT_STATUS: 'SVSS_GET_SPLIT_STATUS',
    SCROLL: 'SVSS_SCROLL',
    REMOTE_SCROLL: 'SVSS_REMOTE_SCROLL',
    GET_SCROLL: 'SVSS_GET_SCROLL',
    COMMAND: 'SVSS_COMMAND',
    NAVIGATED: 'SVSS_NAVIGATED',
    CLICK: 'SVSS_CLICK',
    REMOTE_CLICK: 'SVSS_REMOTE_CLICK',
    HOVER: 'SVSS_HOVER',
    REMOTE_HOVER: 'SVSS_REMOTE_HOVER',
    HOVER_CLEAR: 'SVSS_HOVER_CLEAR',
    REMOTE_HOVER_CLEAR: 'SVSS_REMOTE_HOVER_CLEAR',
    RULER_STATE: 'SVSS_RULER_STATE',
    RULER_MOVE: 'SVSS_RULER_MOVE',
    REMOTE_RULER_MOVE: 'SVSS_REMOTE_RULER_MOVE',
    RULER_DELETE: 'SVSS_RULER_DELETE',
    RULER_UPDATE: 'SVSS_RULER_UPDATE',
    RULER_SELECT: 'SVSS_RULER_SELECT',
    REMOTE_RULER_SELECT: 'SVSS_REMOTE_RULER_SELECT',
    POPUP_RULER_ADD: 'SVSS_POPUP_RULER_ADD',
    TOAST: 'SVSS_TOAST',
    FOCUS: 'SVSS_FOCUS',
    REMOTE_FOCUS: 'SVSS_REMOTE_FOCUS',
    POINTER: 'SVSS_POINTER',
    REMOTE_POINTER: 'SVSS_REMOTE_POINTER',
    ALT_COMMIT: 'SVSS_ALT_COMMIT',
    CONTAINER_SCROLL: 'SVSS_CONTAINER_SCROLL',
    REMOTE_CONTAINER_SCROLL: 'SVSS_REMOTE_CONTAINER_SCROLL'
  });

  const CMD = Object.freeze({
    SYNC_CURRENT: 'SYNC_CURRENT',
    SYNC_ALL: 'SYNC_ALL',
    STOP_CURRENT: 'STOP_CURRENT',
    STOP_ALL: 'STOP_ALL',
    RELOAD_ACTIVE: 'RELOAD_ACTIVE',
    HARD_RELOAD_ACTIVE: 'HARD_RELOAD_ACTIVE',
    RELOAD_LEFT: 'RELOAD_LEFT',
    HARD_RELOAD_LEFT: 'HARD_RELOAD_LEFT',
    RELOAD_RIGHT: 'RELOAD_RIGHT',
    HARD_RELOAD_RIGHT: 'HARD_RELOAD_RIGHT',
    OFFSET_RESET: 'OFFSET_RESET',
    SET_OFFSET: 'SET_OFFSET',
    SWAP_SIDES: 'SWAP_SIDES',
    SET_WP_ADMIN_BAR: 'SET_WP_ADMIN_BAR',
    SET_NAVIGATION_SYNC: 'SET_NAVIGATION_SYNC',
    SET_CLICK_MIRRORING: 'SET_CLICK_MIRRORING',
    SET_HOVER_MIRRORING: 'SET_HOVER_MIRRORING',
    SET_SHOW_CURSOR: 'SET_SHOW_CURSOR',
    SET_ALIGN_MODE: 'SET_ALIGN_MODE',
    SET_CONTAINER_SYNC: 'SET_CONTAINER_SYNC',
    SET_ZOOM_SYNC: 'SET_ZOOM_SYNC'
  });

  const HOST_ID = 'svss-root';
  const RULER_HOST_ID = 'svss-ruler-root';
  const CURSOR_HOST_ID = 'svss-cursor-root';
  const CURSOR_IDLE_HIDE_MS = 1500;
  const POINTER_MIN_INTERVAL_MS = 33; // at most ~30 pointer messages per second
  // Legacy light-DOM ruler nodes (before 1.1.0 hardening); removed if present.
  const LEGACY_RULER_IDS = ['svss-ruler-layer', 'svss-ruler-popup'];
  const WP_STYLE_ID = 'splitview-scroll-sync-wp-adminbar-hide';
  const FORCE_HOVER_STYLE_ID = 'splitview-scroll-sync-force-hover';
  const FORCE_HOVER_CLASS = 'svss-force-hover';
  const PANEL_CLOSE_DELAY_MS = 500;
  const REMOTE_SUPPRESS_MS = 80;
  const REMOTE_CLICK_SUPPRESS_MS = 500;
  const REMOTE_HOVER_SUPPRESS_MS = 120;
  const MAX_FORCE_HOVER_RULES = 20000;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Styles for the floating control panel. Everything lives in a Shadow DOM so
  // page CSS cannot leak in. System fonts only; no remote resources.
  const PANEL_CSS = `
    :host {
      all: initial;
      position: fixed;
      bottom: 18px;
      left: 18px;
      z-index: 2147483647;
      color-scheme: light dark;

      --font: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      --surface: #ffffff;
      --surface-2: #f3f6f4;
      --ink: #15201b;
      --muted: #4f5e57;
      --line: #dde4e0;
      --line-strong: #c4cfc9;
      --accent: #3cde95;
      --accent-hover: #2fcf86;
      --on-accent: #072619;
      --switch-off: #7c8983;
      --switch-on: #12a26b;
      --focus: #0a6e4c;
      --ok-bg: #e5f7ee;
      --ok-ink: #0a6e4c;
      --warn-bg: #fdf1e4;
      --warn-ink: #8a3b00;
      --idle-bg: #edf1ef;
      --idle-ink: #4f5e57;
      --status-color: #7c8983;

      font-family: var(--font);
      color: var(--ink);
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --surface: #18221f;
        --surface-2: #1f2a27;
        --ink: #e6eeea;
        --muted: #a3b3ac;
        --line: #2a3732;
        --line-strong: #3a4943;
        --switch-off: #6e7c76;
        --switch-on: #3cde95;
        --focus: #7ff0be;
        --ok-bg: #15302a;
        --ok-ink: #6eebb4;
        --warn-bg: #33251a;
        --warn-ink: #ffc58f;
        --idle-bg: #1d2825;
        --idle-ink: #a3b3ac;
      }
    }

    *, *::before, *::after {
      box-sizing: border-box;
      font-family: var(--font);
    }

    :focus-visible {
      outline: 2px solid var(--focus);
      outline-offset: 2px;
    }

    .svss-wrap {
      position: fixed;
      bottom: 18px;
      left: 18px;
      width: 44px;
      min-height: 44px;
      pointer-events: none;
    }

    .svss-bubble {
      appearance: none;
      position: relative;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      padding: 0;
      border: 0;
      border-radius: 12px;
      background: linear-gradient(135deg, #3cde95 0%, #2ec4d6 100%);
      box-shadow: 0 1px 2px rgba(7, 38, 25, 0.25), 0 6px 16px rgba(7, 38, 25, 0.18);
      cursor: pointer;
      pointer-events: auto;
      transition: box-shadow 150ms ease;
    }

    .svss-bubble:hover,
    .svss-bubble[aria-expanded="true"] {
      box-shadow: 0 1px 2px rgba(7, 38, 25, 0.3), 0 10px 24px rgba(7, 38, 25, 0.26);
    }

    .svss-mark { width: 36px; height: 36px; display: block; }
    .svss-mark-pane { fill: #ffffff; }
    .svss-mark-link { fill: none; stroke: #0b5a3f; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }

    .svss-status-dot {
      position: absolute;
      right: -3px;
      top: -3px;
      width: 12px;
      height: 12px;
      border: 2px solid #ffffff;
      border-radius: 50%;
      background: var(--status-color);
    }

    .svss-bridge {
      position: absolute;
      left: 0;
      bottom: 44px;
      width: 160px;
      height: 14px;
      display: none;
      pointer-events: auto;
    }

    .svss-bridge.open { display: block; }

    .svss-panel {
      position: absolute;
      bottom: 56px;
      left: 0;
      width: 304px;
      max-width: calc(100vw - 36px);
      max-height: calc(100vh - 92px);
      overflow: auto;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface);
      color: var(--ink);
      font-size: 13px;
      line-height: 1.45;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08), 0 18px 44px rgba(0, 0, 0, 0.18);
      pointer-events: auto;
      display: none;
    }

    .svss-panel.open { display: block; }

    .svss-header {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .svss-title {
      margin: 0;
      font-size: 13px;
      font-weight: 650;
      line-height: 1.3;
    }

    .svss-pill {
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--idle-bg);
      color: var(--idle-ink);
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .svss-panel[data-status="synced"] .svss-pill,
    .svss-panel[data-status="reloading"] .svss-pill { background: var(--ok-bg); color: var(--ok-ink); }
    .svss-panel[data-status="error"] .svss-pill,
    .svss-panel[data-status="origin"] .svss-pill { background: var(--warn-bg); color: var(--warn-ink); }

    .svss-notice {
      margin: 0 0 8px;
      padding: 8px 10px;
      border-radius: 6px;
      background: var(--warn-bg);
      color: var(--warn-ink);
      font-size: 12px;
      line-height: 1.4;
    }

    .svss-close {
      appearance: none;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
    }

    .svss-close:hover { background: var(--surface-2); color: var(--ink); }

    .svss-close svg {
      width: 14px;
      height: 14px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
    }

    .svss-sync {
      display: grid;
      gap: 4px;
    }

    .svss-section {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
    }

    .svss-section-title {
      margin: 0 0 4px;
      font-size: 13px;
      font-weight: 650;
      line-height: 1.3;
    }

    .svss-help {
      margin: 0 0 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }

    .svss-help-after { margin: 8px 0 0; }

    .svss-btn {
      appearance: none;
      min-height: 32px;
      padding: 6px 10px;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: var(--surface);
      color: var(--ink);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.2;
      text-align: center;
      transition: background-color 150ms ease, border-color 150ms ease;
    }

    .svss-btn:hover { border-color: var(--muted); }

    .svss-btn-block { width: 100%; min-height: 36px; }

    .svss-btn-primary {
      border-color: transparent;
      background: var(--accent);
      color: var(--on-accent);
    }

    .svss-btn-primary:hover { background: var(--accent-hover); border-color: transparent; }

    .svss-btn-quiet {
      border-color: transparent;
      background: transparent;
      color: var(--muted);
      font-weight: 500;
    }

    .svss-btn-quiet:hover { background: var(--surface-2); color: var(--ink); border-color: transparent; }

    .svss-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 34px;
      cursor: pointer;
    }

    .svss-switch {
      appearance: none;
      flex: none;
      position: relative;
      width: 34px;
      height: 20px;
      margin: 0;
      border-radius: 999px;
      background: var(--switch-off);
      cursor: pointer;
      transition: background-color 150ms ease;
    }

    .svss-switch::after {
      content: "";
      position: absolute;
      top: 3px;
      left: 3px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
      transition: transform 150ms ease;
    }

    .svss-switch:checked { background: var(--switch-on); }
    .svss-switch:checked::after { transform: translateX(14px); }

.svss-select {
      flex: none;
      max-width: 150px;
      height: 30px;
      padding: 4px 8px;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-size: 12px;
    }

    .svss-offset-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 6px;
    }

    .svss-field {
      position: relative;
      display: block;
    }

    .svss-field input {
      width: 100%;
      height: 32px;
      padding: 6px 30px 6px 10px;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
    }

    .svss-field input:focus-visible { outline-offset: 0; }

    .svss-input-suffix {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--muted);
      font-size: 12px;
      pointer-events: none;
    }

    .svss-reload-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .svss-reload-col {
      display: grid;
      gap: 6px;
    }

    .svss-reload-side {
      color: var(--muted);
      font-size: 12px;
    }

    .svss-footer {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid var(--line);
    }

    @media (prefers-reduced-motion: reduce) {
      * { transition: none !important; }
    }
  `;


  let uiState = {
    show: false,
    enabled: false,
    color: 'gray',
    statusText: 'Current tab is not in a split screen.',
    splitViewId: null,
    groupKey: null,
    offsetY: 0,
    offsetX: 0,
    hideWpAdminBar: true,
    syncNavigation: false,
    mirrorClicks: false,
    mirrorHover: false,
    showCursor: false,
    wpAdminBarHidden: false,
    side: 'unknown',
    reloading: false
  };
  // Revision of the last applied state; older states that arrive late are
  // ignored so they cannot switch sync off again in this page.
  let lastStateRev = 0;

  let host = null;
  let shadow = null;
  let wrap = null;
  let bubble = null;
  let panel = null;
  let bridge = null;
  let panelOpen = false;
  let isPointerOverBubble = false;
  let isPointerOverPanel = false;
  let closeTimer = null;

  let isApplyingRemoteScroll = false;
  let suppressScrollUntil = 0;
  let scrollRafPending = false;
  let lastSentScrollX = null;
  let lastSentScrollY = null;

  let isApplyingRemoteClick = false;
  let remoteClickSuppressUntil = 0;

  let isApplyingRemoteHover = false;
  let remoteHoverSuppressUntil = 0;
  let lastHoverEl = null;
  let pendingHoverEl = null;
  let pendingHoverClientX = 0;
  let pendingHoverClientY = 0;
  let hoverSendRafPending = false;
  let forcedHoverEls = [];
  let lastAppliedHoverEl = null;
  let forceHoverStyleEl = null;
  let forceHoverBuiltSheetCount = -1;
  let hoverActiveSent = false;

  let lastReportedUrl = location.href;
  let navigationRafPending = false;

  let rulers = [];
  let selectedRulerId = null;
  let peerSelectedRulerId = null;
  let rulerHost = null;
  let rulerShadow = null;
  let rulerLayer = null;
  let rulerPopup = null;
  let isDraggingRuler = false;
  let dragRulerId = null;
  let dragStartClientY = 0;
  let dragStartRulerY = 0;
  let rulerDragY = 0;
  let rulerDragRafPending = false;

  // Hosts of later features (overlay, inspector, ...) register here so
  // element lookups never pick our own UI.
  const ourExtraHosts = new Set();

  let wpAdminObserver = null;
  let wpAdminMutationRaf = false;
  let wpInlineSnapshot = null;

  function debug(...args) {
    if (DEBUG) console.log('[SplitScreen Browser Sync content]', ...args);
  }

  function isExtensionContextAvailable() {
    return Boolean(chrome?.runtime?.id);
  }

  async function sendRuntimeMessage(message) {
    if (!isExtensionContextAvailable()) return null;

    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      debug('runtime.sendMessage failed', message?.type, error?.message || error);
      return null;
    }
  }

  function t(key, fallback = '') {
    try {
      return chrome.i18n.getMessage(key) || fallback;
    } catch (_error) {
      return fallback;
    }
  }

  // Status dot colours on the bubble; chosen for 3:1 against the white ring.
  function getStatusColor(colorName) {
    switch (colorName) {
      case 'green': return '#12a26b';
      case 'orange': return '#c26a00';
      case 'red': return '#c92a2a';
      case 'gray':
      default: return '#7c8983';
    }
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function showToast(text) {
    const toast = document.createElement('div');
    toast.setAttribute('role', 'status');
    toast.style.cssText = [
      'all:initial', 'position:fixed', 'bottom:80px', 'left:50%',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'max-width:calc(100vw - 32px)',
      'padding:10px 16px',
      'border-radius:8px',
      'background:#15201b',
      'color:#e6eeea',
      'font:500 13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif',
      'box-shadow:0 2px 6px rgba(0,0,0,0.12),0 12px 32px rgba(0,0,0,0.24)',
      'pointer-events:none',
      'opacity:1',
      'transition:opacity 300ms ease',
    ].join(';');
    toast.textContent = text;
    (document.documentElement || document.body).appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 380);
    }, 2600);
  }

  function clearCloseTimer() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function openPanel() {
    clearCloseTimer();
    panelOpen = true;
    updatePanelOpenState();
  }

  function closePanel() {
    clearCloseTimer();
    if (isPointerOverBubble || isPointerOverPanel) return;
    panelOpen = false;
    updatePanelOpenState();
  }

  function schedulePanelClose() {
    clearCloseTimer();
    closeTimer = setTimeout(closePanel, PANEL_CLOSE_DELAY_MS);
  }

  function updatePanelOpenState() {
    if (!panel) return;
    panel.classList.toggle('open', panelOpen);
    if (bridge) bridge.classList.toggle('open', panelOpen);
    if (bubble) bubble.setAttribute('aria-expanded', panelOpen ? 'true' : 'false');
  }

  function hideFloatingUi() {
    panelOpen = false;
    isPointerOverBubble = false;
    isPointerOverPanel = false;
    clearCloseTimer();

    if (host) host.remove();

    host = null;
    shadow = null;
    wrap = null;
    bubble = null;
    panel = null;
    bridge = null;
  }

  // Every control of the panel and the rulers lives in a closed shadow root,
  // but a page could still try to drive it with synthetic events or hide our
  // host and lure the user into clicking it. Only real user input on a host
  // that is ours, attached where we put it and visibly rendered, counts.
  function isHostGenuine(node) {
    if (!node || !node.isConnected || node.parentNode !== document.documentElement) return false;
    try {
      const style = getComputedStyle(node);
      return style.display !== 'none'
        && style.visibility === 'visible'
        && style.opacity === '1'
        && style.filter === 'none'
        && style.transform === 'none';
    } catch (_error) {
      return false;
    }
  }

  function isTrustedUiEvent(event, uiHost = host) {
    return Boolean(event && event.isTrusted) && isHostGenuine(uiHost);
  }

  // Panel commands are only sent from a trusted event; the service worker
  // rejects the security-relevant ones without `userGesture`.
  function sendUiCommand(event, command, payload = {}) {
    if (!isTrustedUiEvent(event)) return null;
    return sendRuntimeMessage({ ...payload, type: MSG.COMMAND, command, userGesture: true });
  }

  function createButton(label, command, extraClass = '', payloadFactory = null, options = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `svss-btn ${extraClass}`.trim();
    button.textContent = label;
    button.dataset.key = options.key || command;
    if (options.ariaLabel) button.setAttribute('aria-label', options.ariaLabel);
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!event.isTrusted) return;
      const payload = typeof payloadFactory === 'function' ? payloadFactory() : {};
      await sendUiCommand(event, command, payload);
    });
    return button;
  }

  function createSection(titleText, helpText = '') {
    const section = document.createElement('section');
    section.className = 'svss-section';

    const title = document.createElement('h3');
    title.className = 'svss-section-title';
    title.textContent = titleText;
    section.appendChild(title);

    if (helpText) {
      const help = document.createElement('p');
      help.className = 'svss-help';
      help.textContent = helpText;
      section.appendChild(help);
    }

    return section;
  }

  function createToggle(label, checked, command) {
    const toggle = document.createElement('label');
    toggle.className = 'svss-toggle';

    const text = document.createElement('span');
    text.className = 'svss-toggle-text';
    text.textContent = label;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'svss-switch';
    input.checked = Boolean(checked);
    input.dataset.key = command;
    input.addEventListener('change', async (event) => {
      event.stopPropagation();
      if (!isTrustedUiEvent(event)) {
        input.checked = !input.checked; // undo; the state did not change
        return;
      }
      await sendUiCommand(event, command, { value: input.checked });
    });

    toggle.appendChild(text);
    toggle.appendChild(input);
    return toggle;
  }

  // A labelled native <select>; changes are sent as a panel command.
  function createSelect(label, value, choices, command) {
    const row = document.createElement('label');
    row.className = 'svss-toggle';
    const text = document.createElement('span');
    text.className = 'svss-toggle-text';
    text.textContent = label;
    const select = document.createElement('select');
    select.className = 'svss-select';
    select.dataset.key = command;
    for (const [optionValue, optionLabel] of choices) {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionLabel;
      select.appendChild(option);
    }
    select.value = value;
    select.addEventListener('keydown', (event) => event.stopPropagation());
    select.addEventListener('change', async (event) => {
      event.stopPropagation();
      if (!isTrustedUiEvent(event)) {
        select.value = value;
        return;
      }
      await sendUiCommand(event, command, { value: select.value });
    });
    row.appendChild(text);
    row.appendChild(select);
    return row;
  }

  // Maps the background state to one of: synced, paused, reloading, error.
  function getPanelStatus() {
    if (uiState.color === 'red') return 'error';
    if (!uiState.enabled && uiState.pauseReason === 'origin-changed') return 'origin';
    if (uiState.enabled && uiState.reloading) return 'reloading';
    return uiState.enabled ? 'synced' : 'paused';
  }

  const PILL_KEYS = {
    synced: 'pillSynced',
    paused: 'pillPaused',
    origin: 'pillOriginPaused',
    reloading: 'pillReloading',
    error: 'pillError'
  };

  function renderPanelContents() {
    if (!panel) return;

    // Re-rendering replaces every control; keep keyboard focus where it was.
    const focusedKey = shadow?.activeElement?.dataset?.key || null;
    panel.textContent = '';

    const status = getPanelStatus();
    panel.dataset.status = status;

    const header = document.createElement('div');
    header.className = 'svss-header';

    const title = document.createElement('h2');
    title.className = 'svss-title';
    title.id = 'svss-title';
    title.textContent = t('panelTitle', 'SplitScreen Sync');

    const pill = document.createElement('span');
    pill.className = 'svss-pill';
    pill.setAttribute('role', 'status');
    pill.textContent = t(PILL_KEYS[status], status);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'svss-close';
    close.dataset.key = 'close';
    close.setAttribute('aria-label', t('panelClose', 'Close'));
    close.appendChild(createIcon('M4 4l8 8M12 4l-8 8'));
    close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!event.isTrusted) return;
      closePanelAndFocusBubble();
    });

    header.appendChild(title);
    header.appendChild(pill);
    header.appendChild(close);
    panel.appendChild(header);

    if (status === 'origin') {
      const notice = document.createElement('p');
      notice.className = 'svss-notice';
      notice.textContent = t('statusOriginPausedBody', 'One pane left the site you started sync for. Press Start sync to sync these two sites.');
      panel.appendChild(notice);
    }

    const syncRow = document.createElement('div');
    syncRow.className = 'svss-sync';
    const syncButton = uiState.enabled
      ? createButton(t('btnStopSync', 'Stop sync'), CMD.STOP_CURRENT, 'svss-btn-block', null, { key: 'sync-toggle' })
      : createButton(t('btnStartSync', 'Start sync'), CMD.SYNC_CURRENT, 'svss-btn-primary svss-btn-block', null, { key: 'sync-toggle' });
    syncButton.setAttribute('aria-pressed', uiState.enabled ? 'true' : 'false');
    syncRow.appendChild(syncButton);
    syncRow.appendChild(createButton(t('btnSyncAll', 'Sync all Split Views'), CMD.SYNC_ALL, 'svss-btn-quiet'));
    panel.appendChild(syncRow);

    const optionsSection = createSection(t('sectionOptions', 'Options'));
    optionsSection.appendChild(createSelect(t('optAlign', 'Alignment'), uiState.alignMode === 'element' ? 'element' : 'pixel', [
      ['pixel', t('alignPixel', 'Pixel-exact')],
      ['element', t('alignElement', 'On element/content')]
    ], CMD.SET_ALIGN_MODE));
    optionsSection.appendChild(createToggle(t('optNavigation', 'Sync navigation'), uiState.syncNavigation, CMD.SET_NAVIGATION_SYNC));
    optionsSection.appendChild(createToggle(t('optClicks', 'Mirror clicks'), uiState.mirrorClicks, CMD.SET_CLICK_MIRRORING));
    optionsSection.appendChild(createToggle(t('optHover', 'Mirror hover effects'), uiState.mirrorHover, CMD.SET_HOVER_MIRRORING));
    optionsSection.appendChild(createToggle(t('optCursor', 'Show mouse cursor'), uiState.showCursor, CMD.SET_SHOW_CURSOR));
    optionsSection.appendChild(createToggle(t('optContainers', 'Sync scroll areas'), uiState.syncContainers, CMD.SET_CONTAINER_SYNC));
    optionsSection.appendChild(createToggle(t('optZoom', 'Sync zoom'), uiState.syncZoom, CMD.SET_ZOOM_SYNC));
    optionsSection.appendChild(createToggle(t('optWpAdminBar', 'Hide WordPress admin bar'), uiState.hideWpAdminBar, CMD.SET_WP_ADMIN_BAR));
    panel.appendChild(optionsSection);

    const offsetSection = createSection(t('sectionOffset', 'Scroll offset'), t('offsetHelp', ''));
    const offsetRow = document.createElement('div');
    offsetRow.className = 'svss-offset-row';

    const fieldWrap = document.createElement('label');
    fieldWrap.className = 'svss-field';

    const yInput = document.createElement('input');
    yInput.type = 'number';
    yInput.step = '1';
    yInput.placeholder = '0';
    yInput.value = String(Number(uiState.offsetY || 0));
    yInput.inputMode = 'numeric';
    yInput.dataset.key = 'offset-input';
    yInput.setAttribute('aria-label', t('offsetInputLabel', 'Scroll offset in pixels'));
    yInput.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        sendUiCommand(event, CMD.SET_OFFSET, { offsetY: parseInt(yInput.value || '0', 10) || 0 });
      }
    });

    const suffix = document.createElement('span');
    suffix.className = 'svss-input-suffix';
    suffix.setAttribute('aria-hidden', 'true');
    suffix.textContent = 'px';

    fieldWrap.appendChild(yInput);
    fieldWrap.appendChild(suffix);
    offsetRow.appendChild(fieldWrap);
    offsetRow.appendChild(createButton(t('btnApply', 'Apply'), CMD.SET_OFFSET, '', () => ({
      offsetY: parseInt(yInput.value || '0', 10) || 0
    })));
    offsetRow.appendChild(createButton(t('btnReset', 'Reset'), CMD.OFFSET_RESET, 'svss-btn-quiet'));
    offsetSection.appendChild(offsetRow);
    const altHint = document.createElement('p');
    altHint.className = 'svss-help svss-help-after';
    altHint.textContent = t('altHint', '');
    offsetSection.appendChild(altHint);
    panel.appendChild(offsetSection);

    const reloadSection = createSection(t('sectionReload', 'Reload'));
    const reloadGrid = document.createElement('div');
    reloadGrid.className = 'svss-reload-grid';
    for (const side of ['left', 'right']) {
      const column = document.createElement('div');
      column.className = 'svss-reload-col';
      column.setAttribute('role', 'group');
      const heading = document.createElement('span');
      heading.className = 'svss-reload-side';
      heading.textContent = t(side === 'left' ? 'colLeft' : 'colRight', side);
      column.appendChild(heading);
      const isLeft = side === 'left';
      column.appendChild(createButton(t('btnReload', 'Reload'), isLeft ? CMD.RELOAD_LEFT : CMD.RELOAD_RIGHT, '', null, {
        ariaLabel: t(isLeft ? 'reloadLeftLabel' : 'reloadRightLabel', '')
      }));
      column.appendChild(createButton(t('btnHardReload', 'Hard reload'), isLeft ? CMD.HARD_RELOAD_LEFT : CMD.HARD_RELOAD_RIGHT, '', null, {
        ariaLabel: t(isLeft ? 'hardReloadLeftLabel' : 'hardReloadRightLabel', '')
      }));
      reloadGrid.appendChild(column);
    }
    reloadSection.appendChild(reloadGrid);
    panel.appendChild(reloadSection);

    const footer = document.createElement('div');
    footer.className = 'svss-footer';
    footer.appendChild(createButton(t('btnSwap', 'Swap sides'), CMD.SWAP_SIDES, 'svss-btn-quiet'));

    const addRulerPanelBtn = document.createElement('button');
    addRulerPanelBtn.type = 'button';
    addRulerPanelBtn.className = 'svss-btn svss-btn-quiet';
    addRulerPanelBtn.dataset.key = 'add-ruler';
    addRulerPanelBtn.textContent = t('btnRuler', 'Add ruler');
    addRulerPanelBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isTrustedUiEvent(event)) return;
      await sendRuntimeMessage({ type: MSG.POPUP_RULER_ADD, userGesture: true });
    });
    footer.appendChild(addRulerPanelBtn);
    panel.appendChild(footer);

    if (focusedKey) {
      const target = Array.from(panel.querySelectorAll('[data-key]')).find((el) => el.dataset.key === focusedKey);
      if (target) target.focus({ preventScroll: true });
    }
  }

  function createIcon(pathData, viewBox = '0 0 16 16') {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);
    return svg;
  }

  // The bubble mirrors the toolbar icon (two panes joined by a link), built
  // with DOM APIs so no extension resource has to be web accessible.
  function createBrandMark() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 40 40');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('class', 'svss-mark');
    const shapes = [
      ['rect', { x: 7.5, y: 9, width: 11, height: 22, rx: 2.5, class: 'svss-mark-pane' }],
      ['rect', { x: 21.5, y: 9, width: 11, height: 22, rx: 2.5, class: 'svss-mark-pane' }],
      ['path', { d: 'M11.5 20h17M15 16.5 11.5 20l3.5 3.5M25 16.5l3.5 3.5-3.5 3.5', class: 'svss-mark-link' }]
    ];
    for (const [tag, attrs] of shapes) {
      const el = document.createElementNS(SVG_NS, tag);
      for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
      svg.appendChild(el);
    }
    return svg;
  }

  function closePanelAndFocusBubble() {
    panelOpen = false;
    isPointerOverPanel = false;
    updatePanelOpenState();
    if (bubble) bubble.focus({ preventScroll: true });
  }

  // Removes every element with one of our ids that we did not create (a page
  // could pre-create them to own the shadow root or mimic our UI).
  function removeForeignNodes(ids, keep) {
    for (const id of ids) {
      for (const node of Array.from(document.querySelectorAll(`[id="${id}"]`))) {
        if (node !== keep) node.remove();
      }
    }
  }

  // Inline !important beats page stylesheets, so the host cannot be made
  // invisible with CSS to trick the user into clicking it.
  function hardenHostStyle(node) {
    const declarations = {
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      filter: 'none',
      transform: 'none',
      'clip-path': 'none',
      mask: 'none',
      position: 'fixed',
      'z-index': '2147483647'
    };
    for (const [property, value] of Object.entries(declarations)) node.style.setProperty(property, value, 'important');
  }

  function ensureUi() {
    if (host && shadow && host.isConnected && host.parentNode === document.documentElement) {
      removeForeignNodes([HOST_ID], host);
      return;
    }

    // Never reuse an existing node: always a fresh host with a closed shadow
    // root whose reference only lives in this closure.
    if (host) hideFloatingUi();
    removeForeignNodes([HOST_ID], null);
    if (!document.documentElement) return;

    host = document.createElement('div');
    host.id = HOST_ID;
    hardenHostStyle(host);
    document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = PANEL_CSS;

    wrap = document.createElement('div');
    wrap.className = 'svss-wrap';

    bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.className = 'svss-bubble';
    bubble.setAttribute('aria-label', t('bubbleLabel', 'Open SplitScreen Browser Sync controls'));
    bubble.setAttribute('aria-haspopup', 'dialog');
    bubble.setAttribute('aria-expanded', 'false');
    bubble.setAttribute('aria-controls', 'svss-panel');
    bubble.appendChild(createBrandMark());

    const dot = document.createElement('span');
    dot.className = 'svss-status-dot';
    bubble.appendChild(dot);

    bridge = document.createElement('div');
    bridge.className = 'svss-bridge';

    panel = document.createElement('div');
    panel.className = 'svss-panel';
    panel.id = 'svss-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'svss-title');

    bubble.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isTrustedUiEvent(event)) return;
      clearCloseTimer();
      panelOpen = !panelOpen;
      updatePanelOpenState();
      // Opened from the keyboard: move focus into the panel.
      if (panelOpen && event.detail === 0) {
        const first = panel.querySelector('button, input');
        if (first) first.focus({ preventScroll: true });
      }
    });

    wrap.addEventListener('keydown', (event) => {
      if (!event.isTrusted) return;
      if (event.key === 'Escape' && panelOpen) {
        event.preventDefault();
        event.stopPropagation();
        closePanelAndFocusBubble();
      }
    });

    bubble.addEventListener('pointerenter', (event) => {
      if (!isTrustedUiEvent(event)) return;
      isPointerOverBubble = true;
      openPanel();
    });

    bubble.addEventListener('pointerleave', (event) => {
      if (!event.isTrusted) return;
      isPointerOverBubble = false;
      schedulePanelClose();
    });

    for (const area of [panel, bridge]) {
      area.addEventListener('pointerenter', (event) => {
        if (!isTrustedUiEvent(event)) return;
        isPointerOverPanel = true;
        openPanel();
      });
      area.addEventListener('pointerleave', (event) => {
        if (!event.isTrusted) return;
        isPointerOverPanel = false;
        schedulePanelClose();
      });
    }

    wrap.appendChild(bubble);
    wrap.appendChild(bridge);
    wrap.appendChild(panel);
    shadow.appendChild(style);
    shadow.appendChild(wrap);
  }

  function updateUi() {
    reconcileHoverFeatureState();
    reconcileCursorFeatureState();

    if (!uiState.show) {
      hideFloatingUi();
      setWpAdminBarHidden(Boolean(uiState.wpAdminBarHidden));
      return;
    }

    ensureUi();
    if (!host) return;
    hardenHostStyle(host);
    host.style.setProperty('--status-color', getStatusColor(uiState.color));
    bubble.title = `${t('extName', 'SplitScreen Browser Sync')}: ${t(PILL_KEYS[getPanelStatus()], '')}`;
    renderPanelContents();
    updatePanelOpenState();
    setWpAdminBarHidden(Boolean(uiState.wpAdminBarHidden));
  }

  function getStyleValueSnapshot(element, properties) {
    const snapshot = {};
    if (!element?.style) return snapshot;
    for (const property of properties) {
      snapshot[property] = {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property)
      };
    }
    return snapshot;
  }

  function restoreStyleSnapshot(element, snapshot) {
    if (!element?.style || !snapshot) return;
    for (const [property, data] of Object.entries(snapshot)) {
      if (data.value) element.style.setProperty(property, data.value, data.priority || '');
      else element.style.removeProperty(property);
    }
  }

  function ensureWpInlineSnapshot() {
    if (wpInlineSnapshot) return;
    wpInlineSnapshot = {
      html: getStyleValueSnapshot(document.documentElement, ['padding-top', 'margin-top']),
      body: getStyleValueSnapshot(document.body, ['padding-top', 'margin-top'])
    };
  }


  function setStylePropertyIfNeeded(element, property, value, priority = '') {
    if (!element?.style) return;
    if (element.style.getPropertyValue(property) === value && element.style.getPropertyPriority(property) === priority) return;
    element.style.setProperty(property, value, priority);
  }

  function applyWpAdminBarFix() {
    if (!uiState.wpAdminBarHidden) return;
    ensureWpInlineSnapshot();

    let style = document.getElementById(WP_STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = WP_STYLE_ID;
      style.textContent = `
        #wpadminbar {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
        }

        html.wp-toolbar {
          padding-top: 0 !important;
          margin-top: 0 !important;
        }

        body.admin-bar {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }

        @media screen and (max-width: 782px) {
          html.wp-toolbar {
            padding-top: 0 !important;
          }
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    const html = document.documentElement;
    const body = document.body;
    if (html?.style) {
      setStylePropertyIfNeeded(html, 'padding-top', '0', 'important');
      setStylePropertyIfNeeded(html, 'margin-top', '0', 'important');
    }
    if (body?.style) {
      setStylePropertyIfNeeded(body, 'padding-top', '0', 'important');
      setStylePropertyIfNeeded(body, 'margin-top', '0', 'important');
    }
  }

  function setupWpAdminObserver() {
    if (wpAdminObserver || !document.documentElement) return;

    wpAdminObserver = new MutationObserver(() => {
      if (wpAdminMutationRaf) return;
      wpAdminMutationRaf = true;
      requestAnimationFrame(() => {
        wpAdminMutationRaf = false;
        applyWpAdminBarFix();
      });
    });

    wpAdminObserver.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }

  function teardownWpAdminObserver() {
    if (wpAdminObserver) {
      wpAdminObserver.disconnect();
      wpAdminObserver = null;
    }
    wpAdminMutationRaf = false;
  }

  function setWpAdminBarHidden(shouldHide) {
    if (!shouldHide) {
      teardownWpAdminObserver();
      const style = document.getElementById(WP_STYLE_ID);
      if (style) style.remove();
      if (wpInlineSnapshot) {
        restoreStyleSnapshot(document.documentElement, wpInlineSnapshot.html);
        restoreStyleSnapshot(document.body, wpInlineSnapshot.body);
      }
      wpInlineSnapshot = null;
      return;
    }

    applyWpAdminBarFix();
    setupWpAdminObserver();
  }

  function readScrollPosition() {
    const scroller = document.scrollingElement || document.documentElement;
    return {
      scrollX: Number(scroller?.scrollLeft ?? window.scrollX ?? window.pageXOffset ?? 0),
      scrollY: Number(scroller?.scrollTop ?? window.scrollY ?? window.pageYOffset ?? 0)
    };
  }

  // ---- Hold Alt (Option) = temporarily decouple ------------------------------
  // While Alt is held, scrolling this pane is not mirrored. When Alt is
  // released, the new distance between the panes becomes the pair's scroll
  // offset. Alt is read from trusted input only (key events reach the focused
  // pane, so wheel and pointer events, which reach the pane under the mouse,
  // carry the modifier state too). Nothing is prevented: Alt shortcuts of the
  // browser and the page keep working.
  let altDecoupled = false;
  let altScrolledWhileDecoupled = false;
  let altCommitPending = false;

  function setAltDecoupled(on) {
    if (on === altDecoupled) return;
    altDecoupled = on;
    if (on || !altScrolledWhileDecoupled) return;
    altScrolledWhileDecoupled = false;
    if (!uiState.enabled) return;
    // Hold scroll messages until the service worker has read both positions,
    // otherwise a scroll right after releasing Alt could move the other pane
    // before the offset is measured.
    altCommitPending = true;
    const { scrollX, scrollY } = readScrollPosition();
    sendRuntimeMessage({ type: MSG.ALT_COMMIT, scrollX, scrollY }).finally(() => {
      altCommitPending = false;
      lastSentScrollX = null;
      lastSentScrollY = null;
      handleLocalScroll();
    });
  }

  function trackAltFromPointer(event) {
    if (!event.isTrusted || !uiState.enabled) return;
    setAltDecoupled(Boolean(event.altKey));
  }

  function trackAltFromKey(event) {
    if (!event.isTrusted || event.key !== 'Alt') return;
    if (!uiState.enabled) return;
    setAltDecoupled(event.type === 'keydown');
  }

  function handleLocalScroll() {
    if (!uiState.enabled) return;          // nothing leaves the page unless this pair is syncing
    const now = performance.now();
    if (isApplyingRemoteScroll || now < suppressScrollUntil) return;
    if (altDecoupled) {
      altScrolledWhileDecoupled = true;
      return;
    }
    if (altCommitPending) return;
    if (scrollRafPending) return;

    scrollRafPending = true;
    requestAnimationFrame(async () => {
      scrollRafPending = false;
      if (!uiState.enabled) return;
      if (isApplyingRemoteScroll || performance.now() < suppressScrollUntil) return;
      if (altDecoupled || altCommitPending) return;

      const { scrollX, scrollY } = readScrollPosition();
      if (scrollX === lastSentScrollX && scrollY === lastSentScrollY) return;

      lastSentScrollX = scrollX;
      lastSentScrollY = scrollY;

      const anchor = uiState.alignMode === 'element' ? buildScrollAnchor() : null;
      await sendRuntimeMessage({ type: MSG.SCROLL, scrollX, scrollY, anchor, timestamp: Date.now() });
    });
  }

  // ---- Scroll containers ---------------------------------------------------------
  // Scrolling inside an element (overflow area, modal, side panel) sends the
  // element's descriptor (plus a class-based hint) and its scroll position.
  // The other pane finds the matching element that can scroll and applies the
  // same position (pixel mode) or the same percentage (element mode).
  const containerDescriptorCache = new WeakMap();
  const remoteContainerQuietUntil = new WeakMap();
  const pendingContainers = new Set();
  let containerRafPending = false;
  let lastContainerKey = null;
  let lastContainerElement = null;

  function canScroll(element) {
    if (!(element instanceof Element)) return false;
    if (element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1) return false;
    try {
      const style = getComputedStyle(element);
      return /(auto|scroll|overlay|hidden)/.test(`${style.overflowY} ${style.overflowX}`);
    } catch (_error) {
      return false;
    }
  }

  function buildContainerDescriptor(element) {
    let descriptor = containerDescriptorCache.get(element);
    if (descriptor) return descriptor;
    descriptor = buildElementDescriptor(element);
    const classes = Array.from(element.classList || [])
      .filter((name) => /^[a-zA-Z_][\w-]{0,40}$/.test(name) && !name.startsWith('svss-'))
      .slice(0, 3);
    if (classes.length) {
      const selector = `${element.tagName.toLowerCase()}.${classes.map(cssEscape).join('.')}`;
      descriptor = { ...descriptor, candidates: [...descriptor.candidates.slice(0, 9), { type: 'css', value: selector, strong: false }] };
    }
    containerDescriptorCache.set(element, descriptor);
    return descriptor;
  }

  function flushContainerScrolls() {
    containerRafPending = false;
    if (!uiState.enabled || !uiState.syncContainers) {
      pendingContainers.clear();
      return;
    }
    for (const element of pendingContainers) {
      if (!element.isConnected) continue;
      const rect = element.getBoundingClientRect();
      const maxY = Math.max(0, element.scrollHeight - element.clientHeight);
      const maxX = Math.max(0, element.scrollWidth - element.clientWidth);
      sendRuntimeMessage({
        type: MSG.CONTAINER_SCROLL,
        container: {
          ...buildContainerDescriptor(element),
          scrollTop: element.scrollTop,
          scrollLeft: element.scrollLeft,
          ratioY: maxY ? element.scrollTop / maxY : 0,
          ratioX: maxX ? element.scrollLeft / maxX : 0,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          vw: window.innerWidth || 0,
          vh: window.innerHeight || 0
        }
      });
    }
    pendingContainers.clear();
  }

  function handleContainerScroll(event) {
    if (!uiState.enabled || !uiState.syncContainers || altDecoupled) return;
    const element = event.target;
    if (!(element instanceof Element)) return; // the page itself: handleLocalScroll
    if (element === document.documentElement || element === document.body || element === document.scrollingElement) return;
    if (isOurHost(element)) return;
    if ((remoteContainerQuietUntil.get(element) || 0) > performance.now()) return;
    pendingContainers.add(element);
    if (containerRafPending) return;
    containerRafPending = true;
    requestAnimationFrame(flushContainerScrolls);
  }

  function resolveContainer(payload) {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    if (!candidates.length) return null;
    const key = JSON.stringify(candidates);
    if (key === lastContainerKey && lastContainerElement?.isConnected && canScroll(lastContainerElement)) return lastContainerElement;

    const { x, y } = mirroredPointToLocal(payload);
    let found = null;
    for (const strongPass of [true, false]) {
      for (const candidate of candidates) {
        if (Boolean(candidate.strong) !== strongPass) continue;
        const matches = matchAllElements(candidate).filter((element) => canScroll(element) && !isOurHost(element));
        if (matches.length) {
          found = pickClosestToPoint(matches, x, y);
          break;
        }
      }
      if (found) break;
    }
    lastContainerKey = key;
    lastContainerElement = found;
    return found;
  }

  function applyRemoteContainerScroll(payload, alignMode) {
    if (!uiState.enabled || !uiState.syncContainers || !payload) return;
    const element = resolveContainer(payload);
    if (!element) return;
    let top = Number(payload.scrollTop) || 0;
    let left = Number(payload.scrollLeft) || 0;
    if (alignMode === 'element') {
      top = (Number(payload.ratioY) || 0) * Math.max(0, element.scrollHeight - element.clientHeight);
      left = (Number(payload.ratioX) || 0) * Math.max(0, element.scrollWidth - element.clientWidth);
    }
    remoteContainerQuietUntil.set(element, performance.now() + 150);
    const previous = element.style.scrollBehavior;
    element.style.scrollBehavior = 'auto';
    element.scrollTop = Math.round(top);
    element.scrollLeft = Math.round(left);
    element.style.scrollBehavior = previous;
  }

  // ---- Alignment "on element/content" ------------------------------------------
  // The source pane picks the top-most visible, non-fixed element that is a
  // good landmark (id, heading, section, image, paragraph, ...) and sends its
  // descriptor, how far the viewport top is below that element's top, and the
  // scroll percentage. The other pane finds the matching element (same
  // descriptor matching as clicks/hover) and puts it at the same spot, or
  // falls back to the percentage.
  const ANCHOR_TAGS = /^(h[1-6]|section|article|header|footer|main|aside|figure|img|picture|video|table|form|ul|ol|li|p|blockquote|pre|dl)$/;
  const anchorDescriptorCache = new WeakMap();

  function isOurHost(node) {
    return Boolean(node) && (node === host || node === rulerHost || node === cursorHost || ourExtraHosts.has(node));
  }

  function isFixedLike(element) {
    try {
      const position = getComputedStyle(element).position;
      return position === 'fixed' || position === 'sticky';
    } catch (_error) {
      return false;
    }
  }

  function pickAnchorElement() {
    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;
    if (!vw || !vh) return null;
    const probes = [[0.5, 0.1], [0.5, 0.25], [0.3, 0.25], [0.7, 0.25], [0.5, 0.45]];
    for (const [fx, fy] of probes) {
      let element = null;
      try { element = document.elementFromPoint(vw * fx, vh * fy); } catch (_error) { element = null; }
      if (!(element instanceof Element) || isOurHost(element)) continue;
      let candidate = null;
      let fixed = false;
      for (let node = element; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
        if (isFixedLike(node)) { fixed = true; break; }
        if (!candidate && (node.id || ANCHOR_TAGS.test(node.tagName.toLowerCase()))) {
          const rect = node.getBoundingClientRect();
          if (rect.height > 0 && rect.height < vh * 3) candidate = node;
        }
      }
      if (fixed) continue;
      if (candidate) return candidate;
      if (element !== document.body && element !== document.documentElement) return element;
    }
    return null;
  }

  function buildScrollAnchor() {
    const element = pickAnchorElement();
    const scroller = document.scrollingElement || document.documentElement;
    const max = Math.max(0, (scroller?.scrollHeight || 0) - (window.innerHeight || 0));
    const ratio = max > 0 ? Math.max(0, Math.min(1, (scroller?.scrollTop || 0) / max)) : 0;
    if (!element) return { candidates: [], ratio, delta: 0 };
    let descriptor = anchorDescriptorCache.get(element);
    if (!descriptor) {
      descriptor = buildElementDescriptor(element);
      anchorDescriptorCache.set(element, descriptor);
    }
    return { ...descriptor, delta: -element.getBoundingClientRect().top, ratio };
  }

  let lastAnchorKey = null;
  let lastAnchorElement = null;

  function documentTopOf(element) {
    return element.getBoundingClientRect().top + (window.scrollY || 0);
  }

  // Strong descriptor match first, then the weak match whose position is
  // closest to where the pixel position would put it.
  function resolveAnchorElement(anchor, expectedTop) {
    const candidates = Array.isArray(anchor?.candidates) ? anchor.candidates : [];
    if (!candidates.length) return null;
    const key = JSON.stringify(candidates);
    if (key === lastAnchorKey && lastAnchorElement?.isConnected) return lastAnchorElement;

    let found = firstDescriptorMatch(candidates, true);
    if (!found) {
      let bestDistance = Infinity;
      for (const candidate of candidates) {
        if (candidate.strong) continue;
        for (const element of matchAllElements(candidate)) {
          if (isOurHost(element)) continue;
          const distance = Math.abs(documentTopOf(element) - expectedTop);
          if (distance < bestDistance) { bestDistance = distance; found = element; }
        }
        if (found) break;
      }
    }
    lastAnchorKey = key;
    lastAnchorElement = found || null;
    return lastAnchorElement;
  }

  function resolveAnchoredScrollY(message) {
    const pixelY = Math.max(0, Number(message.targetScrollY) || 0);
    if (message.alignMode !== 'element' || !message.anchor) return pixelY;
    const anchor = message.anchor;
    const sideOffset = Number(message.sideOffsetY) || 0;
    const delta = Number(anchor.delta) || 0;
    const element = resolveAnchorElement(anchor, pixelY - sideOffset - delta);
    if (element) return Math.max(0, Math.round(documentTopOf(element) + delta + sideOffset));
    if (typeof anchor.ratio === 'number') {
      const scroller = document.scrollingElement || document.documentElement;
      const max = Math.max(0, (scroller?.scrollHeight || 0) - (window.innerHeight || 0));
      return Math.max(0, Math.round(anchor.ratio * max + sideOffset));
    }
    return pixelY;
  }

  function applyRemoteScroll(targetScrollX, targetScrollY) {
    isApplyingRemoteScroll = true;
    suppressScrollUntil = performance.now() + REMOTE_SUPPRESS_MS;

    const left = Math.max(0, Math.round(Number(targetScrollX || 0)));
    const top = Math.max(0, Math.round(Number(targetScrollY || 0)));

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlBehavior = html?.style?.scrollBehavior ?? '';
    const previousBodyBehavior = body?.style?.scrollBehavior ?? '';

    if (html?.style) html.style.scrollBehavior = 'auto';
    if (body?.style) body.style.scrollBehavior = 'auto';

    const scroller = document.scrollingElement || html;
    if (scroller) {
      scroller.scrollLeft = left;
      scroller.scrollTop = top;
    } else {
      window.scrollTo(left, top);
    }

    lastSentScrollX = left;
    lastSentScrollY = top;

    requestAnimationFrame(() => {
      if (html?.style) html.style.scrollBehavior = previousHtmlBehavior;
      if (body?.style) body.style.scrollBehavior = previousBodyBehavior;

      requestAnimationFrame(() => {
        isApplyingRemoteScroll = false;
        suppressScrollUntil = performance.now() + 24;
      });
    });
  }

  function reportNavigationIfChanged() {
    if (navigationRafPending) return;
    navigationRafPending = true;

    requestAnimationFrame(async () => {
      navigationRafPending = false;
      const href = location.href;
      if (href === lastReportedUrl) return;
      lastReportedUrl = href;
      if (!uiState.enabled) return;
      if (!/^https?:\/\//i.test(href)) return;
      await sendRuntimeMessage({ type: MSG.NAVIGATED, url: href, timestamp: Date.now() });
    });
  }

  // pushState/replaceState from the page are seen by the service worker via
  // tabs.onUpdated (the content script runs in an isolated world, so patching
  // `history` here would never see the page's calls).
  function setupNavigationWatcher() {
    window.addEventListener('popstate', reportNavigationIfChanged, true);
    window.addEventListener('hashchange', reportNavigationIfChanged, true);
  }

  function isInsideExtensionUi(event) {
    if (!host) return false;
    const path = event.composedPath ? event.composedPath() : [];
    return path.includes(host);
  }

  // The selector used to find the "activatable" element so the mirrored side
  // can trigger native default actions (navigation, form submit, toggling, ...).
  const INTERACTIVE_SELECTOR = [
    'a[href]', 'button', 'input', 'select', 'textarea', 'label', 'summary', 'details',
    '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',
    '[role="menuitemcheckbox"]', '[role="menuitemradio"]', '[role="checkbox"]',
    '[role="radio"]', '[role="switch"]', '[role="option"]',
    '[onclick]', '[tabindex]', '[aria-controls]', '[aria-haspopup]', '[contenteditable]',
    '[data-action]', '[data-toggle]', '[data-bs-toggle]', '[data-bs-dismiss]',
    '[data-dismiss]', '[data-target]', '[data-modal]', '[data-tab]', '[data-filter]',
    '[data-open]', '[data-close]', '[data-href]', '[data-link]', '[data-trigger]'
  ].join(',');

  function getInteractiveElement(target) {
    if (!(target instanceof Element)) return null;
    return target.closest(INTERACTIVE_SELECTOR);
  }

  function isUniqueSelector(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (_error) {
      return false;
    }
  }

  function createCssPath(element) {
    const parts = [];
    let node = element;

    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.documentElement) {
      const tag = node.tagName.toLowerCase();
      let index = 1;
      let sibling = node.previousElementSibling;
      while (sibling) {
        if (sibling.tagName.toLowerCase() === tag) index += 1;
        sibling = sibling.previousElementSibling;
      }
      parts.unshift(`${tag}:nth-of-type(${index})`);
      node = node.parentElement;
    }

    return parts.length ? parts.join(' > ') : null;
  }

  function isElementVisible(element) {
    if (!(element instanceof Element)) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getEventCoordinates(event) {
    return {
      clientX: typeof event.clientX === 'number' ? event.clientX : 0,
      clientY: typeof event.clientY === 'number' ? event.clientY : 0,
      vw: window.innerWidth || document.documentElement?.clientWidth || 0,
      vh: window.innerHeight || document.documentElement?.clientHeight || 0
    };
  }

  // Build a description of an element so the other pane can find the same one.
  // Each candidate is flagged `strong` when it should uniquely identify the
  // element (id, unique data attribute, link path, ...) versus `weak` hints
  // (visible text, structural CSS path) that are only used as a last resort.
  function buildElementDescriptor(element) {
    if (!(element instanceof Element)) return { tag: null, candidates: [], text: '' };

    const tag = element.tagName ? element.tagName.toLowerCase() : null;
    const candidates = [];
    const ariaLabel = element.getAttribute ? element.getAttribute('aria-label') : null;

    if (element.id) {
      const selector = `#${cssEscape(element.id)}`;
      candidates.push({ type: 'css', value: selector, strong: isUniqueSelector(selector) });
    }

    for (const attr of Array.from(element.attributes || [])) {
      if (!attr.name.startsWith('data-') || !attr.value) continue;
      if (!/(action|toggle|target|id|key|slug|filter|modal|tab|open|close|dismiss|control|elementor|bs|href|link|role|index|name|trigger)/i.test(attr.name)) continue;
      const tagged = `${tag}[${attr.name}="${cssEscape(attr.value)}"]`;
      if (isUniqueSelector(tagged)) candidates.push({ type: 'css', value: tagged, strong: true });
      else candidates.push({ type: 'css', value: `[${attr.name}="${cssEscape(attr.value)}"]`, strong: false });
      if (candidates.length >= 6) break;
    }

    if (ariaLabel) {
      const selector = `${tag}[aria-label="${cssEscape(ariaLabel)}"]`;
      candidates.push({ type: 'css', value: selector, strong: isUniqueSelector(selector) });
    }

    const name = element.getAttribute ? element.getAttribute('name') : null;
    if (name) {
      const selector = `${tag}[name="${cssEscape(name)}"]`;
      candidates.push({ type: 'css', value: selector, strong: isUniqueSelector(selector) });
    }

    if (tag === 'a') {
      const rawHref = element.getAttribute('href');
      if (rawHref) {
        try {
          const url = new URL(rawHref, location.href);
          candidates.push({ type: 'hrefPath', value: `${url.pathname}${url.search}${url.hash}`, strong: true });
        } catch (_error) {
          candidates.push({ type: 'css', value: `a[href="${cssEscape(rawHref)}"]`, strong: false });
        }
      }
    }

    // Never read a field's value: only visible text and labels are used.
    const isField = isFormInput(element);
    const text = isField
      ? normalizeText(ariaLabel || element.getAttribute('placeholder') || '')
      : normalizeText(element.innerText || element.textContent || ariaLabel || '');

    const cssPath = createCssPath(element);
    if (cssPath) candidates.push({ type: 'css', value: cssPath, strong: false });

    if (text && text.length <= 80) candidates.push({ type: 'text', tag, value: text, strong: false });

    const textFingerprint = isField ? '' : normalizeText(element.textContent || '').slice(0, 60);

    return { tag, candidates: candidates.slice(0, 10), text, textFingerprint };
  }

  // Translate a viewport point from the source pane to this pane. X is scaled by
  // the width ratio (a no-op for equal-width split panes, graceful for fluid
  // layouts when the divider was dragged); Y stays absolute because scroll is
  // synced, so the same vertical offset shows the same content.
  function mirroredPointToLocal(payload) {
    const sourceVw = Number(payload?.vw) || window.innerWidth || 1;
    const localVw = window.innerWidth || sourceVw;
    const localVh = window.innerHeight || (document.documentElement?.clientHeight || 0);
    const scaleX = sourceVw > 0 ? localVw / sourceVw : 1;

    let x = (Number(payload?.clientX) || 0) * scaleX;
    let y = Number(payload?.clientY) || 0;

    x = Math.max(0, Math.min(localVw - 1, x));
    y = Math.max(0, Math.min(Math.max(0, localVh - 1), y));
    return { x, y };
  }

  function elementAtMirroredPoint(payload) {
    if (!payload || typeof payload.clientX !== 'number' || typeof payload.clientY !== 'number') return null;
    const { x, y } = mirroredPointToLocal(payload);
    let element = null;
    try {
      element = document.elementFromPoint(x, y);
    } catch (_error) {
      element = null;
    }
    if (!(element instanceof Element)) return null;
    if (host && (element === host || host.contains(element))) return null; // never target our own UI
    return element;
  }

  function matchCssCandidate(value) {
    try {
      return Array.from(document.querySelectorAll(value)).find(isElementVisible) || null;
    } catch (_error) {
      return null;
    }
  }

  function matchHrefCandidate(value) {
    const links = Array.from(document.querySelectorAll('a[href]'));
    return links.find((link) => {
      try {
        const url = new URL(link.getAttribute('href'), location.href);
        return `${url.pathname}${url.search}${url.hash}` === value && isElementVisible(link);
      } catch (_error) {
        return false;
      }
    }) || null;
  }

  function matchTextCandidate(tag, value) {
    const selector = tag || 'a,button,[role="button"],input[type="button"],input[type="submit"],summary,label';
    try {
      return Array.from(document.querySelectorAll(selector)).find((element) => {
        const text = normalizeText(isFormInput(element) ? (element.getAttribute('aria-label') || element.getAttribute('placeholder') || '') : (element.innerText || element.textContent || (element.getAttribute && element.getAttribute('aria-label')) || ''));
        return text === value && isElementVisible(element);
      }) || null;
    } catch (_error) {
      return null;
    }
  }

  function matchCandidate(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    if (candidate.type === 'css' && candidate.value) return matchCssCandidate(candidate.value);
    if (candidate.type === 'hrefPath' && candidate.value) return matchHrefCandidate(candidate.value);
    if (candidate.type === 'text' && candidate.value) return matchTextCandidate(candidate.tag, candidate.value);
    return null;
  }

  function firstDescriptorMatch(candidates, strongOnly) {
    for (const candidate of candidates) {
      if (strongOnly && !candidate.strong) continue;
      if (!strongOnly && candidate.strong) continue;
      const element = matchCandidate(candidate);
      if (element) return element;
    }
    return null;
  }

  function matchAllElements(candidate) {
    if (!candidate || typeof candidate !== 'object') return [];
    if (candidate.type === 'css' && candidate.value) {
      try {
        return Array.from(document.querySelectorAll(candidate.value)).filter(isElementVisible);
      } catch (_error) {
        return [];
      }
    }
    if (candidate.type === 'hrefPath' && candidate.value) {
      return Array.from(document.querySelectorAll('a[href]')).filter((link) => {
        try {
          const url = new URL(link.getAttribute('href'), location.href);
          return `${url.pathname}${url.search}${url.hash}` === candidate.value && isElementVisible(link);
        } catch (_error) {
          return false;
        }
      });
    }
    if (candidate.type === 'text' && candidate.value) {
      const selector = candidate.tag || 'a,button,[role="button"],input[type="button"],input[type="submit"],summary,label';
      try {
        return Array.from(document.querySelectorAll(selector)).filter((element) => {
          const text = normalizeText(isFormInput(element) ? (element.getAttribute('aria-label') || element.getAttribute('placeholder') || '') : (element.innerText || element.textContent || (element.getAttribute && element.getAttribute('aria-label')) || ''));
          return text === candidate.value && isElementVisible(element);
        });
      } catch (_error) {
        return [];
      }
    }
    return [];
  }

  function pickClosestToPoint(elements, x, y) {
    if (elements.length === 0) return null;
    if (elements.length === 1) return elements[0];
    let best = null;
    let bestDist = Infinity;
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(cx - x, cy - y);
      if (dist < bestDist) { bestDist = dist; best = el; }
    }
    return best;
  }

  function closestDescriptorMatch(candidates, strongOnly, x, y) {
    for (const candidate of candidates) {
      if (strongOnly && !candidate.strong) continue;
      if (!strongOnly && candidate.strong) continue;
      const matches = matchAllElements(candidate);
      if (matches.length === 0) continue;
      return pickClosestToPoint(matches, x, y);
    }
    return null;
  }

  // Clicks: prefer a strong descriptor match (robust to differing pane widths),
  // then fall back to the element under the mirrored coordinates (handles modal
  // backdrops, overlays and custom widgets), then weak hints.
  // When both a coordinate match and a weak match exist and are unrelated,
  // use textFingerprint to pick the one whose content best matches the source.
  function resolveClickTarget(payload) {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    const textFingerprint = typeof payload?.textFingerprint === 'string' ? payload.textFingerprint : '';

    const strong = firstDescriptorMatch(candidates, true);
    if (strong) return strong;

    const coordElement = elementAtMirroredPoint(payload);
    const weak = firstDescriptorMatch(candidates, false);

    if (coordElement && weak && weak !== coordElement && !coordElement.contains(weak) && !weak.contains(coordElement)) {
      if (textFingerprint) {
        const coordText = normalizeText(coordElement.textContent || '').slice(0, 60);
        const weakText = normalizeText(weak.textContent || '').slice(0, 60);
        if (coordText === textFingerprint && weakText !== textFingerprint) return coordElement;
      }
      return weak;
    }

    return coordElement || weak;
  }

  // Hover: position first (exact viewport coordinates), then descriptors with
  // position-aware tiebreaking so duplicate elements (same link in header AND
  // footer) always resolve to the one closest to where the pointer actually is.
  function resolveHoverTarget(payload) {
    const coordElement = elementAtMirroredPoint(payload);
    if (coordElement) return coordElement;

    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    const { x, y } = mirroredPointToLocal(payload);
    return closestDescriptorMatch(candidates, true, x, y)
        || closestDescriptorMatch(candidates, false, x, y);
  }

  function fireSyntheticPointerEvent(type, element, x, y, extra = {}) {
    if (!(element instanceof Element)) return;
    const pressing = type === 'pointerdown' || type === 'mousedown';
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y,
      button: 0,
      buttons: pressing ? 1 : 0,
      ...extra
    };

    let event = null;
    try {
      if (type.startsWith('pointer') && typeof PointerEvent === 'function') {
        event = new PointerEvent(type, { pointerId: 1, pointerType: 'mouse', isPrimary: true, ...init });
      } else {
        event = new MouseEvent(type, init);
      }
    } catch (_error) {
      try {
        event = new MouseEvent(type, init);
      } catch (_secondError) {
        return;
      }
    }

    try {
      element.dispatchEvent(event);
    } catch (_error) {}
  }

  // Clicks that could submit data or trigger an irreversible action on the
  // other site are never replayed there: submit buttons, anything inside a
  // POST form (text fields still get focus) and elements whose label or link
  // reads like delete / pay / confirm / buy / order / log out.
  const RISKY_ACTION_WORDS = /(^|[^a-z\u00c0-\u024f])(delete|verwijder\w*|remove|pay|payment|betaa?l\w*|confirm|bevestig\w*|buy|koop|kopen|order|bestel\w*|checkout|afrekenen|log[\s_-]?out|logoff|sign[\s_-]?out|uitlog\w*|afmelden)([^a-z\u00c0-\u024f]|$)/i;

  function isTextLikeInput(element) {
    if (!(element instanceof Element)) return false;
    const tag = element.tagName.toLowerCase();
    if (tag === 'textarea' || element.isContentEditable) return true;
    if (tag !== 'input') return false;
    const type = (element.getAttribute('type') || 'text').toLowerCase();
    return !['button', 'submit', 'reset', 'image', 'checkbox', 'radio', 'file', 'color', 'range'].includes(type);
  }

  function isSubmitControl(element) {
    if (!(element instanceof Element)) return false;
    const tag = element.tagName.toLowerCase();
    const type = (element.getAttribute('type') || '').toLowerCase();
    // A <button> without type submits only when it belongs to a form.
    if (tag === 'button') return (type === '' || type === 'submit') && Boolean(ownerForm(element));
    if (tag === 'input') return type === 'submit' || type === 'image';
    return false;
  }

  function ownerForm(element) {
    if (!(element instanceof Element)) return null;
    if (element.form instanceof HTMLFormElement) return element.form;
    return element.closest('form');
  }

  function actionTextOf(element) {
    if (!(element instanceof Element)) return '';
    const parts = [
      element.getAttribute('aria-label'),
      element.getAttribute('title')
    ];
    // Only short captions count; a large container (e.g. a modal backdrop) is
    // judged by its own attributes, not by every word inside it.
    const caption = isFormInput(element) ? '' : normalizeText(element.innerText || element.textContent || '');
    if (caption.length <= 120) parts.push(caption);
    const tag = element.tagName.toLowerCase();
    const type = (element.getAttribute('type') || '').toLowerCase();
    // The visible caption of an input button is its value; never read other values.
    if (tag === 'input' && ['button', 'submit', 'reset'].includes(type)) parts.push(element.getAttribute('value'));
    if (tag === 'a') {
      const href = element.getAttribute('href') || '';
      try {
        const url = new URL(href, location.href);
        parts.push(decodeURIComponent(`${url.pathname} ${url.search} ${url.hash}`).replace(/[/?&=._-]+/g, ' '));
      } catch (_error) {
        parts.push(href);
      }
    }
    return parts.filter(Boolean).join(' ');
  }

  function isRiskyClickTarget(pointElement, activatable) {
    for (const element of [activatable, pointElement]) {
      if (!(element instanceof Element)) continue;
      if (isSubmitControl(element)) return true;
      const form = ownerForm(element);
      if (form && String(form.getAttribute('method') || '').toLowerCase() === 'post' && !isTextLikeInput(element)) return true;
      if (RISKY_ACTION_WORDS.test(actionTextOf(element))) return true;
    }
    return false;
  }

  let lastSkipToastAt = 0;

  function notifyClickSkipped() {
    const now = Date.now();
    if (now - lastSkipToastAt < 3000) return;
    lastSkipToastAt = now;
    showToast(t('toastClickSkipped', 'Click not mirrored (form/action)'));
  }

  function isForThisOrigin(message) {
    return typeof message?.targetOrigin === 'string' && message.targetOrigin === location.origin;
  }

  // Replay a realistic pointer/mouse sequence, then trigger exactly one real
  // activation. The native .click() handles default actions (links, checkbox
  // toggles) and only fires `click` once, so toggles never double-fire.
  function applyRemoteClick(payload) {
    if (!uiState.enabled || !uiState.mirrorClicks) return;

    const pointElement = resolveClickTarget(payload);
    if (!pointElement || isSensitiveField(pointElement)) return;

    const activatable = getInteractiveElement(pointElement);
    if (isRiskyClickTarget(pointElement, activatable)) {
      notifyClickSkipped();
      return;
    }
    const rect = pointElement.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    // If the resolved element is (or contains) a form input, work on the input directly.
    const formInputEl = (isFormInput(pointElement) ? pointElement : null)
      || (activatable && isFormInput(activatable) ? activatable : null);
    const activeEl = formInputEl || activatable;

    isApplyingRemoteClick = true;
    remoteClickSuppressUntil = performance.now() + REMOTE_CLICK_SUPPRESS_MS;

    try {
      fireSyntheticPointerEvent('pointerover', pointElement, x, y);
      fireSyntheticPointerEvent('mouseover', pointElement, x, y);
      fireSyntheticPointerEvent('pointerdown', pointElement, x, y);
      fireSyntheticPointerEvent('mousedown', pointElement, x, y);

      if (activeEl && typeof activeEl.focus === 'function') {
        try { activeEl.focus({ preventScroll: true }); } catch (_error) {
          try { activeEl.focus(); } catch (_secondError) {}
        }
      }

      fireSyntheticPointerEvent('pointerup', pointElement, x, y);
      fireSyntheticPointerEvent('mouseup', pointElement, x, y);

      if (formInputEl) {
        // For plain text-like inputs, focus is enough — avoid a spurious .click()
        // that can echo back or confuse framework event handlers.
        const inputType = (formInputEl.type || '').toLowerCase();
        const isToggle = inputType === 'checkbox' || inputType === 'radio';
        const isTextLike = !isToggle && formInputEl.tagName.toLowerCase() !== 'select';

        if (!isTextLike) {
          formInputEl.click();
          formInputEl.dispatchEvent(new Event('input', { bubbles: true }));
          formInputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else if (activatable && typeof activatable.click === 'function') {
        const href = activatable.getAttribute && activatable.getAttribute('href');
        if (!href || !/^javascript:/i.test(href)) activatable.click();
      } else {
        fireSyntheticPointerEvent('click', pointElement, x, y);
      }
    } catch (error) {
      debug('remote click failed', error);
    } finally {
      setTimeout(() => {
        isApplyingRemoteClick = false;
        remoteClickSuppressUntil = performance.now() + 60;
      }, 0);
    }
  }

  function handleLocalClick(event) {
    if (!uiState.enabled || !uiState.mirrorClicks) return;
    if (!event.isTrusted) return;            // synthetic / mirrored clicks are never trusted -> no echo loop
    if (event.button !== undefined && event.button !== 0) return; // primary button only
    if (isApplyingRemoteClick || performance.now() < remoteClickSuppressUntil) return;
    if (isInsideExtensionUi(event)) return;
    if (isInsideRulerUi(event)) return;
    if (isSensitiveField(event.target)) return;

    const point = getEventCoordinates(event);
    const target = event.target instanceof Element ? event.target : null;
    const descriptor = buildElementDescriptor(target);

    sendRuntimeMessage({
      type: MSG.CLICK,
      click: { ...descriptor, ...point },
      timestamp: Date.now()
    });
  }

  // Fields whose content must never leave the page or be mirrored: passwords,
  // one-time codes and payment card data. Their value is never read, and
  // clicks/focus on them are not mirrored.
  const SENSITIVE_AUTOCOMPLETE = /(^|\s)(current-password|new-password|one-time-code|cc-[a-z-]+)(\s|$)/i;
  // Matched anywhere in the hint text.
  const SENSITIVE_NAME = /(pass(word|wd)?|pwd|secret|token|otp|cvc|cvv|card.?num|cc.?(num|exp|csc)|iban|security.?code|pincode|passcode|verification|2fa|mfa|totp)/i;
  // Short words matched as a whole token only (so "shipping" is not a PIN).
  const SENSITIVE_TOKEN = /(^|[^a-z0-9])(pin|ssn|bsn|sofi|code|auth|tan)([^a-z0-9]|$)/i;

  function isSensitiveField(element) {
    if (!(element instanceof Element)) return false;
    const field = element.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
    if (!field) return false;
    const type = (field.getAttribute('type') || '').toLowerCase();
    if (type === 'password') return true;
    if (SENSITIVE_AUTOCOMPLETE.test(field.getAttribute('autocomplete') || '')) return true;
    const hints = ['name', 'id', 'aria-label', 'placeholder', 'data-testid']
      .map((attr) => field.getAttribute(attr) || '')
      .join(' ')
      .replace(/([a-z])([A-Z0-9])/g, '$1 $2'); // userPin -> user Pin
    return SENSITIVE_NAME.test(hints) || SENSITIVE_TOKEN.test(hints);
  }

  function sanitizeRulers(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter((r) => r && typeof r.id === 'string' && /^r-[a-z0-9-]{1,32}$/.test(r.id))
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        y: Math.max(0, Math.min(100000, Math.round(Number(r.y) || 0))),
        thickness: Math.max(1, Math.min(20, Math.round(Number(r.thickness) || 2)))
      }));
  }

  function isFormInput(element) {
    if (!(element instanceof Element)) return false;
    const tag = element.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (tag === 'div' || tag === 'span') return element.isContentEditable;
    return false;
  }

  function handleLocalFocusIn(event) {
    if (!uiState.enabled || !uiState.mirrorClicks) return;
    if (!event.isTrusted) return;
    if (isApplyingRemoteClick || performance.now() < remoteClickSuppressUntil) return;
    if (isInsideExtensionUi(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !isFormInput(target) || isSensitiveField(target)) return;
    const descriptor = buildElementDescriptor(target);
    const point = getEventCoordinates(event);
    sendRuntimeMessage({ type: MSG.FOCUS, focus: { ...descriptor, ...point } });
  }

  function applyRemoteFocus(payload) {
    if (!uiState.enabled || !uiState.mirrorClicks) return;
    const element = resolveClickTarget(payload);
    if (!element || !isFormInput(element) || isSensitiveField(element)) return;
    try {
      element.focus({ preventScroll: true });
    } catch (_error) {
      try { element.focus(); } catch (_e) {}
    }
  }

  // ---- Ruler lines ----------------------------------------------------------

  // Rulers and their settings bar live in their own fresh host with a closed
  // shadow root, like the panel, so the page cannot reach or fake them.
  function teardownRulerHost() {
    hideRulerPopup();
    if (rulerHost) rulerHost.remove();
    rulerHost = null;
    rulerShadow = null;
    rulerLayer = null;
  }

  function ensureRulerLayer() {
    const foreignIds = [RULER_HOST_ID, ...LEGACY_RULER_IDS];
    if (rulerHost && rulerShadow && rulerLayer && rulerHost.isConnected && rulerHost.parentNode === document.documentElement) {
      removeForeignNodes(foreignIds, rulerHost);
      return rulerLayer;
    }

    teardownRulerHost();
    removeForeignNodes(foreignIds, null);
    if (!document.documentElement) return null;

    rulerHost = document.createElement('div');
    rulerHost.id = RULER_HOST_ID;
    const declarations = {
      display: 'block', visibility: 'visible', opacity: '1', filter: 'none', transform: 'none',
      'clip-path': 'none', mask: 'none', position: 'fixed', top: '0', left: '0', width: '0', height: '0',
      margin: '0', padding: '0', border: '0', overflow: 'visible', 'pointer-events': 'none',
      'z-index': '2147483640'
    };
    for (const [property, value] of Object.entries(declarations)) rulerHost.style.setProperty(property, value, 'important');
    document.documentElement.appendChild(rulerHost);
    rulerShadow = rulerHost.attachShadow({ mode: 'closed' });

    rulerLayer = document.createElement('div');
    rulerLayer.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;overflow:visible;';
    rulerShadow.appendChild(rulerLayer);
    return rulerLayer;
  }

  function isInsideRulerUi(event) {
    if (!rulerHost) return false;
    const path = event.composedPath ? event.composedPath() : [];
    return path.includes(rulerHost);
  }

  function rulerPopupTop(y, thickness) {
    return y < 70 ? y + (thickness || 2) + 10 : y - 70;
  }

  function updateRulerPosition(id, y) {
    if (!rulerLayer) return;
    const el = rulerLayer.querySelector(`[data-svss-ruler-id="${id}"]`);
    if (el) el.style.top = `${y}px`;
    if (rulerPopup && rulerPopup.dataset.svssForRuler === id) {
      const ruler = rulers.find((r) => r.id === id);
      rulerPopup.style.top = `${rulerPopupTop(y, ruler ? ruler.thickness : 2)}px`;
    }
  }

  function hideRulerPopup() {
    if (rulerPopup) {
      rulerPopup.remove();
      rulerPopup = null;
    }
  }

  function showRulerPopup(ruler) {
    hideRulerPopup();
    if (!ensureRulerLayer() || !rulerShadow) return;
    const popupY = rulerPopupTop(ruler.y, ruler.thickness);

    rulerPopup = document.createElement('div');
    rulerPopup.dataset.svssForRuler = ruler.id;
    rulerPopup.style.cssText = [
      'position:fixed', 'left:12px', `top:${popupY}px`,
      'z-index:2147483641', 'display:flex', 'align-items:center', 'gap:8px',
      'padding:6px 10px', 'border-radius:8px',
      'border:1px solid #2a3732',
      'background:#15201b', 'color:#e6eeea',
      'font:500 12px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif',
      'box-shadow:0 2px 6px rgba(0,0,0,0.12),0 12px 32px rgba(0,0,0,0.24)',
      'pointer-events:auto', 'user-select:none', 'white-space:nowrap'
    ].join(';');

    const label = document.createElement('span');
    label.textContent = t('rulerThickness', 'Thickness');
    label.style.color = '#a3b3ac';

    const thicknessInput = document.createElement('input');
    thicknessInput.type = 'number';
    thicknessInput.min = '1';
    thicknessInput.max = '20';
    thicknessInput.setAttribute('aria-label', t('rulerThickness', 'Thickness'));
    thicknessInput.value = String(ruler.thickness);
    thicknessInput.style.cssText = 'width:48px;height:26px;padding:0 4px;border:1px solid #3a4943;border-radius:6px;background:#1f2a27;color:#e6eeea;font:inherit;text-align:center;outline-color:#7ff0be;';
    thicknessInput.addEventListener('change', (e) => {
      if (!isTrustedUiEvent(e, rulerHost)) {
        thicknessInput.value = String(ruler.thickness);
        return;
      }
      const t = Math.max(1, Math.min(20, parseInt(thicknessInput.value, 10) || 1));
      thicknessInput.value = String(t);
      sendRuntimeMessage({ type: MSG.RULER_UPDATE, id: ruler.id, thickness: t });
    });
    thicknessInput.addEventListener('mousedown', (e) => e.stopPropagation());
    thicknessInput.addEventListener('click', (e) => e.stopPropagation());
    thicknessInput.addEventListener('keydown', (e) => e.stopPropagation());

    const pxLabel = document.createElement('span');
    pxLabel.textContent = 'px';
    pxLabel.style.color = '#a3b3ac';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = t('rulerDelete', 'Delete');
    deleteBtn.style.cssText = 'min-height:26px;padding:2px 10px;border:1px solid #6b3a3a;border-radius:6px;background:transparent;color:#ffa8a8;cursor:pointer;font:inherit;line-height:1.4;outline-color:#7ff0be;';
    deleteBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isTrustedUiEvent(e, rulerHost)) return;
      const id = ruler.id;
      deselectRuler();
      sendRuntimeMessage({ type: MSG.RULER_DELETE, id });
    });

    rulerPopup.appendChild(label);
    rulerPopup.appendChild(thicknessInput);
    rulerPopup.appendChild(pxLabel);
    rulerPopup.appendChild(deleteBtn);
    rulerShadow.appendChild(rulerPopup);
  }

  function applyRulerColors() {
    if (!rulerLayer) return;
    for (const el of rulerLayer.querySelectorAll('.svss-ruler')) {
      const rid = el.dataset.svssRulerId;
      el.style.background = (rid === selectedRulerId || rid === peerSelectedRulerId)
        ? 'rgba(60,190,222,0.9)'
        : 'rgba(60,222,149,0.85)';
    }
  }

  function deselectRuler() {
    selectedRulerId = null;
    applyRulerColors();
    hideRulerPopup();
    sendRuntimeMessage({ type: MSG.RULER_SELECT, id: null });
  }

  function selectRuler(id) {
    selectedRulerId = id;
    applyRulerColors();
    const ruler = rulers.find((r) => r.id === id);
    if (ruler) showRulerPopup(ruler);
    sendRuntimeMessage({ type: MSG.RULER_SELECT, id });
  }

  function createRulerEl(ruler) {
    const el = document.createElement('div');
    el.className = 'svss-ruler';
    el.dataset.svssRulerId = ruler.id;
    el.style.cssText = [
      'position:fixed', 'left:0', 'width:100vw',
      `top:${ruler.y}px`, `height:${ruler.thickness}px`,
      'background:rgba(60,222,149,0.85)',
      'cursor:ns-resize', 'pointer-events:auto',
      'box-sizing:border-box', 'user-select:none',
      'transition:background 80ms ease'
    ].join(';');

    el.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      if (!isTrustedUiEvent(event, rulerHost)) return;
      event.preventDefault();
      event.stopPropagation();
      selectRuler(ruler.id);
      isDraggingRuler = true;
      dragRulerId = ruler.id;
      dragStartClientY = event.clientY;
      const current = rulers.find((r) => r.id === ruler.id);
      dragStartRulerY = current ? current.y : ruler.y;
      rulerDragY = dragStartRulerY;
    }, true);

    return el;
  }

  function renderRulers() {
    if (!rulers.length) {
      if (selectedRulerId) deselectRuler();
      peerSelectedRulerId = null;
      teardownRulerHost();
      return;
    }

    const layer = ensureRulerLayer();
    if (!layer) return;
    const renderedIds = new Set();

    for (const ruler of rulers) {
      let el = layer.querySelector(`[data-svss-ruler-id="${ruler.id}"]`);
      if (el) {
        el.style.top = `${ruler.y}px`;
        el.style.height = `${ruler.thickness}px`;
      } else {
        el = createRulerEl(ruler);
        layer.appendChild(el);
      }
      renderedIds.add(ruler.id);
    }

    applyRulerColors();

    for (const el of Array.from(layer.querySelectorAll('.svss-ruler'))) {
      if (!renderedIds.has(el.dataset.svssRulerId)) el.remove();
    }

    if (selectedRulerId && !renderedIds.has(selectedRulerId)) {
      selectedRulerId = null;
      hideRulerPopup();
    }

    if (selectedRulerId && rulerPopup) {
      const ruler = rulers.find((r) => r.id === selectedRulerId);
      if (ruler) {
        rulerPopup.style.top = `${rulerPopupTop(ruler.y, ruler.thickness)}px`;
        const inp = rulerPopup.querySelector('input[type="number"]');
        if (inp && rulerShadow?.activeElement !== inp) inp.value = String(ruler.thickness);
      }
    }
  }

  function flushRulerDrag() {
    rulerDragRafPending = false;
    if (!isDraggingRuler || !dragRulerId) return;
    const ruler = rulers.find((r) => r.id === dragRulerId);
    if (ruler) {
      ruler.y = rulerDragY;
      updateRulerPosition(dragRulerId, rulerDragY);
    }
    sendRuntimeMessage({ type: MSG.RULER_MOVE, id: dragRulerId, y: rulerDragY });
  }

  function handleRulerMouseMove(event) {
    if (!isDraggingRuler || !event.isTrusted) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.clientY - dragStartClientY;
    rulerDragY = Math.max(0, dragStartRulerY + delta);
    if (!rulerDragRafPending) {
      rulerDragRafPending = true;
      requestAnimationFrame(flushRulerDrag);
    }
  }

  function handleRulerMouseUp(event) {
    if (!isDraggingRuler || !event.isTrusted) return;
    event.stopPropagation();
    isDraggingRuler = false;
    const id = dragRulerId;
    const y = rulerDragY;
    dragRulerId = null;
    const ruler = rulers.find((r) => r.id === id);
    if (ruler) {
      ruler.y = y;
      updateRulerPosition(id, y);
    }
    sendRuntimeMessage({ type: MSG.RULER_MOVE, id, y });
  }

  function handleRulerKeyDown(event) {
    if (!selectedRulerId || !event.isTrusted) return;
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;
    const active = document.activeElement;
    if (host && active === host) return;
    if (rulerHost && active === rulerHost) return;
    if (active && active !== document.body && active.matches('input,textarea,select,[contenteditable="true"]')) return;
    event.preventDefault();
    const id = selectedRulerId;
    deselectRuler();
    sendRuntimeMessage({ type: MSG.RULER_DELETE, id });
  }

  window.addEventListener('mousemove', handleRulerMouseMove, true);
  window.addEventListener('mouseup', handleRulerMouseUp, true);
  document.addEventListener('keydown', handleRulerKeyDown, true);

  // ---- Hover mirroring -----------------------------------------------------

  function rewriteHoverSelector(selectorText) {
    if (!selectorText || selectorText.indexOf(':hover') === -1) return null;
    return selectorText.split(':hover').join(`.${FORCE_HOVER_CLASS}`);
  }

  function collectForceHoverRules(rules, out, conditionPrefix) {
    for (const rule of rules) {
      if (out.length >= MAX_FORCE_HOVER_RULES) return;

      if (rule.selectorText && rule.style) {
        const rewritten = rewriteHoverSelector(rule.selectorText);
        if (rewritten) {
          const body = rule.style.cssText;
          if (body) {
            out.push(conditionPrefix ? `${conditionPrefix}{${rewritten}{${body}}}` : `${rewritten}{${body}}`);
          }
        }
        continue;
      }

      if (rule.cssRules && (rule.media || rule.conditionText)) {
        const condition = rule.media ? `@media ${rule.media.mediaText}` : `@supports ${rule.conditionText}`;
        collectForceHoverRules(rule.cssRules, out, condition);
        continue;
      }

      if (rule.styleSheet) {
        let nested = null;
        try { nested = rule.styleSheet.cssRules; } catch (_error) { nested = null; }
        if (nested) collectForceHoverRules(nested, out, conditionPrefix);
      }
    }
  }

  // Duplicate every readable :hover rule into an equivalent `.svss-force-hover`
  // rule so the hover styling can be reproduced without a physical cursor.
  // Cross-origin stylesheets cannot be read by the browser and are skipped.
  function buildForceHoverStyleText() {
    const out = [];
    const sheets = Array.from(document.styleSheets || []);
    for (const sheet of sheets) {
      if (sheet.ownerNode && sheet.ownerNode.id === FORCE_HOVER_STYLE_ID) continue;
      let rules = null;
      try { rules = sheet.cssRules; } catch (_error) { rules = null; }
      if (!rules) continue;
      collectForceHoverRules(rules, out, null);
      if (out.length >= MAX_FORCE_HOVER_RULES) break;
    }
    return out.join('\n');
  }

  function ensureForceHoverStyle() {
    const sheetCount = document.styleSheets ? document.styleSheets.length : 0;
    if (forceHoverStyleEl && forceHoverStyleEl.isConnected && forceHoverBuiltSheetCount === sheetCount) return;

    if (!forceHoverStyleEl) {
      forceHoverStyleEl = document.getElementById(FORCE_HOVER_STYLE_ID);
      if (!forceHoverStyleEl) {
        forceHoverStyleEl = document.createElement('style');
        forceHoverStyleEl.id = FORCE_HOVER_STYLE_ID;
      }
    }

    try {
      forceHoverStyleEl.textContent = buildForceHoverStyleText();
    } catch (_error) {
      forceHoverStyleEl.textContent = '';
    }

    if (!forceHoverStyleEl.isConnected) {
      (document.head || document.documentElement).appendChild(forceHoverStyleEl);
    }
    forceHoverBuiltSheetCount = sheetCount;
  }

  function teardownForceHoverStyle() {
    if (forceHoverStyleEl) forceHoverStyleEl.remove();
    forceHoverStyleEl = null;
    forceHoverBuiltSheetCount = -1;
  }

  function hoverCoordsFor(element, payload) {
    if (payload && typeof payload.clientX === 'number') {
      const point = mirroredPointToLocal(payload);
      return { x: point.x, y: point.y };
    }
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function dispatchHoverEnter(element, fromElement, payload) {
    if (!(element instanceof Element)) return;
    const { x, y } = hoverCoordsFor(element, payload);
    isApplyingRemoteHover = true;
    try {
      fireSyntheticPointerEvent('pointerover', element, x, y, { relatedTarget: fromElement || null });
      fireSyntheticPointerEvent('mouseover', element, x, y, { relatedTarget: fromElement || null });
      fireSyntheticPointerEvent('pointerenter', element, x, y, { bubbles: false, relatedTarget: fromElement || null });
      fireSyntheticPointerEvent('mouseenter', element, x, y, { bubbles: false, relatedTarget: fromElement || null });
      fireSyntheticPointerEvent('pointermove', element, x, y);
      fireSyntheticPointerEvent('mousemove', element, x, y);
    } finally {
      isApplyingRemoteHover = false;
    }
  }

  function dispatchHoverLeave(element, toElement, payload) {
    if (!(element instanceof Element)) return;
    const { x, y } = hoverCoordsFor(element, payload);
    isApplyingRemoteHover = true;
    try {
      fireSyntheticPointerEvent('pointerout', element, x, y, { relatedTarget: toElement || null });
      fireSyntheticPointerEvent('mouseout', element, x, y, { relatedTarget: toElement || null });
      fireSyntheticPointerEvent('pointerleave', element, x, y, { bubbles: false, relatedTarget: toElement || null });
      fireSyntheticPointerEvent('mouseleave', element, x, y, { bubbles: false, relatedTarget: toElement || null });
    } finally {
      isApplyingRemoteHover = false;
    }
  }

  function dispatchHoverMove(element, payload) {
    if (!(element instanceof Element)) return;
    const { x, y } = hoverCoordsFor(element, payload);
    isApplyingRemoteHover = true;
    try {
      fireSyntheticPointerEvent('pointermove', element, x, y);
      fireSyntheticPointerEvent('mousemove', element, x, y);
    } finally {
      isApplyingRemoteHover = false;
    }
  }

  function clearForcedHover() {
    if (forcedHoverEls.length) {
      for (const element of forcedHoverEls) {
        if (element && element.classList) element.classList.remove(FORCE_HOVER_CLASS);
      }
    }
    forcedHoverEls = [];
    if (lastAppliedHoverEl) {
      dispatchHoverLeave(lastAppliedHoverEl, null, null);
      lastAppliedHoverEl = null;
    }
  }

  // CSS :hover applies to the hovered element AND its ancestors, so mirror the
  // forced class up the whole ancestor chain.
  function setForcedHoverChain(element, payload) {
    const chain = [];
    let node = element;
    while (node && node.nodeType === Node.ELEMENT_NODE) {
      chain.push(node);
      if (node === document.documentElement) break;
      node = node.parentElement;
    }

    const chainSet = new Set(chain);
    for (const previous of forcedHoverEls) {
      if (!chainSet.has(previous) && previous && previous.classList) previous.classList.remove(FORCE_HOVER_CLASS);
    }
    for (const current of chain) {
      if (current.classList) current.classList.add(FORCE_HOVER_CLASS);
    }
    forcedHoverEls = chain;

    if (element !== lastAppliedHoverEl) {
      if (lastAppliedHoverEl) dispatchHoverLeave(lastAppliedHoverEl, element, payload);
      dispatchHoverEnter(element, lastAppliedHoverEl, payload);
      lastAppliedHoverEl = element;
    } else {
      dispatchHoverMove(element, payload);
    }
  }

  function applyRemoteHover(payload) {
    if (!uiState.enabled || !uiState.mirrorHover) return;
    ensureForceHoverStyle();
    const element = resolveHoverTarget(payload);
    if (!element) {
      clearForcedHover();
      return;
    }
    setForcedHoverChain(element, payload);
  }

  function applyRemoteHoverClear() {
    clearForcedHover();
  }

  function reconcileHoverFeatureState() {
    if (!uiState.enabled || !uiState.mirrorHover) {
      clearForcedHover();
      teardownForceHoverStyle();
      lastHoverEl = null;
      pendingHoverEl = null;
      hoverActiveSent = false;
    }
  }

  function flushHoverSend() {
    hoverSendRafPending = false;
    if (!uiState.enabled || !uiState.mirrorHover) return;
    const element = pendingHoverEl;
    if (!(element instanceof Element)) return;

    const descriptor = buildElementDescriptor(element);
    hoverActiveSent = true;
    sendRuntimeMessage({
      type: MSG.HOVER,
      hover: {
        ...descriptor,
        clientX: pendingHoverClientX,
        clientY: pendingHoverClientY,
        vw: window.innerWidth || 0,
        vh: window.innerHeight || 0
      },
      timestamp: Date.now()
    });
  }

  function handleLocalPointerMove(event) {
    if (!uiState.enabled || !uiState.mirrorHover) return;
    if (!event.isTrusted) return;            // ignore our own synthetic moves
    if (isApplyingRemoteHover) return;
    if (isInsideExtensionUi(event)) {
      sendHoverClear();
      return;
    }
    if (isInsideRulerUi(event)) return;

    const element = event.target instanceof Element ? event.target : null;
    if (!element) return;

    pendingHoverEl = element;
    pendingHoverClientX = typeof event.clientX === 'number' ? event.clientX : 0;
    pendingHoverClientY = typeof event.clientY === 'number' ? event.clientY : 0;

    if (element === lastHoverEl) return;     // only resend when the hovered element changes
    lastHoverEl = element;

    if (hoverSendRafPending) return;
    hoverSendRafPending = true;
    requestAnimationFrame(flushHoverSend);
  }

  function sendHoverClear() {
    lastHoverEl = null;
    pendingHoverEl = null;
    if (!hoverActiveSent) return;
    hoverActiveSent = false;
    sendRuntimeMessage({ type: MSG.HOVER_CLEAR, timestamp: Date.now() });
  }

  // ---- Virtual mouse cursor ---------------------------------------------------
  // The pane with the real mouse sends its pointer position (numbers only,
  // from trusted events, rAF-throttled to ~30/s) while the pair is syncing on
  // its pinned origins. The other pane draws a pointer arrow at the mirrored
  // point, mapped like hover mirroring (mirroredPointToLocal). The arrow lives
  // in its own fresh host with a closed shadow root and pointer-events:none:
  // the page can see that the host exists, but cannot read or move what is
  // inside, and the host holds no page data.

  const CURSOR_CSS = `
    :host { all: initial; }
    .cursor {
      position: fixed;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      pointer-events: none;
      opacity: 0;
      transform: translate3d(-100px, -100px, 0);
      transition: transform 70ms linear, opacity 180ms ease;
      will-change: transform, opacity;
    }
    .cursor.visible { opacity: 1; }
    .cursor.jump { transition: opacity 180ms ease; }
    .arrow {
      position: absolute;
      left: -1px;
      top: -1px;
      width: 22px;
      height: 28px;
      overflow: visible;
      filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.35)) drop-shadow(0 3px 6px rgba(0, 0, 0, 0.18));
    }
    .arrow path {
      fill: #ffffff;
      stroke: #15201b;
      stroke-width: 1.5;
      stroke-linejoin: round;
    }
    .label {
      position: absolute;
      left: 16px;
      top: 22px;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px 2px 5px;
      border-radius: 999px;
      background: #3cde95;
      color: #072619;
      font: 600 11px/1.3 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      white-space: nowrap;
      box-shadow: 0 1px 2px rgba(7, 38, 25, 0.3);
    }
    .label::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #0b5a3f;
    }
    .ripple {
      position: absolute;
      left: -18px;
      top: -18px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 2px solid #12a26b;
      background: rgba(60, 222, 149, 0.25);
      opacity: 0;
      transform: scale(0.2);
    }
    @media (prefers-reduced-motion: reduce) {
      .cursor { transition: opacity 180ms ease; }
    }
  `;

  let cursorHost = null;
  let cursorShadow = null;
  let cursorEl = null;
  let cursorLabel = null;
  let cursorRipple = null;
  let cursorVisible = false;
  let cursorIdleTimer = null;

  let pointerPending = null;
  let pointerRafPending = false;
  let lastPointerSentAt = 0;
  let pointerActiveSent = false;

  function cursorFeatureOn() {
    return Boolean(uiState.enabled && uiState.showCursor);
  }

  function teardownCursorHost() {
    if (cursorIdleTimer) clearTimeout(cursorIdleTimer);
    cursorIdleTimer = null;
    if (cursorHost) cursorHost.remove();
    cursorHost = null;
    cursorShadow = null;
    cursorEl = null;
    cursorLabel = null;
    cursorRipple = null;
    cursorVisible = false;
  }

  function ensureCursorLayer() {
    if (cursorHost && cursorShadow && cursorEl && cursorHost.isConnected && cursorHost.parentNode === document.documentElement) {
      removeForeignNodes([CURSOR_HOST_ID], cursorHost);
      return cursorEl;
    }

    teardownCursorHost();
    removeForeignNodes([CURSOR_HOST_ID], null);
    if (!document.documentElement) return null;

    cursorHost = document.createElement('div');
    cursorHost.id = CURSOR_HOST_ID;
    const declarations = {
      display: 'block', visibility: 'visible', opacity: '1', filter: 'none', transform: 'none',
      'clip-path': 'none', mask: 'none', position: 'fixed', top: '0', left: '0', width: '0', height: '0',
      margin: '0', padding: '0', border: '0', overflow: 'visible', 'pointer-events': 'none',
      'z-index': '2147483647'
    };
    for (const [property, value] of Object.entries(declarations)) cursorHost.style.setProperty(property, value, 'important');
    cursorHost.setAttribute('aria-hidden', 'true');
    document.documentElement.appendChild(cursorHost);
    cursorShadow = cursorHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = CURSOR_CSS;

    cursorEl = document.createElement('div');
    cursorEl.className = 'cursor jump';

    cursorRipple = document.createElement('div');
    cursorRipple.className = 'ripple';

    // Classic arrow pointer, tip at (1, 1).
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'arrow');
    svg.setAttribute('viewBox', '0 0 22 28');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M1.5 1.5v20.2l5.1-4.9 3.4 7.9 3.6-1.5-3.4-7.8h7.1z');
    svg.appendChild(path);

    cursorLabel = document.createElement('span');
    cursorLabel.className = 'label';

    cursorEl.appendChild(cursorRipple);
    cursorEl.appendChild(svg);
    cursorEl.appendChild(cursorLabel);
    cursorShadow.appendChild(style);
    cursorShadow.appendChild(cursorEl);
    return cursorEl;
  }

  function hideCursor() {
    if (cursorIdleTimer) clearTimeout(cursorIdleTimer);
    cursorIdleTimer = null;
    cursorVisible = false;
    if (cursorEl) cursorEl.classList.remove('visible');
  }

  function playCursorRipple() {
    if (!cursorRipple || typeof cursorRipple.animate !== 'function') return;
    try {
      cursorRipple.animate([
        { opacity: 0.9, transform: 'scale(0.2)' },
        { opacity: 0, transform: 'scale(1.4)' }
      ], { duration: 450, easing: 'ease-out' });
    } catch (_error) {
      // purely visual
    }
  }

  function applyRemotePointer(pointer) {
    if (!cursorFeatureOn() || !pointer || typeof pointer !== 'object') {
      hideCursor();
      return;
    }
    if (pointer.kind === 'leave') {
      hideCursor();
      return;
    }

    const el = ensureCursorLayer();
    if (!el) return;

    // The label names the side where the real mouse is (the other pane).
    const sourceSide = uiState.side === 'left' ? 'right' : (uiState.side === 'right' ? 'left' : null);
    const labelText = sourceSide ? t(sourceSide === 'left' ? 'colLeft' : 'colRight', '') : '';
    if (cursorLabel.textContent !== labelText) cursorLabel.textContent = labelText;
    cursorLabel.style.display = labelText ? '' : 'none';

    const { x, y } = mirroredPointToLocal(pointer);
    // Coming back from hidden: jump to the new spot instead of gliding there.
    const jump = !cursorVisible;
    el.classList.toggle('jump', jump);
    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    if (jump) {
      // Force the jump to apply before re-enabling the transition.
      void el.offsetWidth;
      requestAnimationFrame(() => { if (cursorEl === el) el.classList.remove('jump'); });
    }
    el.classList.add('visible');
    cursorVisible = true;

    if (pointer.kind === 'down') playCursorRipple();

    if (cursorIdleTimer) clearTimeout(cursorIdleTimer);
    cursorIdleTimer = setTimeout(hideCursor, CURSOR_IDLE_HIDE_MS);
  }

  function reconcileCursorFeatureState() {
    if (!cursorFeatureOn()) {
      teardownCursorHost();
      pointerPending = null;
      pointerActiveSent = false;
    }
  }

  function sendPointer(kind, clientX, clientY) {
    pointerActiveSent = kind !== 'leave';
    lastPointerSentAt = performance.now();
    sendRuntimeMessage({
      type: MSG.POINTER,
      pointer: {
        kind,
        clientX,
        clientY,
        vw: window.innerWidth || 0,
        vh: window.innerHeight || 0
      }
    });
  }

  function flushPointerSend() {
    pointerRafPending = false;
    if (!cursorFeatureOn() || !pointerPending) return;
    if (performance.now() - lastPointerSentAt < POINTER_MIN_INTERVAL_MS) {
      pointerRafPending = true;
      requestAnimationFrame(flushPointerSend);
      return;
    }
    const { x, y } = pointerPending;
    pointerPending = null;
    sendPointer('move', x, y);
  }

  function handleCursorPointerMove(event) {
    if (!cursorFeatureOn() || !event.isTrusted) return;
    if (event.pointerType === 'touch') return;
    // The real mouse is here now; a virtual one in this pane would only confuse.
    if (cursorVisible) hideCursor();
    if (isInsideExtensionUi(event) || isInsideRulerUi(event)) {
      sendPointerLeave();
      return;
    }
    pointerPending = { x: Number(event.clientX) || 0, y: Number(event.clientY) || 0 };
    if (pointerRafPending) return;
    pointerRafPending = true;
    requestAnimationFrame(flushPointerSend);
  }

  // A real click shows a short ripple on the other side; purely visual, so
  // it is sent even when click mirroring is off.
  function handleCursorPointerDown(event) {
    if (!cursorFeatureOn() || !event.isTrusted) return;
    if (event.pointerType === 'touch') return;
    if (event.button !== undefined && event.button !== 0) return;
    if (isInsideExtensionUi(event) || isInsideRulerUi(event)) return;
    pointerPending = null;
    sendPointer('down', Number(event.clientX) || 0, Number(event.clientY) || 0);
  }

  function sendPointerLeave() {
    pointerPending = null;
    if (!pointerActiveSent || !cursorFeatureOn()) {
      pointerActiveSent = false;
      return;
    }
    sendPointer('leave', 0, 0);
  }

  function handlePointerExit() {
    sendHoverClear();
    sendPointerLeave();
  }

  async function requestSplitStatus() {
    const response = await sendRuntimeMessage({ type: MSG.GET_SPLIT_STATUS, timestamp: Date.now() });

    if (response?.state) {
      if (acceptStateRev(response.state)) {
        uiState = { ...uiState, ...response.state };
        updateUi();
      }
      return Boolean(uiState.show);
    }

    // No answer. Only fall back to "hidden" when no state was received yet;
    // a state that did arrive is newer than this failed request.
    if (lastStateRev === 0) {
      uiState = { ...uiState, show: false, enabled: false, wpAdminBarHidden: false };
      updateUi();
    }
    return false;
  }

  function acceptStateRev(state) {
    const rev = Number(state?.rev) || 0;
    if (rev && rev < lastStateRev) return false;
    if (rev) lastStateRev = rev;
    return true;
  }

  async function sendReady() {
    const { scrollX, scrollY } = readScrollPosition();
    await sendRuntimeMessage({ type: MSG.READY, scrollX, scrollY, url: location.href, timestamp: Date.now() });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only the extension's own service worker talks to this script.
    if (!sender || sender.id !== chrome.runtime.id || sender.tab) {
      sendResponse({ ok: false });
      return false;
    }

    if (!message || typeof message.type !== 'string') {
      sendResponse({ ok: false });
      return false;
    }

    if (message.type === MSG.PING) {
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.STATE) {
      if (!acceptStateRev(message.state)) {
        sendResponse({ ok: true, stale: true });
        return false;
      }
      uiState = { ...uiState, ...(message.state || {}) };
      if (Array.isArray(message.state?.rulers)) {
        rulers = sanitizeRulers(message.state.rulers);
        renderRulers();
      }
      updateUi();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.HIDE_FLOATING_UI) {
      if (!acceptStateRev(message.state)) {
        sendResponse({ ok: true, stale: true });
        return false;
      }
      uiState = { ...uiState, show: false, enabled: false, wpAdminBarHidden: false, mirrorClicks: false, mirrorHover: false, showCursor: false };
      rulers = [];
      renderRulers();
      updateUi();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.GET_SCROLL) {
      const anchor = message.withAnchor ? buildScrollAnchor() : null;
      sendResponse({ ok: true, ...readScrollPosition(), anchor });
      return false;
    }

    if (message.type === MSG.REMOTE_SCROLL) {
      applyRemoteScroll(message.targetScrollX, resolveAnchoredScrollY(message));
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.REMOTE_CONTAINER_SCROLL) {
      if (isForThisOrigin(message)) applyRemoteContainerScroll(message.container, message.alignMode);
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.REMOTE_CLICK) {
      if (isForThisOrigin(message)) applyRemoteClick(message.click);
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.REMOTE_HOVER) {
      if (isForThisOrigin(message)) applyRemoteHover(message.hover);
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.REMOTE_POINTER) {
      if (isForThisOrigin(message)) applyRemotePointer(message.pointer);
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.REMOTE_HOVER_CLEAR) {
      applyRemoteHoverClear();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.RULER_STATE) {
      rulers = sanitizeRulers(message.rulers);
      renderRulers();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.REMOTE_RULER_MOVE) {
      const ruler = rulers.find((r) => r.id === message.id);
      if (ruler) {
        ruler.y = Number(message.y) || 0;
        updateRulerPosition(message.id, ruler.y);
      }
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.REMOTE_RULER_SELECT) {
      peerSelectedRulerId = message.id || null;
      applyRulerColors();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.REMOTE_FOCUS) {
      if (isForThisOrigin(message)) applyRemoteFocus(message.focus);
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.TOAST) {
      showToast(typeof message.text === 'string' ? message.text.slice(0, 200) : '');
      sendResponse({ ok: true });
      return false;
    }

    sendResponse({ ok: false });
    return false;
  });

  document.addEventListener('pointerdown', (event) => {
    if (panelOpen && host && !isInsideExtensionUi(event)) {
      panelOpen = false;
      updatePanelOpenState();
    }
    if (selectedRulerId && !isInsideRulerUi(event) && !isDraggingRuler) {
      deselectRuler();
    }
  }, true);

  window.addEventListener('scroll', handleLocalScroll, { passive: true });
  document.addEventListener('scroll', handleContainerScroll, { capture: true, passive: true });
  window.addEventListener('wheel', trackAltFromPointer, { capture: true, passive: true });
  document.addEventListener('pointermove', trackAltFromPointer, { capture: true, passive: true });
  document.addEventListener('pointerdown', trackAltFromPointer, { capture: true, passive: true });
  window.addEventListener('keydown', trackAltFromKey, true);
  window.addEventListener('keyup', trackAltFromKey, true);
  window.addEventListener('blur', () => setAltDecoupled(false), true);
  document.addEventListener('click', handleLocalClick, true);
  document.addEventListener('focusin', handleLocalFocusIn, true);
  document.addEventListener('pointermove', handleLocalPointerMove, true);
  document.addEventListener('pointermove', handleCursorPointerMove, true);
  document.addEventListener('pointerdown', handleCursorPointerDown, true);
  document.addEventListener('pointerleave', handlePointerExit, true);
  window.addEventListener('blur', handlePointerExit, true);
  window.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget && !event.toElement) handlePointerExit();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handlePointerExit();
  });
  window.addEventListener('pagehide', handlePointerExit, true);

  window.addEventListener('pageshow', () => {
    requestSplitStatus();
    sendReady();
    reportNavigationIfChanged();
  }, { once: false });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      requestSplitStatus();
      sendReady();
      reportNavigationIfChanged();
    }
  });

  async function init() {
    setupNavigationWatcher();
    await requestSplitStatus();
    await sendReady();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
