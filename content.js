'use strict';

(() => {
  if (window.__SVSS_CONTENT_LOADED__) return;
  window.__SVSS_CONTENT_LOADED__ = true;

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
    REMOTE_HOVER_CLEAR: 'SVSS_REMOTE_HOVER_CLEAR'
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
    SET_HOVER_MIRRORING: 'SET_HOVER_MIRRORING'
  });

  const HOST_ID = 'svss-root';
  const WP_STYLE_ID = 'splitview-scroll-sync-wp-adminbar-hide';
  const FORCE_HOVER_STYLE_ID = 'splitview-scroll-sync-force-hover';
  const FORCE_HOVER_CLASS = 'svss-force-hover';
  const PANEL_CLOSE_DELAY_MS = 500;
  const REMOTE_SUPPRESS_MS = 80;
  const REMOTE_CLICK_SUPPRESS_MS = 500;
  const REMOTE_HOVER_SUPPRESS_MS = 120;
  const MAX_FORCE_HOVER_RULES = 20000;

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
    wpAdminBarHidden: false,
    side: 'unknown',
    reloading: false
  };

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

  function getStatusColor(colorName) {
    switch (colorName) {
      case 'green': return '#3cde95';
      case 'orange': return '#f59f00';
      case 'red': return '#e03131';
      case 'gray':
      default: return '#8a8a8a';
    }
  }

  function getSyncStatusLabel() {
    if (uiState.color === 'red') return 'Error';
    return uiState.enabled ? 'Sync active' : 'Sync off';
  }

  function formatSignedPx(value) {
    const number = Number(value || 0);
    if (number > 0) return `+${number}px`;
    return `${number}px`;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
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

  function createButton(label, command, extraClass = '', payloadFactory = null) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `svss-btn ${extraClass}`.trim();
    button.textContent = label;
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const payload = typeof payloadFactory === 'function' ? payloadFactory() : {};
      await sendRuntimeMessage({ type: MSG.COMMAND, command, ...payload });
    });
    return button;
  }

  function createSection(titleText) {
    const section = document.createElement('section');
    section.className = 'svss-section';

    const title = document.createElement('div');
    title.className = 'svss-section-title';
    title.textContent = titleText;
    section.appendChild(title);

    return section;
  }

  function createToggle(label, checked, command) {
    const toggle = document.createElement('label');
    toggle.className = 'svss-toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(checked);
    input.addEventListener('change', async (event) => {
      event.stopPropagation();
      await sendRuntimeMessage({ type: MSG.COMMAND, command, value: input.checked });
    });

    const switchEl = document.createElement('span');
    switchEl.className = 'svss-switch';

    const text = document.createElement('span');
    text.className = 'svss-toggle-text';
    text.textContent = label;

    toggle.appendChild(input);
    toggle.appendChild(switchEl);
    toggle.appendChild(text);
    return toggle;
  }

  function renderPanelContents() {
    if (!panel) return;
    panel.textContent = '';

    const header = document.createElement('div');
    header.className = 'svss-header';

    const title = document.createElement('div');
    title.className = 'svss-title';
    title.textContent = 'SplitScreen Browser Sync';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'svss-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close popup');
    close.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      panelOpen = false;
      updatePanelOpenState();
    });

    header.appendChild(title);
    header.appendChild(close);
    panel.appendChild(header);

    const syncSection = createSection('Sync');
    const syncGrid = document.createElement('div');
    syncGrid.className = 'svss-grid svss-sync-grid';

    const startSync = createButton('Start sync', CMD.SYNC_CURRENT, 'outline-green');
    startSync.classList.toggle('is-active', Boolean(uiState.enabled));
    syncGrid.appendChild(startSync);
    syncGrid.appendChild(createButton('Stop sync', CMD.STOP_CURRENT));
    syncGrid.appendChild(createButton('Sync all', CMD.SYNC_ALL));
    syncSection.appendChild(syncGrid);
    panel.appendChild(syncSection);

    const reloadSection = createSection('Reload');
    const reloadGrid = document.createElement('div');
    reloadGrid.className = 'svss-reload-grid';
    reloadGrid.appendChild(createButton('Reload left', CMD.RELOAD_LEFT));
    reloadGrid.appendChild(createButton('Reload right', CMD.RELOAD_RIGHT));
    reloadGrid.appendChild(createButton('Hard reload left', CMD.HARD_RELOAD_LEFT));
    reloadGrid.appendChild(createButton('Hard reload right', CMD.HARD_RELOAD_RIGHT));
    reloadSection.appendChild(reloadGrid);
    panel.appendChild(reloadSection);

    const offsetSection = createSection('Offset');
    const offsetRow = document.createElement('div');
    offsetRow.className = 'svss-offset-row';

    const fieldWrap = document.createElement('label');
    fieldWrap.className = 'svss-field svss-offset-field';

    const yInput = document.createElement('input');
    yInput.type = 'number';
    yInput.step = '1';
    yInput.placeholder = '0';
    yInput.value = String(Number(uiState.offsetY || 0));
    yInput.inputMode = 'numeric';
    yInput.setAttribute('aria-label', 'Offset Y in pixels');

    const suffix = document.createElement('span');
    suffix.className = 'svss-input-suffix';
    suffix.textContent = 'px';

    fieldWrap.appendChild(yInput);
    fieldWrap.appendChild(suffix);

    const current = document.createElement('div');
    current.className = 'svss-current-offset';
    current.textContent = `Current: ${formatSignedPx(uiState.offsetY)}`;

    offsetRow.appendChild(fieldWrap);
    offsetRow.appendChild(current);
    offsetSection.appendChild(offsetRow);

    const offsetActions = document.createElement('div');
    offsetActions.className = 'svss-offset-actions';
    offsetActions.appendChild(createButton('Apply', CMD.SET_OFFSET, 'outline-green', () => ({
      offsetY: parseInt(yInput.value || '0', 10) || 0
    })));
    offsetActions.appendChild(createButton('Reset', CMD.OFFSET_RESET));
    offsetSection.appendChild(offsetActions);
    panel.appendChild(offsetSection);

    const optionsSection = createSection('Options');
    optionsSection.appendChild(createToggle('Hide WordPress admin bar', uiState.hideWpAdminBar, CMD.SET_WP_ADMIN_BAR));
    optionsSection.appendChild(createToggle('Sync navigation', uiState.syncNavigation, CMD.SET_NAVIGATION_SYNC));
    optionsSection.appendChild(createToggle('Mirror clicks', uiState.mirrorClicks, CMD.SET_CLICK_MIRRORING));
    optionsSection.appendChild(createToggle('Mirror hover effects', uiState.mirrorHover, CMD.SET_HOVER_MIRRORING));

    const swap = document.createElement('div');
    swap.className = 'svss-secondary-row';
    swap.appendChild(createButton('Swap left/right', CMD.SWAP_SIDES, 'secondary'));
    optionsSection.appendChild(swap);
    panel.appendChild(optionsSection);
  }

  function ensureUi() {
    if (host && shadow) return;

    host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      host.setAttribute('aria-hidden', 'false');
      (document.documentElement || document.body).appendChild(host);
    }

    shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    shadow.textContent = '';

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        position: fixed;
        bottom: 18px;
        left: 18px;
        z-index: 2147483647;
        font-family: "Roboto Flex", Roboto, Arial, sans-serif;
        color: #161616;
      }

      *, *::before, *::after {
        box-sizing: border-box;
        font-family: "Roboto Flex", Roboto, Arial, sans-serif;
      }

      .svss-wrap {
        position: fixed;
        bottom: 18px;
        left: 18px;
        z-index: 2147483647;
        width: 42px;
        min-height: 42px;
        pointer-events: none;
      }

      .svss-bubble {
        appearance: none;
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        padding: 0;
        border: none;
        border-radius: 12px;
        overflow: hidden;
        background: linear-gradient(135deg, #3cde95 0%, #3cbede 100%);
        color: #fff;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
        cursor: pointer;
        pointer-events: auto;
        transition: transform 120ms ease, box-shadow 120ms ease;
      }

      .svss-bubble:hover,
      .svss-bubble:focus-visible,
      .svss-bubble[aria-expanded="true"] {
        transform: translateY(-1px) scale(1.04);
        outline: none;
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.30);
      }

      .svss-bubble:focus-visible {
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.30), 0 0 0 2px rgba(60, 222, 149, 0.9);
      }

      .svss-icon {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        font-size: 22px;
        line-height: 1;
        color: #fff;
      }

      .svss-icon img {
        width: 100%;
        height: 100%;
        display: block;
        object-fit: cover;
      }

      .svss-status-dot {
        position: absolute;
        right: 3px;
        bottom: 3px;
        width: 12px;
        height: 12px;
        border: 2px solid rgba(255, 255, 255, 0.95);
        border-radius: 999px;
        background: var(--svss-status-color, #8a8a8a);
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.18);
      }

      .svss-bridge {
        position: absolute;
        left: 0;
        bottom: 44px;
        width: 160px;
        height: 16px;
        display: none;
        pointer-events: auto;
      }

      .svss-bridge.open { display: block; }

      .svss-panel {
        position: absolute;
        bottom: 56px;
        left: 0;
        width: 300px;
        max-width: calc(100vw - 36px);
        max-height: calc(100vh - 92px);
        overflow: auto;
        padding: 12px;
        border: 1px solid rgba(0, 0, 0, 0.10);
        border-radius: 14px;
        background: rgba(250, 250, 250, 0.98);
        color: #161616;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.22);
        pointer-events: auto;
        display: none;
        backdrop-filter: blur(12px) saturate(145%);
        -webkit-backdrop-filter: blur(12px) saturate(145%);
      }

      .svss-panel.open { display: block; }

      .svss-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 9px;
      }

      .svss-title {
        margin: 0;
        font-size: 13px;
        line-height: 1.25;
        font-weight: 760;
      }

      .svss-subtitle {
        margin-top: 2px;
        font-size: 11px;
        line-height: 1.3;
        color: #686868;
      }

      .svss-close {
        appearance: none;
        width: 24px;
        height: 24px;
        border: 1px solid rgba(0, 0, 0, 0.10);
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.035);
        color: #333;
        cursor: pointer;
        font: inherit;
        font-size: 18px;
        line-height: 20px;
        padding: 0 0 2px;
      }

      .svss-close:hover,
      .svss-close:focus-visible {
        background: rgba(0, 0, 0, 0.08);
        outline: none;
      }

      .svss-summary {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
        margin-bottom: 10px;
      }

      .svss-summary span {
        min-width: 0;
        padding: 6px 7px;
        border: 1px solid rgba(0, 0, 0, 0.07);
        border-radius: 9px;
        background: rgba(0, 0, 0, 0.025);
        color: #343434;
        font-size: 10.5px;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .svss-section {
        padding-top: 9px;
        margin-top: 9px;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
      }

      .svss-section-title {
        display: block;
        margin-bottom: 6px;
        color: #666;
        font-size: 10px;
        line-height: 1.2;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.045em;
      }

      .svss-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 6px;
      }

      .svss-reload-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }

      .svss-btn {
        appearance: none;
        min-height: 30px;
        padding: 7px 8px;
        border: 1px solid rgba(0, 0, 0, 0.10);
        border-radius: 9px;
        background: #f4f4f4;
        color: #171717;
        cursor: pointer;
        font: inherit;
        font-size: 11px;
        line-height: 1.18;
        text-align: center;
        transition: background 120ms ease, border-color 120ms ease, transform 80ms ease;
      }

      .svss-btn:hover,
      .svss-btn:focus-visible {
        background: #ececec;
        border-color: rgba(0, 0, 0, 0.18);
        outline: none;
      }

      .svss-btn:active { transform: translateY(1px); }

      .svss-btn.outline-green {
        border-color: rgba(60, 222, 149, 0.72);
        background: transparent;
        color: #0e7a4e;
      }

      .svss-btn.outline-green:hover,
      .svss-btn.outline-green:focus-visible {
        background: rgba(60, 222, 149, 0.10);
        border-color: rgba(60, 222, 149, 0.88);
      }

      .svss-btn.outline-green.is-active {
        border-color: rgba(60, 222, 149, 0.88);
        background: #3cde95;
        color: #063b27;
        font-weight: 600;
      }

      .svss-btn.outline-green.is-active:hover,
      .svss-btn.outline-green.is-active:focus-visible {
        background: #2bbd80;
      }

      .svss-btn.secondary {
        width: 100%;
        margin-top: 2px;
        background: rgba(0, 0, 0, 0.025);
      }

      .svss-offset-row {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: end;
        gap: 8px;
      }

      .svss-current-offset {
        padding-bottom: 8px;
        color: #777;
        font-size: 11px;
        white-space: nowrap;
      }

      .svss-field {
        position: relative;
        display: block;
      }

      .svss-field input {
        width: 100%;
        height: 32px;
        padding: 6px 30px 6px 8px;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 9px;
        background: #fff;
        color: #161616;
        font: inherit;
        font-size: 12px;
        line-height: 1;
      }

      .svss-field input:focus {
        border-color: rgba(60, 222, 149, 0.55);
        outline: 2px solid rgba(60, 222, 149, 0.13);
      }

      .svss-input-suffix {
        position: absolute;
        right: 9px;
        top: 50%;
        transform: translateY(-50%);
        color: #777;
        font-size: 11px;
        line-height: 1;
        pointer-events: none;
      }

      .svss-offset-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        margin-top: 7px;
      }

      .svss-toggle {
        display: grid;
        grid-template-columns: auto auto 1fr;
        align-items: center;
        gap: 7px;
        min-height: 26px;
        color: #262626;
        cursor: pointer;
        font-size: 11px;
        line-height: 1.35;
      }

      .svss-toggle + .svss-toggle { margin-top: 6px; }

      .svss-toggle input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }

      .svss-switch {
        position: relative;
        width: 30px;
        height: 17px;
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.12);
        transition: background 120ms ease, border-color 120ms ease;
      }

      .svss-switch::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 11px;
        height: 11px;
        border-radius: 999px;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.20);
        transition: transform 120ms ease;
      }

      .svss-toggle input:checked + .svss-switch {
        border-color: rgba(60, 222, 149, 0.34);
        background: rgba(60, 222, 149, 0.58);
      }

      .svss-toggle input:checked + .svss-switch::after { transform: translateX(13px); }

      .svss-secondary-row { margin-top: 8px; }

      @media (prefers-color-scheme: dark) {
        .svss-panel {
          border-color: rgba(255, 255, 255, 0.14);
          background: rgba(25, 28, 34, 0.98);
          color: #f2f2f2;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.42);
        }

        .svss-subtitle,
        .svss-section-title,
        .svss-input-suffix,
        .svss-current-offset { color: #aaa; }

        .svss-summary span {
          border-color: rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.045);
          color: #ededed;
        }

        .svss-section { border-top-color: rgba(255, 255, 255, 0.10); }

        .svss-btn,
        .svss-close,
        .svss-field input {
          border-color: rgba(255, 255, 255, 0.11);
          background: rgba(255, 255, 255, 0.075);
          color: #f2f2f2;
        }

        .svss-btn:hover,
        .svss-btn:focus-visible,
        .svss-close:hover,
        .svss-close:focus-visible { background: rgba(255, 255, 255, 0.12); }

        .svss-field input:focus {
          border-color: rgba(60, 222, 149, 0.62);
          outline-color: rgba(60, 222, 149, 0.18);
        }

        .svss-btn.outline-green {
          border-color: rgba(60, 222, 149, 0.78);
          background: transparent;
          color: #5fe3a6;
        }

        .svss-btn.outline-green:hover,
        .svss-btn.outline-green:focus-visible {
          background: rgba(60, 222, 149, 0.12);
          border-color: rgba(60, 222, 149, 0.92);
        }

        .svss-btn.outline-green.is-active {
          border-color: rgba(60, 222, 149, 0.92);
          background: #3cde95;
          color: #063b27;
          font-weight: 600;
        }

        .svss-btn.outline-green.is-active:hover,
        .svss-btn.outline-green.is-active:focus-visible {
          background: #2bbd80;
        }
        .svss-toggle { color: #f2f2f2; }
        .svss-switch { border-color: rgba(255, 255, 255, 0.18); background: rgba(255, 255, 255, 0.12); }
      }
    `;

    wrap = document.createElement('div');
    wrap.className = 'svss-wrap';

    bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.className = 'svss-bubble';
    bubble.title = 'SplitScreen Browser Sync';
    bubble.setAttribute('aria-label', 'Open SplitScreen Browser Sync controls');
    bubble.setAttribute('aria-haspopup', 'dialog');
    bubble.setAttribute('aria-expanded', 'false');

    const icon = document.createElement('span');
    icon.className = 'svss-icon';

    try {
      const image = document.createElement('img');
      image.src = chrome.runtime.getURL('icons/icon.svg');
      image.alt = '';
      image.addEventListener('error', () => {
        icon.textContent = '↕';
      }, { once: true });
      icon.appendChild(image);
    } catch (_error) {
      icon.textContent = '↕';
    }

    const dot = document.createElement('span');
    dot.className = 'svss-status-dot';

    bubble.appendChild(icon);
    bubble.appendChild(dot);

    bridge = document.createElement('div');
    bridge.className = 'svss-bridge';

    panel = document.createElement('div');
    panel.className = 'svss-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'SplitScreen Browser Sync controls');

    bubble.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearCloseTimer();
      panelOpen = !panelOpen;
      updatePanelOpenState();
    });

    bubble.addEventListener('pointerenter', () => {
      isPointerOverBubble = true;
      openPanel();
    });

    bubble.addEventListener('pointerleave', () => {
      isPointerOverBubble = false;
      schedulePanelClose();
    });

    panel.addEventListener('pointerenter', () => {
      isPointerOverPanel = true;
      openPanel();
    });

    panel.addEventListener('pointerleave', () => {
      isPointerOverPanel = false;
      schedulePanelClose();
    });

    bridge.addEventListener('pointerenter', () => {
      isPointerOverPanel = true;
      openPanel();
    });

    bridge.addEventListener('pointerleave', () => {
      isPointerOverPanel = false;
      schedulePanelClose();
    });

    wrap.appendChild(bubble);
    wrap.appendChild(bridge);
    wrap.appendChild(panel);
    shadow.appendChild(style);
    shadow.appendChild(wrap);
  }

  function updateUi() {
    reconcileHoverFeatureState();

    if (!uiState.show) {
      hideFloatingUi();
      setWpAdminBarHidden(Boolean(uiState.wpAdminBarHidden));
      return;
    }

    ensureUi();
    host.style.display = 'block';
    host.style.setProperty('--svss-status-color', getStatusColor(uiState.color));
    bubble.title = uiState.statusText || 'SplitScreen Browser Sync';
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

  function handleLocalScroll() {
    const now = performance.now();
    if (isApplyingRemoteScroll || now < suppressScrollUntil) return;
    if (scrollRafPending) return;

    scrollRafPending = true;
    requestAnimationFrame(async () => {
      scrollRafPending = false;
      if (isApplyingRemoteScroll || performance.now() < suppressScrollUntil) return;

      const { scrollX, scrollY } = readScrollPosition();
      if (scrollX === lastSentScrollX && scrollY === lastSentScrollY) return;

      lastSentScrollX = scrollX;
      lastSentScrollY = scrollY;

      await sendRuntimeMessage({ type: MSG.SCROLL, scrollX, scrollY, timestamp: Date.now() });
    });
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
      if (!/^https?:\/\//i.test(href)) return;
      await sendRuntimeMessage({ type: MSG.NAVIGATED, url: href, timestamp: Date.now() });
    });
  }

  function patchHistoryMethod(methodName) {
    const original = history[methodName];
    if (typeof original !== 'function' || original.__svssPatched) return;

    const patched = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      reportNavigationIfChanged();
      return result;
    };
    patched.__svssPatched = true;
    history[methodName] = patched;
  }

  function setupNavigationWatcher() {
    patchHistoryMethod('pushState');
    patchHistoryMethod('replaceState');
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

    const text = normalizeText(element.innerText || element.textContent || element.value || ariaLabel || '');
    if (text && text.length <= 80) candidates.push({ type: 'text', tag, value: text, strong: false });

    const cssPath = createCssPath(element);
    if (cssPath) candidates.push({ type: 'css', value: cssPath, strong: false });

    return { tag, candidates: candidates.slice(0, 10), text };
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
        const text = normalizeText(element.innerText || element.textContent || element.value || (element.getAttribute && element.getAttribute('aria-label')) || '');
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

  // Clicks: prefer a strong descriptor match (robust to differing pane widths),
  // then fall back to the element under the mirrored coordinates (handles modal
  // backdrops, overlays and custom widgets), then weak hints.
  function resolveClickTarget(payload) {
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];

    const strong = firstDescriptorMatch(candidates, true);
    if (strong) return strong;

    const coordElement = elementAtMirroredPoint(payload);
    const weak = firstDescriptorMatch(candidates, false);

    if (coordElement) {
      if (weak && weak !== coordElement && !coordElement.contains(weak) && !weak.contains(coordElement)) {
        return weak;
      }
      return coordElement;
    }

    return weak;
  }

  // Hover: position is what matters, so the element under the mirrored point wins.
  function resolveHoverTarget(payload) {
    const coordElement = elementAtMirroredPoint(payload);
    if (coordElement) return coordElement;
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    return firstDescriptorMatch(candidates, true) || firstDescriptorMatch(candidates, false);
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

  // Replay a realistic pointer/mouse sequence, then trigger exactly one real
  // activation. The native .click() handles default actions (links, submit,
  // checkbox toggles) and only fires `click` once, so toggles never double-fire.
  function applyRemoteClick(payload) {
    if (!uiState.mirrorClicks) return;

    const pointElement = resolveClickTarget(payload);
    if (!pointElement) return;

    const activatable = getInteractiveElement(pointElement);
    const rect = pointElement.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    isApplyingRemoteClick = true;
    remoteClickSuppressUntil = performance.now() + REMOTE_CLICK_SUPPRESS_MS;

    try {
      fireSyntheticPointerEvent('pointerover', pointElement, x, y);
      fireSyntheticPointerEvent('mouseover', pointElement, x, y);
      fireSyntheticPointerEvent('pointerdown', pointElement, x, y);
      fireSyntheticPointerEvent('mousedown', pointElement, x, y);

      if (activatable && typeof activatable.focus === 'function') {
        try { activatable.focus({ preventScroll: true }); } catch (_error) {
          try { activatable.focus(); } catch (_secondError) {}
        }
      }

      fireSyntheticPointerEvent('pointerup', pointElement, x, y);
      fireSyntheticPointerEvent('mouseup', pointElement, x, y);

      if (activatable && typeof activatable.click === 'function') {
        activatable.click();
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
    if (!uiState.mirrorClicks) return;
    if (!event.isTrusted) return;            // synthetic / mirrored clicks are never trusted -> no echo loop
    if (event.button !== undefined && event.button !== 0) return; // primary button only
    if (isApplyingRemoteClick || performance.now() < remoteClickSuppressUntil) return;
    if (isInsideExtensionUi(event)) return;

    const point = getEventCoordinates(event);
    const target = event.target instanceof Element ? event.target : null;
    const descriptor = buildElementDescriptor(target);

    sendRuntimeMessage({
      type: MSG.CLICK,
      click: { ...descriptor, ...point },
      timestamp: Date.now()
    });
  }

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
    if (!uiState.mirrorHover) return;
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
    if (!uiState.mirrorHover) {
      clearForcedHover();
      teardownForceHoverStyle();
      lastHoverEl = null;
      pendingHoverEl = null;
      hoverActiveSent = false;
    }
  }

  function flushHoverSend() {
    hoverSendRafPending = false;
    if (!uiState.mirrorHover) return;
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
    if (!uiState.mirrorHover) return;
    if (!event.isTrusted) return;            // ignore our own synthetic moves
    if (isApplyingRemoteHover) return;
    if (isInsideExtensionUi(event)) {
      sendHoverClear();
      return;
    }

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

  async function requestSplitStatus() {
    const response = await sendRuntimeMessage({ type: MSG.GET_SPLIT_STATUS, timestamp: Date.now() });

    if (response?.state) {
      uiState = { ...uiState, ...response.state };
      updateUi();
      return Boolean(response.state.show);
    }

    uiState = { ...uiState, show: false, enabled: false, wpAdminBarHidden: false };
    updateUi();
    return false;
  }

  async function sendReady() {
    const { scrollX, scrollY } = readScrollPosition();
    await sendRuntimeMessage({ type: MSG.READY, scrollX, scrollY, url: location.href, timestamp: Date.now() });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') {
      sendResponse({ ok: false });
      return false;
    }

    if (message.type === MSG.PING) {
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.STATE) {
      uiState = { ...uiState, ...(message.state || {}) };
      updateUi();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.HIDE_FLOATING_UI) {
      uiState = { ...uiState, show: false, enabled: false, wpAdminBarHidden: false, mirrorClicks: false, mirrorHover: false };
      updateUi();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.GET_SCROLL) {
      sendResponse({ ok: true, ...readScrollPosition() });
      return false;
    }

    if (message.type === MSG.REMOTE_SCROLL) {
      applyRemoteScroll(message.targetScrollX, message.targetScrollY);
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.REMOTE_CLICK) {
      applyRemoteClick(message.click);
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.REMOTE_HOVER) {
      applyRemoteHover(message.hover);
      sendResponse({ ok: true });
      return false;
    }

    if (message.type === MSG.REMOTE_HOVER_CLEAR) {
      applyRemoteHoverClear();
      sendResponse({ ok: true });
      return false;
    }

    sendResponse({ ok: false });
    return false;
  });

  document.addEventListener('pointerdown', (event) => {
    if (!panelOpen || !host) return;
    if (isInsideExtensionUi(event)) return;
    panelOpen = false;
    updatePanelOpenState();
  }, true);

  window.addEventListener('scroll', handleLocalScroll, { passive: true });
  document.addEventListener('click', handleLocalClick, true);
  document.addEventListener('pointermove', handleLocalPointerMove, true);
  document.addEventListener('pointerleave', sendHoverClear, true);
  window.addEventListener('blur', sendHoverClear, true);
  window.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget && !event.toElement) sendHoverClear();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sendHoverClear();
  });

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
