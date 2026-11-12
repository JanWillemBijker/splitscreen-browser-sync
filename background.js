'use strict';

const DEBUG = false;
const SESSION_KEY = 'splitViewScrollSyncState';
const LOCAL_SETTINGS_KEY = 'splitViewScrollSyncSettings';
const SPLIT_NONE = chrome.tabs.SPLIT_VIEW_ID_NONE ?? -1;
const DEFAULT_HIDE_WP_ADMIN_BAR = true;
// Navigation and hover are only mirrored between the two origins the user
// started sync for (origin pinning). Click mirroring can trigger actions on the
// other site and is therefore opt-in.
const DEFAULT_SYNC_NAVIGATION = true;
const DEFAULT_MIRROR_CLICKS = false;
const DEFAULT_MIRROR_HOVER = true;
// Showing a virtual mouse cursor in the other pane only draws a pointer there;
// it never triggers anything on the page, so it is on by default.
const DEFAULT_SHOW_CURSOR = true;
const PAUSE_ORIGIN_CHANGED = 'origin-changed';

// Per-pair options added after 1.1.0, each with its default for new pairs:
// [group field, settings field holding the default, built-in default,
//  on-page panel command]. They share the plumbing below (settings, pair
// defaults, UI state, popup whitelist, panel commands).
const EXTRA_BOOL_OPTIONS = Object.freeze([
  // Scroll inside scroll containers (overflow areas, modals, side panels).
  ['syncContainers', 'defaultSyncContainers', true, 'SET_CONTAINER_SYNC'],
  // Browser zoom level of both panes.
  ['syncZoom', 'defaultSyncZoom', true, 'SET_ZOOM_SYNC'],
  // Typing and form changes. Off by default: what the user types reaches the
  // other site.
  ['syncInput', 'defaultSyncInput', false, 'SET_INPUT_SYNC']
]);

// Per-pair options with a fixed set of values.
const CHOICE_OPTIONS = Object.freeze({
  // How the other pane is aligned: 'pixel' copies the scroll position,
  // 'element' aligns on the top-most visible matching element (falls back to
  // the scroll percentage when no element matches).
  alignMode: { setting: 'defaultAlignMode', values: ['pixel', 'element'], fallback: 'pixel', command: 'SET_ALIGN_MODE' }
});

function choiceOr(name, value) {
  const spec = CHOICE_OPTIONS[name];
  return spec.values.includes(value) ? value : spec.fallback;
}
const DEFAULT_ALWAYS_SHOW_BUTTON = true;
const SAVE_DEBOUNCE_MS = 150;
const NAVIGATION_LOCK_MS = 1500;
// A pane marked "reloading" is re-checked after these delays (ms since the
// mark). The last check clears the mark even if Chrome still reports
// "loading" (a page that never finishes must not block the status forever).
const RELOADING_RECHECK_DELAYS = [1200, 3500, 8000, 20000];

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
  POPUP_GET_STATUS: 'SVSS_POPUP_GET_STATUS',
  POPUP_SET_ALWAYS_SHOW: 'SVSS_POPUP_SET_ALWAYS_SHOW',
  POPUP_SET_DEFAULTS: 'SVSS_POPUP_SET_DEFAULTS',
  POPUP_SHOW_BUTTON_CURRENT: 'SVSS_POPUP_SHOW_BUTTON_CURRENT',
  POPUP_SET_SYNC: 'SVSS_POPUP_SET_SYNC',
  POPUP_SET_GROUP_OPTION: 'SVSS_POPUP_SET_GROUP_OPTION',
  POPUP_SET_GROUP_CHOICE: 'SVSS_POPUP_SET_GROUP_CHOICE',
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
  REMOTE_CONTAINER_SCROLL: 'SVSS_REMOTE_CONTAINER_SCROLL',
  FIELD_INPUT: 'SVSS_FIELD_INPUT',
  VIEWPORT: 'SVSS_VIEWPORT',
  GET_VIEWPORT: 'SVSS_GET_VIEWPORT',
  POPUP_SET_PANE_WIDTH: 'SVSS_POPUP_SET_PANE_WIDTH',
  POPUP_INSPECT_SET: 'SVSS_POPUP_INSPECT_SET',
  INSPECT_HOVER: 'SVSS_INSPECT_HOVER',
  REMOTE_INSPECT: 'SVSS_REMOTE_INSPECT',
  INSPECT_RESULT: 'SVSS_INSPECT_RESULT',
  INSPECT_CLEAR: 'SVSS_INSPECT_CLEAR',
  REMOTE_INSPECT_CLEAR: 'SVSS_REMOTE_INSPECT_CLEAR',
  POPUP_OVERLAY_SET: 'SVSS_POPUP_OVERLAY_SET',
  POPUP_OVERLAY_REFRESH: 'SVSS_POPUP_OVERLAY_REFRESH',
  OVERLAY_IMAGE: 'SVSS_OVERLAY_IMAGE',
  CAPTURE_HIDE_UI: 'SVSS_CAPTURE_HIDE_UI',
  CAPTURE_READY: 'SVSS_CAPTURE_READY',
  CAPTURE_RESTORE_UI: 'SVSS_CAPTURE_RESTORE_UI',
  POPUP_HISTORY_GET: 'SVSS_POPUP_HISTORY_GET',
  POPUP_HISTORY_OPEN: 'SVSS_POPUP_HISTORY_OPEN',
  POPUP_HISTORY_UPDATE: 'SVSS_POPUP_HISTORY_UPDATE',
  POPUP_HISTORY_DELETE: 'SVSS_POPUP_HISTORY_DELETE',
  POPUP_HISTORY_CLEAR: 'SVSS_POPUP_HISTORY_CLEAR',
  POPUP_SET_REMEMBER_PAIRS: 'SVSS_POPUP_SET_REMEMBER_PAIRS',
  POPUP_CHECKLIST_GET: 'SVSS_POPUP_CHECKLIST_GET',
  POPUP_CHECKLIST_ADD: 'SVSS_POPUP_CHECKLIST_ADD',
  POPUP_CHECKLIST_ADD_CURRENT: 'SVSS_POPUP_CHECKLIST_ADD_CURRENT',
  POPUP_CHECKLIST_UPDATE: 'SVSS_POPUP_CHECKLIST_UPDATE',
  POPUP_CHECKLIST_REMOVE: 'SVSS_POPUP_CHECKLIST_REMOVE',
  POPUP_CHECKLIST_CLEAR: 'SVSS_POPUP_CHECKLIST_CLEAR',
  POPUP_CHECKLIST_GO: 'SVSS_POPUP_CHECKLIST_GO',
  REMOTE_FIELD_INPUT: 'SVSS_REMOTE_FIELD_INPUT',
  POPUP_SUGGEST_DISMISS: 'SVSS_POPUP_SUGGEST_DISMISS',
  POPUP_SET_SUGGEST: 'SVSS_POPUP_SET_SUGGEST',
  POPUP_SUGGEST_RESET: 'SVSS_POPUP_SUGGEST_RESET'
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
  TOGGLE_WP_ADMIN_BAR: 'TOGGLE_WP_ADMIN_BAR',
  SET_WP_ADMIN_BAR: 'SET_WP_ADMIN_BAR',
  SET_NAVIGATION_SYNC: 'SET_NAVIGATION_SYNC',
  SET_CLICK_MIRRORING: 'SET_CLICK_MIRRORING',
  SET_HOVER_MIRRORING: 'SET_HOVER_MIRRORING',
  SET_SHOW_CURSOR: 'SET_SHOW_CURSOR',
  SET_ALIGN_MODE: 'SET_ALIGN_MODE',
  CHECKLIST_GO: 'CHECKLIST_GO',
  CHECKLIST_MARK: 'CHECKLIST_MARK',
  OVERLAY_SET: 'OVERLAY_SET',
  OVERLAY_REFRESH: 'OVERLAY_REFRESH',
  INSPECT_SET: 'INSPECT_SET',
  SUGGEST_DISMISS: 'SUGGEST_DISMISS'
});

// Panel commands that set one of EXTRA_BOOL_OPTIONS / CHOICE_OPTIONS.
const OPTION_COMMANDS = Object.freeze(Object.fromEntries([
  ...EXTRA_BOOL_OPTIONS.map(([field, , , command]) => [command, { field, kind: 'bool' }]),
  ...Object.entries(CHOICE_OPTIONS).map(([field, spec]) => [spec.command, { field, kind: 'choice' }])
]));

let stateCache = null;
let statePromise = null;
let settingsCache = null;
let settingsPromise = null;
let saveTimer = null;
// Monotonic revision stamped on every UI state sent to a page, so a page can
// drop a state that arrives after a newer one (messages to a tab can overtake
// each other, e.g. a GET_SPLIT_STATUS reply computed before Start sync).
let uiRevCounter = 0;

function debug(...args) {
  if (DEBUG) console.log('[SplitScreen Browser Sync]', ...args);
}

const EXTENSION_ORIGIN = chrome.runtime.getURL('');
const MAX_RULERS = 20;
const MAX_RULER_Y = 100000;
const RULER_ID_PATTERN = /^r-[a-z0-9]{1,16}-[a-z0-9]{1,8}$/;

// Popup options that may be changed for the current pair, mapped to the
// group field that stores them.
// On-page panel commands that start sync, widen what is mirrored or act on a
// tab. The content script only sends them from a trusted (real user) event in
// its closed shadow root and marks them with `userGesture: true`; anything
// else is rejected.
const GESTURE_REQUIRED_COMMANDS = new Set([
  CMD.SYNC_CURRENT,
  CMD.SYNC_ALL,
  CMD.RELOAD_ACTIVE,
  CMD.HARD_RELOAD_ACTIVE,
  CMD.RELOAD_LEFT,
  CMD.HARD_RELOAD_LEFT,
  CMD.RELOAD_RIGHT,
  CMD.HARD_RELOAD_RIGHT,
  CMD.SWAP_SIDES,
  CMD.SET_OFFSET,
  CMD.OFFSET_RESET,
  CMD.TOGGLE_WP_ADMIN_BAR,
  CMD.SET_WP_ADMIN_BAR,
  CMD.SET_NAVIGATION_SYNC,
  CMD.SET_CLICK_MIRRORING,
  CMD.SET_HOVER_MIRRORING,
  CMD.SET_SHOW_CURSOR,
  CMD.CHECKLIST_GO,
  CMD.CHECKLIST_MARK,
  CMD.OVERLAY_SET,
  CMD.OVERLAY_REFRESH,
  CMD.INSPECT_SET,
  CMD.SUGGEST_DISMISS,
  ...Object.keys(OPTION_COMMANDS)
]);

const POPUP_GROUP_OPTIONS = Object.freeze({
  syncNavigation: 'syncNavigation',
  mirrorClicks: 'mirrorClicks',
  mirrorHover: 'mirrorHover',
  hideWpAdminBar: 'hideWpAdminBar',
  showCursor: 'showCursor',
  ...Object.fromEntries(EXTRA_BOOL_OPTIONS.map(([field]) => [field, field]))
});

const SETTINGS_DEFAULT_FIELDS = Object.freeze([
  'defaultHideWpAdminBar',
  'defaultSyncNavigation',
  'defaultMirrorClicks',
  'defaultMirrorHover',
  'defaultShowCursor',
  ...EXTRA_BOOL_OPTIONS.map(([, setting]) => setting)
]);

function t(key, substitutions) {
  try {
    return chrome.i18n.getMessage(key, substitutions) || key;
  } catch (_error) {
    return key;
  }
}

// Messages are only accepted from this extension. Chrome already blocks web
// pages (no externally_connectable), but we still check the sender so that
// page-facing messages can only come from our own top-frame content script on
// an http(s) page, and settings messages only from our own extension pages
// (chrome-extension://<our id>/..., which no website can host).
function isFromThisExtension(sender) {
  return Boolean(sender) && sender.id === chrome.runtime.id;
}

function isFromExtensionPage(sender) {
  return isFromThisExtension(sender)
    && typeof sender.url === 'string'
    && sender.url.startsWith(EXTENSION_ORIGIN);
}

function isFromContentScript(sender) {
  return isFromThisExtension(sender)
    && Boolean(sender.tab)
    && typeof sender.tab.id === 'number'
    && typeof sender.tab.windowId === 'number'
    && (sender.frameId === undefined || sender.frameId === 0)
    && isNormalHttpUrl(sender.url || sender.tab.url);
}

function isValidRulerId(id) {
  return typeof id === 'string' && RULER_ID_PATTERN.test(id);
}

function clampRulerY(value) {
  const y = Number(value);
  if (!Number.isFinite(y)) return 0;
  return Math.max(0, Math.min(MAX_RULER_Y, Math.round(y)));
}

function finiteOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function plainObjectOr(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function isNormalHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function isValidSplitViewId(splitViewId) {
  return typeof splitViewId === 'number' && splitViewId !== SPLIT_NONE;
}

function groupKeyFor(windowId, splitViewId) {
  return `${windowId}:${splitViewId}`;
}

function normalizeState(raw) {
  const state = raw && typeof raw === 'object' ? raw : {};
  state.groups = state.groups && typeof state.groups === 'object' ? state.groups : {};
  state.tabToGroupKey = state.tabToGroupKey && typeof state.tabToGroupKey === 'object' ? state.tabToGroupKey : {};
  state.manuallyShownGroups = state.manuallyShownGroups && typeof state.manuallyShownGroups === 'object'
    ? state.manuallyShownGroups
    : {};
  state.manuallyHiddenGroups = state.manuallyHiddenGroups && typeof state.manuallyHiddenGroups === 'object'
    ? state.manuallyHiddenGroups
    : {};
  return state;
}

function normalizeSettings(raw) {
  const settings = raw && typeof raw === 'object' ? raw : {};
  const boolOr = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
  return {
    alwaysShowButtonOnSplitScreen: boolOr(settings.alwaysShowButtonOnSplitScreen, DEFAULT_ALWAYS_SHOW_BUTTON),
    rememberPairs: boolOr(settings.rememberPairs, true),
    suggestSync: boolOr(settings.suggestSync, true),
    defaultHideWpAdminBar: boolOr(settings.defaultHideWpAdminBar, DEFAULT_HIDE_WP_ADMIN_BAR),
    defaultSyncNavigation: boolOr(settings.defaultSyncNavigation, DEFAULT_SYNC_NAVIGATION),
    defaultMirrorClicks: boolOr(settings.defaultMirrorClicks, DEFAULT_MIRROR_CLICKS),
    defaultMirrorHover: boolOr(settings.defaultMirrorHover, DEFAULT_MIRROR_HOVER),
    defaultShowCursor: boolOr(settings.defaultShowCursor, DEFAULT_SHOW_CURSOR),
    ...Object.fromEntries(EXTRA_BOOL_OPTIONS.map(([, setting, fallback]) => [setting, boolOr(settings[setting], fallback)])),
    ...Object.fromEntries(Object.entries(CHOICE_OPTIONS).map(([name, spec]) => [spec.setting, choiceOr(name, settings[spec.setting])]))
  };
}

// The per-group option values a brand-new split screen pairing should start
// with, taken from the user-configurable settings (popup) and falling back to
// the built-in constants.
function resolveGroupDefaults(settings) {
  const s = settings && typeof settings === 'object' ? settings : {};
  const boolOr = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
  return {
    hideWpAdminBar: boolOr(s.defaultHideWpAdminBar, DEFAULT_HIDE_WP_ADMIN_BAR),
    syncNavigation: boolOr(s.defaultSyncNavigation, DEFAULT_SYNC_NAVIGATION),
    mirrorClicks: boolOr(s.defaultMirrorClicks, DEFAULT_MIRROR_CLICKS),
    mirrorHover: boolOr(s.defaultMirrorHover, DEFAULT_MIRROR_HOVER),
    showCursor: boolOr(s.defaultShowCursor, DEFAULT_SHOW_CURSOR),
    ...Object.fromEntries(EXTRA_BOOL_OPTIONS.map(([field, setting, fallback]) => [field, boolOr(s[setting], fallback)])),
    ...Object.fromEntries(Object.entries(CHOICE_OPTIONS).map(([name, spec]) => [name, choiceOr(name, s[spec.setting])]))
  };
}

// Values of the extra options for UI states and the popup.
function extraOptionValues(group) {
  return {
    ...Object.fromEntries(EXTRA_BOOL_OPTIONS.map(([field]) => [field, Boolean(group?.[field])])),
    ...Object.fromEntries(Object.keys(CHOICE_OPTIONS).map((name) => [name, choiceOr(name, group?.[name])]))
  };
}

// The state is loaded once per service worker life. Concurrent first callers
// (several events arrive together when the worker wakes up) share one load,
// so they all get the same object; separate loads used to hand out different
// objects and changes made on one of them (such as enabled = true) were lost.
function getState() {
  if (stateCache) return Promise.resolve(stateCache);
  if (!statePromise) {
    statePromise = (async () => {
      let loaded;
      try {
        const stored = await chrome.storage.session.get(SESSION_KEY);
        loaded = normalizeState(stored[SESSION_KEY]);
      } catch (error) {
        debug('storage.session unavailable, using in-memory state only', error);
        loaded = normalizeState({});
      }
      if (!stateCache) stateCache = loaded;
      return stateCache;
    })();
  }
  return statePromise;
}

function getSettings() {
  if (settingsCache) return Promise.resolve(settingsCache);
  if (!settingsPromise) {
    settingsPromise = (async () => {
      let loaded;
      try {
        const stored = await chrome.storage.local.get(LOCAL_SETTINGS_KEY);
        loaded = normalizeSettings(stored[LOCAL_SETTINGS_KEY]);
      } catch (error) {
        debug('storage.local unavailable, using default settings', error);
        loaded = normalizeSettings({});
      }
      if (!settingsCache) settingsCache = loaded;
      return settingsCache;
    })();
  }
  return settingsPromise;
}

async function saveSettings(settings) {
  settingsCache = normalizeSettings(settings);
  try {
    await chrome.storage.local.set({ [LOCAL_SETTINGS_KEY]: settingsCache });
  } catch (error) {
    debug('Could not save local settings', error);
  }
}

async function saveStateNow() {
  if (!stateCache) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  try {
    await chrome.storage.session.set({ [SESSION_KEY]: stateCache });
  } catch (error) {
    debug('Could not save session state', error);
  }
}

function scheduleSaveState() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveStateNow();
  }, SAVE_DEBOUNCE_MS);
}

function tabIdSetEquals(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((value, index) => value === sortedB[index]);
}

function groupTabIds(group) {
  return [group.leftTabId, group.rightTabId].filter((id) => typeof id === 'number');
}

function getSide(group, tabId) {
  if (group.leftTabId === tabId) return 'left';
  if (group.rightTabId === tabId) return 'right';
  return 'unknown';
}

function getPeerTabId(group, tabId) {
  if (group.leftTabId === tabId) return group.rightTabId;
  if (group.rightTabId === tabId) return group.leftTabId;
  return null;
}

function getOrigin(url) {
  if (!isNormalHttpUrl(url)) return null;
  try {
    return new URL(url).origin;
  } catch (_error) {
    return null;
  }
}

// Maps the path, query and hash of `sourceUrl` onto `targetOrigin`, which must
// be the pinned origin of the other pane. Never produces a URL on any other
// origin.
function buildMirroredUrl(sourceUrl, targetOrigin) {
  if (!isNormalHttpUrl(sourceUrl) || typeof targetOrigin !== 'string' || !targetOrigin) return null;

  try {
    const source = new URL(sourceUrl);
    if (!/^https?:$/.test(source.protocol)) return null;
    // Set the parts individually so a path such as `//other.example` can never
    // change the host.
    const mirrored = new URL(targetOrigin);
    mirrored.pathname = source.pathname;
    mirrored.search = source.search;
    mirrored.hash = source.hash;
    if (!/^https?:$/.test(mirrored.protocol) || mirrored.origin !== targetOrigin) return null;
    return mirrored.href;
  } catch (_error) {
    return null;
  }
}

// ---- Origin pinning --------------------------------------------------------
// When the user starts sync, the origin of each pane is recorded on the pair.
// Clicks, focus, hover and navigation are only mirrored while both panes are
// still on their pinned origin. If either pane leaves it, the pair is paused
// until the user presses Start again (which pins the new origins).

function pinnedOriginFor(group, tabId) {
  if (!group) return null;
  if (tabId === group.leftTabId) return group.pinnedLeftOrigin || null;
  if (tabId === group.rightTabId) return group.pinnedRightOrigin || null;
  return null;
}

async function pinPairOrigins(group) {
  const [leftTab, rightTab] = await Promise.all([safeGetTab(group.leftTabId), safeGetTab(group.rightTabId)]);
  group.pinnedLeftOrigin = getOrigin(leftTab?.url);
  group.pinnedRightOrigin = getOrigin(rightTab?.url);
  group.originsPinned = true;
  group.pauseReason = null;
}

async function pauseForOriginChange(group) {
  if (!group || !group.enabled) return;
  debug('Pausing pair: a pane left its pinned origin', group.groupKey);
  group.enabled = false;
  group.pauseReason = PAUSE_ORIGIN_CHANGED;
  if (group.overlay) group.overlay.on = false;
  group.inspect = false;
  group.isReloadingTabs = {};
  group.navigationLocks = {};
  group.error = null;
  await saveStateNow();
  await sendGroupState(group);
}

// Pairs enabled before origin pinning existed have no pins yet; pin them to
// their current origins once instead of pausing them with a misleading reason.
async function ensurePinsForEnabledGroup(group) {
  if (!group?.enabled || group.originsPinned) return;
  await pinPairOrigins(group);
  scheduleSaveState();
}

// True when the source pane (reported URL, or its current tab URL) and the
// peer pane are both on their pinned origins. Pauses the pair otherwise.
async function isPairOnPinnedOrigins(group, sourceTabId, sourceUrl = null) {
  if (!group?.enabled) return false;
  await ensurePinsForEnabledGroup(group);

  const targetTabId = getPeerTabId(group, sourceTabId);
  const sourcePin = pinnedOriginFor(group, sourceTabId);
  const targetPin = pinnedOriginFor(group, targetTabId);
  if (!targetTabId || !sourcePin || !targetPin) return false;

  const sourceOrigin = getOrigin(sourceUrl) || getOrigin((await safeGetTab(sourceTabId))?.url);
  const targetOrigin = getOrigin((await safeGetTab(targetTabId))?.url);

  if (sourceOrigin !== sourcePin || targetOrigin !== targetPin) {
    await pauseForOriginChange(group);
    return false;
  }
  return true;
}

function sameUrl(a, b) {
  try {
    return new URL(a).href === new URL(b).href;
  } catch (_error) {
    return a === b;
  }
}

function adjustScrollForTarget(group, sourceTabId, targetTabId, scrollX, scrollY) {
  const offsetX = Number(group.offsetX || 0);
  const offsetY = Number(group.offsetY || 0);

  if (sourceTabId === group.leftTabId && targetTabId === group.rightTabId) {
    return {
      x: Math.max(0, Math.round(scrollX + offsetX)),
      y: Math.max(0, Math.round(scrollY + offsetY))
    };
  }

  if (sourceTabId === group.rightTabId && targetTabId === group.leftTabId) {
    return {
      x: Math.max(0, Math.round(scrollX - offsetX)),
      y: Math.max(0, Math.round(scrollY - offsetY))
    };
  }

  return {
    x: Math.max(0, Math.round(scrollX)),
    y: Math.max(0, Math.round(scrollY))
  };
}

async function safeGetTab(tabId) {
  try {
    return await chrome.tabs.get(tabId);
  } catch (error) {
    debug('tabs.get failed', tabId, error);
    return null;
  }
}

async function safeSendMessage(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    debug('tabs.sendMessage failed', tabId, message?.type, error?.message || error);
    return null;
  }
}

// One check/injection per tab at a time; parallel callers share the result.
const contentScriptChecks = new Map();

function ensureContentScript(tabId) {
  if (contentScriptChecks.has(tabId)) return contentScriptChecks.get(tabId);
  const check = ensureContentScriptNow(tabId).finally(() => contentScriptChecks.delete(tabId));
  contentScriptChecks.set(tabId, check);
  return check;
}

async function ensureContentScriptNow(tabId) {
  const ping = await safeSendMessage(tabId, { type: MSG.PING });
  if (ping?.ok) return true;

  const tab = await safeGetTab(tabId);
  if (!tab || !isNormalHttpUrl(tab.url)) return false;

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content.css']
    }).catch(() => undefined);

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });

    const secondPing = await safeSendMessage(tabId, { type: MSG.PING });
    return Boolean(secondPing?.ok);
  } catch (error) {
    debug('Could not inject content script', tabId, error?.message || error);
    return false;
  }
}

async function shouldShowFloatingUi(group) {
  const state = await getState();
  const settings = await getSettings();
  if (state.manuallyHiddenGroups[group.groupKey]) return false;
  if (state.manuallyShownGroups[group.groupKey]) return true;
  return Boolean(settings.alwaysShowButtonOnSplitScreen);
}

async function getManualButtonOverride(groupKey) {
  const state = await getState();
  if (state.manuallyHiddenGroups[groupKey]) return 'hide';
  if (state.manuallyShownGroups[groupKey]) return 'show';
  return 'default';
}

function nextUiRev() {
  uiRevCounter = (uiRevCounter + 1) % 1000;
  return Date.now() * 1000 + uiRevCounter;
}

function buildHiddenState(reason = 'Current tab is not in a split screen.') {
  return {
    rev: nextUiRev(),
    show: false,
    enabled: false,
    wpAdminBarHidden: false,
    color: 'gray',
    statusText: reason,
    syncNavigation: false,
    mirrorClicks: false,
    mirrorHover: false,
    showCursor: false,
    ...Object.fromEntries(EXTRA_BOOL_OPTIONS.map(([field]) => [field, false]))
  };
}

function buildUiStateForTab(group, tabId, show = true, suggestion = null) {
  const enabled = Boolean(group.enabled);
  const reloading = Boolean(group.isReloadingTabs && group.isReloadingTabs[String(tabId)]);
  const hasOffset = Number(group.offsetX || 0) !== 0 || Number(group.offsetY || 0) !== 0;

  let color = 'gray';
  let statusText = 'Sync off';

  if (group.error) {
    color = 'red';
    statusText = group.error;
  } else if (!enabled && group.pauseReason === PAUSE_ORIGIN_CHANGED) {
    color = 'orange';
    statusText = 'Paused: a different site was opened';
  } else if (enabled && (reloading || hasOffset)) {
    color = 'orange';
    statusText = reloading ? 'Sync active, pane reloading' : 'Sync active with offset';
  } else if (enabled) {
    color = 'green';
    statusText = 'Sync active';
  }

  return {
    rev: nextUiRev(),
    show,
    splitViewId: group.splitViewId,
    groupKey: group.groupKey,
    enabled,
    side: getSide(group, tabId),
    leftTabId: group.leftTabId,
    rightTabId: group.rightTabId,
    offsetX: Number(group.offsetX || 0),
    offsetY: Number(group.offsetY || 0),
    hideWpAdminBar: typeof group.hideWpAdminBar === 'boolean' ? group.hideWpAdminBar : DEFAULT_HIDE_WP_ADMIN_BAR,
    syncNavigation: Boolean(group.syncNavigation),
    mirrorClicks: Boolean(group.mirrorClicks),
    mirrorHover: Boolean(group.mirrorHover),
    showCursor: Boolean(group.showCursor),
    ...extraOptionValues(group),
    wpAdminBarHidden: enabled && Boolean(group.hideWpAdminBar),
    rulers: Array.isArray(group.rulers) ? group.rulers : [],
    paneSizes: paneSizesFor(group),
    checklist: checklistSummary(group),
    overlay: overlaySummaryFor(group, tabId),
    inspect: Boolean(enabled && group.inspect),
    color,
    statusText,
    reloading,
    pauseReason: enabled ? null : (group.pauseReason || null),
    suggestion: suggestion || null
  };
}

// ---- Toolbar badge -----------------------------------------------------------
// Per-tab badge and tooltip on the toolbar icon for both panes of a pair:
// synced (green dot), paused because a pane left its pinned site (orange
// "II"), reloading (grey dot), not responding (red "!"). No badge when the tab
// is not in a pair or sync is simply off. The last value per tab is cached so
// the frequent state broadcasts cost no extra API calls; Chrome drops
// tab-specific action values when the tab navigates, so the cache entry is
// forgotten on every load (see tabs.onUpdated).
const BADGES = Object.freeze({
  synced: { text: '●', color: '#12a26b' },
  paused: { text: 'II', color: '#c26a00' },
  reloading: { text: '●', color: '#8a9690' },
  error: { text: '!', color: '#c92a2a' }
});
const badgeCache = new Map();

function badgeKindFor(group) {
  if (!group) return null;
  if (group.error) return 'error';
  if (!group.enabled) return group.pauseReason === PAUSE_ORIGIN_CHANGED ? 'paused' : null;
  if (group.isReloadingTabs && Object.keys(group.isReloadingTabs).length) return 'reloading';
  return 'synced';
}

function hostOfOrigin(origin) {
  try {
    return origin ? new URL(origin).host : '';
  } catch (_error) {
    return '';
  }
}

function badgeTitleFor(group, tabId, kind) {
  const peerId = getPeerTabId(group, tabId);
  const peerHost = hostOfOrigin(pinnedOriginFor(group, peerId)
    || (peerId === group.leftTabId ? group.leftOrigin : group.rightOrigin));
  let status = '';
  if (kind === 'synced') status = peerHost ? t('badgeSyncedWith', [peerHost]) : t('statusSyncedTitle');
  else if (kind === 'reloading') status = t('badgeReloading');
  else if (kind === 'paused') status = t('statusOriginPausedTitle');
  else if (kind === 'error') status = t('statusErrorTitle');
  return `${t('extName')}\n${status}`;
}

async function setTabBadge(tabId, kind, title) {
  if (typeof tabId !== 'number') return;
  const signature = kind ? `${kind}|${title}` : '';
  if (badgeCache.get(tabId) === signature) return;
  badgeCache.set(tabId, signature);
  try {
    if (!kind) {
      await Promise.all([
        chrome.action.setBadgeText({ tabId, text: '' }),
        chrome.action.setTitle({ tabId, title: t('extName') })
      ]);
      return;
    }
    const badge = BADGES[kind];
    await Promise.all([
      chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color }),
      chrome.action.setBadgeTextColor ? chrome.action.setBadgeTextColor({ tabId, color: '#ffffff' }) : null,
      chrome.action.setBadgeText({ tabId, text: badge.text }),
      chrome.action.setTitle({ tabId, title })
    ]);
  } catch (error) {
    // Tab closed in the meantime; try again next time.
    badgeCache.delete(tabId);
    debug('badge update failed', tabId, error?.message || error);
  }
}

function updatePairBadges(group) {
  const kind = badgeKindFor(group);
  for (const tabId of groupTabIds(group)) {
    setTabBadge(tabId, kind, kind ? badgeTitleFor(group, tabId, kind) : '').catch(() => undefined);
  }
}

function clearTabBadge(tabId) {
  setTabBadge(tabId, null, '').catch(() => undefined);
}

// ---- Sync suggestion ---------------------------------------------------------
// When a pair is not syncing and the two panes look like two versions of one
// site, the on-page UI and the popup offer to start sync. Never starts by
// itself: Start goes through the normal (user gesture) start path. Decided
// locally from the two tab URLs; nothing is stored except dismissed pairs of
// origins (chrome.storage.local, capped).
const SUGGEST_DISMISSED_KEY = 'svssSuggestDismissed';
const MAX_SUGGEST_DISMISSED = 200;
// Leading host labels (and dash-separated parts of the first label) that mark
// an environment rather than the site itself.
const ENV_LABELS = new Set([
  'www', 'staging', 'stage', 'stg', 'test', 'tst', 'testing', 'dev', 'develop', 'development',
  'acc', 'acceptance', 'acceptatie', 'accept', 'uat', 'qa', 'preview', 'prev', 'preprod', 'pre',
  'prod', 'production', 'live', 'beta', 'demo', 'sandbox', 'local', 'new', 'old', 'next', 'review'
]);
// Two-label public suffixes and hosting platforms where the site name is the
// label before them (site.co.uk, site.netlify.app, staging.site.ddev.site).
const MULTI_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'com.br', 'com.mx',
  'co.za', 'co.jp', 'com.tr', 'com.pl', 'com.es', 'com.ar', 'co.in', 'com.cn', 'co.kr', 'com.sg',
  'com.hk', 'co.at', 'or.at', 'co.il', 'com.be',
  'github.io', 'gitlab.io', 'netlify.app', 'vercel.app', 'pages.dev', 'workers.dev', 'herokuapp.com',
  'web.app', 'firebaseapp.com', 'onrender.com', 'fly.dev', 'azurewebsites.net', 'wpengine.com',
  'wpenginepowered.com', 'kinsta.cloud', 'myshopify.com', 'wordpress.com', 'ddev.site', 'lndo.site',
  'ngrok.io', 'ngrok.app', 'ngrok-free.app', 'local.test'
]);

let suggestDismissedCache = null;

async function getSuggestDismissed() {
  if (suggestDismissedCache) return suggestDismissedCache;
  let list = [];
  try {
    const stored = await chrome.storage.local.get(SUGGEST_DISMISSED_KEY);
    if (Array.isArray(stored[SUGGEST_DISMISSED_KEY])) {
      list = stored[SUGGEST_DISMISSED_KEY].filter((key) => typeof key === 'string' && key.length <= 600);
    }
  } catch (error) {
    debug('Could not load dismissed suggestions', error);
  }
  if (!suggestDismissedCache) suggestDismissedCache = list.slice(-MAX_SUGGEST_DISMISSED);
  return suggestDismissedCache;
}

async function saveSuggestDismissed(list) {
  suggestDismissedCache = list.slice(-MAX_SUGGEST_DISMISSED);
  try {
    await chrome.storage.local.set({ [SUGGEST_DISMISSED_KEY]: suggestDismissedCache });
  } catch (error) {
    debug('Could not save dismissed suggestions', error);
  }
}

// Order-independent key of a pair of origins.
function originPairKey(originA, originB) {
  return [originA, originB].sort().join(' ');
}

function isIpHostname(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[');
}

function siteNameOf(hostname) {
  const labels = hostname.split('.').filter(Boolean);
  if (labels.length < 2) return null;
  const index = MULTI_LABEL_SUFFIXES.has(labels.slice(-2).join('.')) ? labels.length - 3 : labels.length - 2;
  return index >= 0 ? labels[index] : null;
}

function withoutEnvPrefix(hostname) {
  const labels = hostname.split('.');
  while (labels.length > 2 && ENV_LABELS.has(labels[0])) labels.shift();
  return labels.join('.');
}

// "site-staging" -> "site"; null when the first label has no environment part.
function envFreeFirstLabel(hostname) {
  const parts = hostname.split('.')[0].split(/-+/);
  const kept = parts.filter((part) => part && !ENV_LABELS.has(part));
  return kept.length && kept.length < parts.length ? kept.join('-') : null;
}

// True for live/staging-style variants: staging.site.nl ~ www.site.nl,
// site.nl ~ site.test, site-staging.netlify.app ~ site.nl.
function hostsLookRelated(a, b) {
  if (!a || !b || a === b || isIpHostname(a) || isIpHostname(b)) return false;
  if (withoutEnvPrefix(a) === withoutEnvPrefix(b)) return true;
  const nameA = siteNameOf(a);
  const nameB = siteNameOf(b);
  if (nameA && nameA === nameB && nameA.length >= 2 && !ENV_LABELS.has(nameA)) return true;
  const firstA = envFreeFirstLabel(a);
  const firstB = envFreeFirstLabel(b);
  return Boolean((firstA && (firstA === nameB || firstA === firstB)) || (firstB && firstB === nameA));
}

function comparablePath(url) {
  const path = url.pathname.replace(/\/+$/, '');
  return path || '/';
}

// { left, right } (hosts) when the two URLs look like two versions of one
// site: same path (not just "/") on different origins, or related hosts.
function evaluateSuggestion(leftUrl, rightUrl) {
  if (!isNormalHttpUrl(leftUrl) || !isNormalHttpUrl(rightUrl)) return null;
  let left;
  let right;
  try {
    left = new URL(leftUrl);
    right = new URL(rightUrl);
  } catch (_error) {
    return null;
  }
  if (left.origin === right.origin) return null;
  const leftPath = comparablePath(left);
  const samePath = leftPath === comparablePath(right) && leftPath !== '/';
  const related = hostsLookRelated(left.hostname.toLowerCase(), right.hostname.toLowerCase());
  if (!samePath && !related) return null;
  return { left: left.host, right: right.host, key: originPairKey(left.origin, right.origin) };
}

// The suggestion for a pair, or null. `tabs` may pass already fetched tabs.
async function suggestionFor(group, tabs = null) {
  if (!group || group.enabled || group.error || group.pauseReason) return null;
  const settings = await getSettings();
  if (!settings.suggestSync) return null;
  const [leftTab, rightTab] = tabs || await Promise.all([safeGetTab(group.leftTabId), safeGetTab(group.rightTabId)]);
  const suggestion = evaluateSuggestion(leftTab?.url, rightTab?.url);
  if (!suggestion) return null;
  if (group.suggestDismissedKey === suggestion.key) return null;
  if ((await getSuggestDismissed()).includes(suggestion.key)) return null;
  return { left: suggestion.left, right: suggestion.right };
}

// forever: remember the pair of origins; otherwise only for this pair of tabs
// in this session (until the panes show another pair of sites).
async function dismissSuggestion(group, forever) {
  if (!group) return;
  const [leftTab, rightTab] = await Promise.all([safeGetTab(group.leftTabId), safeGetTab(group.rightTabId)]);
  const suggestion = evaluateSuggestion(leftTab?.url, rightTab?.url);
  if (!suggestion) return;
  group.suggestDismissedKey = suggestion.key;
  scheduleSaveState();
  if (forever) {
    const list = (await getSuggestDismissed()).filter((key) => key !== suggestion.key);
    list.push(suggestion.key);
    await saveSuggestDismissed(list);
  }
  await sendGroupState(group);
}

async function sendHiddenState(tabId, reason) {
  clearTabBadge(tabId);
  const hiddenState = buildHiddenState(reason);
  const firstAttempt = await safeSendMessage(tabId, { type: MSG.HIDE_FLOATING_UI, state: hiddenState });
  if (firstAttempt?.ok) return;

  const stateFallback = await safeSendMessage(tabId, { type: MSG.STATE, state: hiddenState });
  if (stateFallback?.ok) return;

  const ok = await ensureContentScript(tabId);
  if (!ok) return;

  await safeSendMessage(tabId, { type: MSG.HIDE_FLOATING_UI, state: hiddenState });
  await safeSendMessage(tabId, { type: MSG.STATE, state: hiddenState });
}

async function sendGroupState(group, targetTabId = null) {
  updatePairBadges(group);
  const tabIds = targetTabId ? [targetTabId] : groupTabIds(group);
  const show = await shouldShowFloatingUi(group);
  await getChecklists();
  const pairTabs = await Promise.all([safeGetTab(group.leftTabId), safeGetTab(group.rightTabId)]);
  const suggestion = await suggestionFor(group, pairTabs);

  for (const tabId of tabIds) {
    const tab = pairTabs.find((candidate) => candidate?.id === tabId) || await safeGetTab(tabId);
    if (!tab || !isNormalHttpUrl(tab.url)) continue;

    const ok = await ensureContentScript(tabId);
    if (!ok) continue;

    await safeSendMessage(tabId, {
      type: MSG.STATE,
      state: buildUiStateForTab(group, tabId, show, suggestion)
    });
  }
}

function getDefaultsFromExistingGroup(existing, defaults) {
  const d = defaults || resolveGroupDefaults(null);
  return {
    enabled: false,
    offsetX: 0,
    offsetY: 0,
    hideWpAdminBar: d.hideWpAdminBar,
    syncNavigation: d.syncNavigation,
    mirrorClicks: d.mirrorClicks,
    mirrorHover: d.mirrorHover,
    showCursor: d.showCursor,
    ...Object.fromEntries(EXTRA_BOOL_OPTIONS.map(([field]) => [field, d[field]])),
    ...Object.fromEntries(Object.keys(CHOICE_OPTIONS).map((name) => [name, d[name]])),
    lastKnownScrollX: 0,
    lastKnownScrollY: 0,
    lastSourceTabId: null,
    isReloadingTabs: {},
    navigationLocks: {},
    clickLocks: {},
    leftOrigin: null,
    rightOrigin: null,
    pinnedLeftOrigin: null,
    pinnedRightOrigin: null,
    originsPinned: false,
    pauseReason: null,
    rulers: [],
    ...(existing || {})
  };
}

async function scanWindow(windowId = null) {
  const state = await getState();
  const groupDefaults = resolveGroupDefaults(await getSettings());
  const query = windowId == null ? { currentWindow: true } : { windowId };
  const tabs = await chrome.tabs.query(query);
  const actualWindowId = windowId ?? tabs.find((tab) => typeof tab.windowId === 'number')?.windowId;

  const previousGroups = { ...state.groups };
  const previousTabToGroupKey = { ...state.tabToGroupKey };

  if (actualWindowId != null) {
    for (const [tabId, key] of Object.entries(previousTabToGroupKey)) {
      const group = previousGroups[key];
      if (group?.windowId === actualWindowId) delete state.tabToGroupKey[tabId];
    }
  }

  const buckets = new Map();
  for (const tab of tabs) {
    if (!isValidSplitViewId(tab.splitViewId)) continue;
    const key = groupKeyFor(tab.windowId, tab.splitViewId);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(tab);
  }

  const validKeysInWindow = new Set();

  for (const [key, splitTabs] of buckets.entries()) {
    if (splitTabs.length !== 2) continue;

    const sorted = [...splitTabs].sort((a, b) => a.index - b.index);
    const defaultLeft = sorted[0].id;
    const defaultRight = sorted[1].id;
    const splitViewId = sorted[0].splitViewId;
    const groupWindowId = sorted[0].windowId;
    const existing = getDefaultsFromExistingGroup(state.groups[key], groupDefaults);
    const currentIds = [defaultLeft, defaultRight];
    const existingIds = [existing.leftTabId, existing.rightTabId];
    const samePair = tabIdSetEquals(existingIds, currentIds);

    let leftTabId = defaultLeft;
    let rightTabId = defaultRight;

    if (samePair) {
      leftTabId = existing.leftTabId;
      rightTabId = existing.rightTabId;
    }

    const leftTab = splitTabs.find((tab) => tab.id === leftTabId) || sorted[0];
    const rightTab = splitTabs.find((tab) => tab.id === rightTabId) || sorted[1];

    const next = {
      groupKey: key,
      splitViewId,
      windowId: groupWindowId,
      enabled: Boolean(existing.enabled && samePair),
      leftTabId,
      rightTabId,
      offsetX: Number(existing.offsetX || 0),
      offsetY: Number(existing.offsetY || 0),
      hideWpAdminBar: typeof existing.hideWpAdminBar === 'boolean' ? existing.hideWpAdminBar : groupDefaults.hideWpAdminBar,
      syncNavigation: typeof existing.syncNavigation === 'boolean' ? existing.syncNavigation : groupDefaults.syncNavigation,
      mirrorClicks: typeof existing.mirrorClicks === 'boolean' ? existing.mirrorClicks : groupDefaults.mirrorClicks,
      mirrorHover: typeof existing.mirrorHover === 'boolean' ? existing.mirrorHover : groupDefaults.mirrorHover,
      showCursor: typeof existing.showCursor === 'boolean' ? existing.showCursor : groupDefaults.showCursor,
      ...Object.fromEntries(EXTRA_BOOL_OPTIONS.map(([field]) => [field, typeof existing[field] === 'boolean' ? existing[field] : groupDefaults[field]])),
      ...Object.fromEntries(Object.keys(CHOICE_OPTIONS).map((name) => [name, choiceOr(name, existing[name] ?? groupDefaults[name])])),
      lastKnownScrollX: Number(existing.lastKnownScrollX || 0),
      lastKnownScrollY: Number(existing.lastKnownScrollY || 0),
      lastSourceTabId: existing.lastSourceTabId ?? null,
      isReloadingTabs: existing.isReloadingTabs || {},
      navigationLocks: existing.navigationLocks || {},
      clickLocks: existing.clickLocks || {},
      leftOrigin: getOrigin(leftTab?.url) || existing.leftOrigin || null,
      rightOrigin: getOrigin(rightTab?.url) || existing.rightOrigin || null,
      // Pins belong to this exact pair of tabs; a different pair starts unpinned.
      pinnedLeftOrigin: samePair ? (existing.pinnedLeftOrigin || null) : null,
      pinnedRightOrigin: samePair ? (existing.pinnedRightOrigin || null) : null,
      originsPinned: samePair ? Boolean(existing.originsPinned) : false,
      pauseReason: samePair ? (existing.pauseReason || null) : null,
      rulers: Array.isArray(existing.rulers) ? existing.rulers : [],
      error: null,
      updatedAt: Date.now()
    };

    // Update the pair's object in place instead of replacing it. Handlers
    // that looked the group up before an await (Start sync, pause, reload)
    // keep a reference to it; with a replaced object their changes, such as
    // enabled = true, landed on a detached copy and were silently lost when
    // another event (tab activation, a content script saying READY, the
    // popup asking for status) re-scanned the window in between.
    const current = state.groups[key];
    if (current && samePair) Object.assign(current, next);
    else state.groups[key] = next;

    state.tabToGroupKey[String(leftTabId)] = key;
    state.tabToGroupKey[String(rightTabId)] = key;
    validKeysInWindow.add(key);
  }

  if (actualWindowId != null) {
    for (const [key, group] of Object.entries(previousGroups)) {
      if (group.windowId !== actualWindowId) continue;
      if (validKeysInWindow.has(key)) continue;

      delete state.groups[key];
      delete state.manuallyShownGroups[key];
      delete state.manuallyHiddenGroups[key];
      for (const tabId of groupTabIds(group)) {
        if (previousTabToGroupKey[String(tabId)] === key) await sendHiddenState(tabId);
      }
    }
  }

  scheduleSaveState();
  return state;
}

// ---- Overlay ("lay the sites on top of each other") ---------------------------
// The other pane is captured with chrome.tabs.captureVisibleTab and drawn over
// this pane (opacity, normal or difference blend, optional swipe divider).
// Findings (Chrome 157, real Split View):
// - captureVisibleTab captures only the ACTIVE pane of the window (one pane's
//   viewport), so the other pane is activated briefly, captured and the
//   previously active pane re-activated (~30 ms, no visible flicker; keyboard
//   focus returns to the previous pane).
// - It needs '<all_urls>' or activeTab; the http/https host permissions are
//   rejected ("Either the '<all_urls>' or 'activeTab' permission is
//   required"), and activeTab would only cover the pane the user clicked in.
//   '<all_urls>' is therefore an OPTIONAL permission requested when the user
//   first turns the overlay on.
// - At most 2 captures per second (MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND),
//   so captures are throttled and happen after scrolling stops.
// The image only goes to the other pane of the same pair, while both panes
// are on their pinned origins, and is drawn in a closed shadow root with
// pointer-events: none. It is not stored.
const CAPTURE_ORIGINS = Object.freeze(['<all_urls>']);
const CAPTURE_MIN_INTERVAL_MS = 600;
const CAPTURE_SETTLE_MS = 450;
const OVERLAY_DEFAULTS = Object.freeze({ on: false, targetTabId: null, opacity: 0.5, blend: 'normal', swipe: false, swipePos: 50 });

let capturePermission = false;
let lastCaptureAt = 0;
const captureTimers = new Map();
const captureRunning = new Set();

async function refreshCapturePermission() {
  try {
    capturePermission = await chrome.permissions.contains({ origins: [...CAPTURE_ORIGINS] });
  } catch (_error) {
    capturePermission = false;
  }
  return capturePermission;
}

function overlayOf(group) {
  const o = plainObjectOr(group?.overlay);
  return {
    on: Boolean(o.on),
    targetTabId: typeof o.targetTabId === 'number' ? o.targetTabId : null,
    opacity: Math.max(0.1, Math.min(1, Number.isFinite(Number(o.opacity)) ? Number(o.opacity) : OVERLAY_DEFAULTS.opacity)),
    blend: o.blend === 'difference' ? 'difference' : 'normal',
    swipe: Boolean(o.swipe),
    swipePos: Math.max(0, Math.min(100, Number.isFinite(Number(o.swipePos)) ? Number(o.swipePos) : 50))
  };
}

function overlaySummaryFor(group, tabId) {
  const o = overlayOf(group);
  const target = o.targetTabId === group.rightTabId ? 'right' : (o.targetTabId === group.leftTabId ? 'left' : null);
  return {
    on: o.on && Boolean(target),
    target,
    isTarget: o.on && o.targetTabId === tabId,
    opacity: o.opacity,
    blend: o.blend,
    swipe: o.swipe,
    swipePos: o.swipePos,
    permission: capturePermission
  };
}

// Applies a validated patch from the popup or the on-page panel.
async function setOverlay(group, patch, defaultTargetTabId) {
  const o = overlayOf(group);
  const p = plainObjectOr(patch);
  if (typeof p.on === 'boolean') o.on = p.on;
  if (p.side === 'left') o.targetTabId = group.leftTabId;
  if (p.side === 'right') o.targetTabId = group.rightTabId;
  if (Number.isFinite(Number(p.opacity))) o.opacity = Math.max(0.1, Math.min(1, Number(p.opacity)));
  if (p.blend === 'normal' || p.blend === 'difference') o.blend = p.blend;
  if (typeof p.swipe === 'boolean') o.swipe = p.swipe;
  if (Number.isFinite(Number(p.swipePos))) o.swipePos = Math.max(0, Math.min(100, Math.round(Number(p.swipePos))));
  if (o.targetTabId !== group.leftTabId && o.targetTabId !== group.rightTabId) o.targetTabId = defaultTargetTabId;
  // Store before any await, so quick successive patches (slider + switch)
  // build on each other instead of overwriting each other.
  const turnedOn = o.on && (!group.overlay?.on || Boolean(p.side));
  group.overlay = o;

  if (o.on && !(await refreshCapturePermission())) {
    group.overlay.on = false;
    await sendGroupState(group);
    return { ok: false, reason: 'permission' };
  }
  if (o.on && !group.enabled) {
    group.overlay.on = false;
    await sendGroupState(group);
    return { ok: false, reason: 'not-synced' };
  }
  scheduleSaveState();
  await sendGroupState(group);
  if (turnedOn) scheduleOverlayCapture(group, 0);
  return { ok: true };
}

function scheduleOverlayCapture(group, delay = CAPTURE_SETTLE_MS) {
  if (!overlayOf(group).on) return;
  const key = group.groupKey;
  if (captureTimers.has(key)) clearTimeout(captureTimers.get(key));
  captureTimers.set(key, setTimeout(() => {
    captureTimers.delete(key);
    captureOverlay(key).catch((error) => debug('overlay capture failed', error?.message || error));
  }, delay));
}

async function captureOverlay(groupKey) {
  const state = await getState();
  const group = state.groups[groupKey];
  if (!group) return;
  const o = overlayOf(group);
  if (!o.on || !group.enabled) return;
  if (captureRunning.has(groupKey)) {
    scheduleOverlayCapture(group, CAPTURE_MIN_INTERVAL_MS);
    return;
  }
  const wait = lastCaptureAt + CAPTURE_MIN_INTERVAL_MS - Date.now();
  if (wait > 0) {
    scheduleOverlayCapture(group, wait);
    return;
  }

  const targetTabId = o.targetTabId;
  const sourceTabId = getPeerTabId(group, targetTabId);
  if (!sourceTabId || !(await isPairOnPinnedOrigins(group, sourceTabId))) return;
  if (!(await refreshCapturePermission())) {
    group.overlay = { ...o, on: false };
    await sendGroupState(group);
    return;
  }

  captureRunning.add(groupKey);
  let restoreTabId = null;
  let uiHidden = false;
  try {
    const [source, targetScroll] = await Promise.all([readViewport(sourceTabId), getCurrentScroll(targetTabId)]);
    if (!source?.size || !targetScroll) return;
    const [active] = await chrome.tabs.query({ active: true, windowId: group.windowId });
    // Only while the pair is what the window shows; never activate a pane
    // while the user is typing in the other one or holding Alt there.
    if (!active || (active.id !== sourceTabId && active.id !== targetTabId)) return;
    if (active.id === targetTabId) {
      const ready = await Promise.race([safeSendMessage(targetTabId, { type: MSG.CAPTURE_READY }), sleepMs(300)]);
      if (!ready?.ok || ready.busy) {
        scheduleOverlayCapture(group, 1500);
        return;
      }
    }
    uiHidden = true;
    await Promise.race([safeSendMessage(sourceTabId, { type: MSG.CAPTURE_HIDE_UI }), sleepMs(300)]);
    if (active && active.id !== sourceTabId) {
      restoreTabId = active.id;
      await chrome.tabs.update(sourceTabId, { active: true });
    }
    lastCaptureAt = Date.now();
    // The image must show the source pane: check the active tab right before
    // and right after the capture (the user could switch tabs in between).
    const [before] = await chrome.tabs.query({ active: true, windowId: group.windowId });
    const dataUrl = before?.id === sourceTabId ? await chrome.tabs.captureVisibleTab(group.windowId, { format: 'png' }) : null;
    const [after] = await chrome.tabs.query({ active: true, windowId: group.windowId });
    if (after?.id !== sourceTabId) return;
    if (restoreTabId) {
      await chrome.tabs.update(restoreTabId, { active: true }).catch(() => undefined);
      restoreTabId = null;
    }
    uiHidden = false;
    safeSendMessage(sourceTabId, { type: MSG.CAPTURE_RESTORE_UI });
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) return;
    // Still the same pair, still on the pinned origins?
    if (!overlayOf(group).on || overlayOf(group).targetTabId !== targetTabId) return;
    if (!(await isPairOnPinnedOrigins(group, sourceTabId))) return;
    await safeSendMessage(targetTabId, {
      type: MSG.OVERLAY_IMAGE,
      targetOrigin: pinnedOriginFor(group, targetTabId),
      image: {
        dataUrl,
        width: source.size.w,
        height: source.size.h,
        scrollY: targetScroll.scrollY,
        scrollX: targetScroll.scrollX
      }
    });
  } catch (error) {
    debug('captureVisibleTab failed', error?.message || error);
    if (/MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND/.test(String(error?.message))) scheduleOverlayCapture(group, CAPTURE_MIN_INTERVAL_MS);
  } finally {
    if (restoreTabId) await chrome.tabs.update(restoreTabId, { active: true }).catch(() => undefined);
    if (uiHidden) safeSendMessage(sourceTabId, { type: MSG.CAPTURE_RESTORE_UI });
    captureRunning.delete(groupKey);
  }
}

async function handleOverlayCommand(tabId, windowId, command, message) {
  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);
  if (!group) return;
  if (command === CMD.OVERLAY_REFRESH) {
    scheduleOverlayCapture(group, 0);
    return;
  }
  await setOverlay(group, message.overlay, tabId);
}

async function handlePopupOverlayMessage(message) {
  const { activeTab, group } = await activeGroup();
  if (!group) return { ok: false, reason: 'no-pair', status: await getPopupStatus() };
  let result = { ok: true };
  if (message.type === MSG.POPUP_OVERLAY_REFRESH) scheduleOverlayCapture(group, 0);
  else result = await setOverlay(group, message.overlay, activeTab.id);
  return { ...result, status: await getPopupStatus() };
}

// ---- Inspect differences (CSS of the element under the cursor) ----------------
// While the mode is on, hovering an element in one pane sends its descriptor
// and a curated list of computed style values to the other pane, which finds
// the matching element, highlights it and answers with its own values. The
// pane with the mouse shows the properties that differ. Only style values and
// box sizes of the two matched elements are exchanged, only while the mode
// is on and both panes are on their pinned origins. Nothing is stored.
const INSPECT_PROPS = Object.freeze([
  'display', 'position', 'box-sizing', 'margin', 'padding', 'border-width', 'border-radius',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'text-align', 'text-transform', 'text-decoration-line', 'color', 'background-color',
  'opacity', 'box-shadow', 'gap', 'flex-direction', 'justify-content', 'align-items', 'z-index'
]);

function sanitizeStyles(raw) {
  const src = plainObjectOr(raw);
  const out = {};
  for (const prop of INSPECT_PROPS) {
    if (typeof src[prop] === 'string') out[prop] = src[prop].slice(0, 200);
  }
  return out;
}

function sanitizeBox(raw) {
  const b = plainObjectOr(raw);
  return { w: Math.round(clampNumber(b.w, 0, 100000) * 10) / 10, h: Math.round(clampNumber(b.h, 0, 1000000) * 10) / 10 };
}

async function setInspect(group, value) {
  group.inspect = Boolean(value) && Boolean(group.enabled);
  scheduleSaveState();
  await sendGroupState(group);
  return { ok: group.inspect === Boolean(value) };
}

async function handleInspectHoverMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;
  const group = await getGroupForTab(tabId, windowId);
  if (!group || !group.enabled || !group.inspect) return;
  if (!(await isPairOnPinnedOrigins(group, tabId, sender.url))) return;
  const targetTabId = getPeerTabId(group, tabId);
  if (!targetTabId) return;

  const raw = plainObjectOr(message.probe);
  const seq = Math.round(clampNumber(raw.seq, 0, Number.MAX_SAFE_INTEGER));
  const reply = await safeSendMessage(targetTabId, {
    type: MSG.REMOTE_INSPECT,
    targetOrigin: pinnedOriginFor(group, targetTabId),
    probe: {
      ...sanitizeDescriptor(raw),
      clientX: clampNumber(raw.clientX, -10000, 100000),
      clientY: clampNumber(raw.clientY, -10000, 100000),
      vw: clampNumber(raw.vw, 0, 100000),
      vh: clampNumber(raw.vh, 0, 100000)
    }
  });
  const found = Boolean(reply?.ok && reply.found);
  await safeSendMessage(tabId, {
    type: MSG.INSPECT_RESULT,
    targetOrigin: pinnedOriginFor(group, tabId),
    result: {
      seq,
      found,
      styles: found ? sanitizeStyles(reply.styles) : {},
      box: found ? sanitizeBox(reply.box) : null,
      label: found && typeof reply.label === 'string' ? reply.label.slice(0, 120) : ''
    }
  });
}

async function handleInspectClearMessage(sender) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;
  const group = await getGroupForTab(tabId, windowId);
  if (!group || !group.enabled || !group.inspect) return;
  const targetTabId = getPeerTabId(group, tabId);
  if (targetTabId) await safeSendMessage(targetTabId, { type: MSG.REMOTE_INSPECT_CLEAR });
}

// ---- History of pairs ---------------------------------------------------------
// Every pair the user starts sync for is remembered (origin + path of each
// pane; the query string and # part are dropped) in chrome.storage.local, so
// it can be reopened with one click. Can be switched off and cleared.
const HISTORY_KEY = 'svssPairHistory';
const MAX_HISTORY_RECENT = 20;
const MAX_HISTORY_PINNED = 30;
const MAX_HISTORY_NAME = 60;
const HISTORY_ID_PATTERN = /^h-[a-z0-9]{1,16}-[a-z0-9]{1,8}$/;

let historyCache = null;
let historyPromise = null;

function pageKeyOf(url) {
  if (!isNormalHttpUrl(url)) return null;
  try {
    const parsed = new URL(url);
    return { origin: parsed.origin, path: parsed.pathname.slice(0, MAX_PATH_LENGTH) };
  } catch (_error) {
    return null;
  }
}

function normalizeHistory(raw) {
  const out = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (!entry || typeof entry !== 'object' || !HISTORY_ID_PATTERN.test(String(entry.id))) continue;
    const left = pageKeyOf(`${entry.left?.origin}${entry.left?.path || '/'}`);
    const right = pageKeyOf(`${entry.right?.origin}${entry.right?.path || '/'}`);
    if (!left || !right || left.origin !== entry.left.origin || right.origin !== entry.right.origin) continue;
    out.push({
      id: entry.id,
      left,
      right,
      name: typeof entry.name === 'string' ? entry.name.slice(0, MAX_HISTORY_NAME) : '',
      pinned: Boolean(entry.pinned),
      lastUsed: Number(entry.lastUsed) || 0,
      uses: Math.max(1, Math.min(100000, Number(entry.uses) || 1))
    });
  }
  return out;
}

function getHistory() {
  if (historyCache) return Promise.resolve(historyCache);
  if (!historyPromise) {
    historyPromise = (async () => {
      let loaded;
      try {
        loaded = normalizeHistory((await chrome.storage.local.get(HISTORY_KEY))[HISTORY_KEY]);
      } catch (_error) {
        loaded = [];
      }
      if (!historyCache) historyCache = loaded;
      return historyCache;
    })();
  }
  return historyPromise;
}

async function saveHistory() {
  const list = historyCache || [];
  list.sort((a, b) => (b.pinned - a.pinned) || (b.lastUsed - a.lastUsed));
  const pinned = list.filter((entry) => entry.pinned).slice(0, MAX_HISTORY_PINNED);
  const recent = list.filter((entry) => !entry.pinned).slice(0, MAX_HISTORY_RECENT);
  historyCache = [...pinned, ...recent];
  try {
    await chrome.storage.local.set({ [HISTORY_KEY]: historyCache });
  } catch (error) {
    debug('Could not save pair history', error);
  }
}

function pairKeyOfEntry(entry) {
  return [entry.left.origin, entry.right.origin].sort().join('|');
}

async function rememberPair(group) {
  const settings = await getSettings();
  if (!settings.rememberPairs) return;
  const [leftTab, rightTab] = await Promise.all([safeGetTab(group.leftTabId), safeGetTab(group.rightTabId)]);
  const left = pageKeyOf(leftTab?.url);
  const right = pageKeyOf(rightTab?.url);
  if (!left || !right) return;
  const history = await getHistory();
  const key = [left.origin, right.origin].sort().join('|');
  const existing = history.find((entry) => pairKeyOfEntry(entry) === key);
  if (existing) {
    existing.left = left;
    existing.right = right;
    existing.lastUsed = Date.now();
    existing.uses += 1;
  } else {
    history.push({
      id: `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      left,
      right,
      name: '',
      pinned: false,
      lastUsed: Date.now(),
      uses: 1
    });
  }
  await saveHistory();
}

// Waits until every tab finished loading on its expected origin (the old
// page can still report "complete" right after tabs.update).
async function waitForTabsLoaded(tabIds, origins, timeoutMs = 15000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const tabs = await Promise.all(tabIds.map((id) => safeGetTab(id)));
    if (tabs.every((tab, i) => tab && tab.status === 'complete' && getOrigin(tab.url) === origins[i])) return true;
    if (tabs.some((tab) => !tab)) return false;
    await sleepMs(250);
  }
  return false;
}

// Reopens a remembered pair. If the active tab is already in a Split View,
// both URLs are loaded into that pair. Otherwise two tabs are opened next to
// each other and, where Chrome supports it (chrome.tabs.createSplit, Chrome
// 155+), turned into a Split View. Sync is started once both pages loaded.
async function openHistoryEntry(id) {
  const history = await getHistory();
  const entry = history.find((item) => item.id === id);
  if (!entry) return { ok: false };
  const leftUrl = `${entry.left.origin}${entry.left.path}`;
  const rightUrl = `${entry.right.origin}${entry.right.path}`;
  if (!isNormalHttpUrl(leftUrl) || !isNormalHttpUrl(rightUrl)) return { ok: false };
  entry.lastUsed = Date.now();
  entry.uses += 1;
  await saveHistory();

  const { activeTab, group } = await activeGroup();
  if (group) {
    group.enabled = false;
    group.pauseReason = null;
    group.error = null;
    group.navigationLocks = {};
    await saveStateNow();
    await sendGroupState(group);
    await Promise.all([
      chrome.tabs.update(group.leftTabId, { url: leftUrl }),
      chrome.tabs.update(group.rightTabId, { url: rightUrl })
    ]);
    startSyncWhenLoaded([group.leftTabId, group.rightTabId], group.leftTabId, group.windowId, [entry.left.origin, entry.right.origin]);
    return { ok: true, mode: 'reused' };
  }

  const windowId = typeof activeTab?.windowId === 'number' ? activeTab.windowId : undefined;
  const left = await chrome.tabs.create({ url: leftUrl, windowId, active: true });
  const right = await chrome.tabs.create({ url: rightUrl, windowId: left.windowId, index: left.index + 1, active: false });
  if (typeof chrome.tabs.createSplit !== 'function') return { ok: true, mode: 'manual' };
  try {
    await chrome.tabs.createSplit([left.id, right.id]);
  } catch (error) {
    debug('createSplit failed', error?.message || error);
    return { ok: true, mode: 'manual' };
  }
  startSyncWhenLoaded([left.id, right.id], left.id, left.windowId, [entry.left.origin, entry.right.origin]);
  return { ok: true, mode: 'created' };
}

function startSyncWhenLoaded(tabIds, sourceTabId, windowId, origins) {
  (async () => {
    await sleepMs(300);
    if (!(await waitForTabsLoaded(tabIds, origins))) return;
    await enableCurrentSplitView(sourceTabId, windowId);
  })().catch((error) => debug('start after reopen failed', error));
}

function historyForPopup(history) {
  return history.map((entry) => ({ ...entry }));
}

async function handlePopupHistoryMessage(message) {
  const history = await getHistory();
  const settings = await getSettings();
  const id = String(message.id || '');
  if (message.type === MSG.POPUP_HISTORY_OPEN) {
    const result = await openHistoryEntry(id);
    return { ok: true, result, history: historyForPopup(historyCache), rememberPairs: settings.rememberPairs };
  }
  if (message.type === MSG.POPUP_HISTORY_UPDATE) {
    const entry = history.find((item) => item.id === id);
    if (entry) {
      if (typeof message.pinned === 'boolean') entry.pinned = message.pinned;
      if (typeof message.name === 'string') entry.name = message.name.trim().slice(0, MAX_HISTORY_NAME);
      await saveHistory();
    }
  } else if (message.type === MSG.POPUP_HISTORY_DELETE) {
    historyCache = history.filter((item) => item.id !== id);
    await saveHistory();
  } else if (message.type === MSG.POPUP_HISTORY_CLEAR) {
    historyCache = history.filter((item) => item.pinned && message.keepPinned === true);
    await saveHistory();
  } else if (message.type === MSG.POPUP_SET_REMEMBER_PAIRS) {
    await saveSettings({ ...settings, rememberPairs: Boolean(message.value) });
  }
  return { ok: true, history: historyForPopup(historyCache), rememberPairs: (await getSettings()).rememberPairs };
}

// ---- Page checklist -----------------------------------------------------------
// A list of paths to check page by page (live vs staging), stored per pair
// of origins in chrome.storage.local: path, status (ok / fail / na) and a
// note. Previous/next opens the path in both panes, each on its own pinned
// origin; nothing navigates outside the two pinned origins.
const CHECKLISTS_KEY = 'svssChecklists';
const MAX_CHECKLIST_ITEMS = 500;
const MAX_CHECKLISTS = 50;
const MAX_PATH_LENGTH = 2000;
const MAX_NOTE_LENGTH = 1000;
const MAX_CHECKLISTS_BYTES = 4 * 1024 * 1024;
const CHECK_STATUSES = new Set(['ok', 'fail', 'na']);

let checklistsCache = null;
let checklistsPromise = null;
let checklistsSaveTimer = null;

function normalizeChecklists(raw) {
  const out = {};
  for (const [key, list] of Object.entries(plainObjectOr(raw))) {
    if (typeof key !== 'string' || key.length > 600 || !list || typeof list !== 'object') continue;
    const items = (Array.isArray(list.items) ? list.items : [])
      .filter((item) => item && typeof item.path === 'string')
      .slice(0, MAX_CHECKLIST_ITEMS)
      .map((item) => ({
        path: item.path.slice(0, MAX_PATH_LENGTH),
        status: CHECK_STATUSES.has(item.status) ? item.status : null,
        note: typeof item.note === 'string' ? item.note.slice(0, MAX_NOTE_LENGTH) : ''
      }));
    const index = Number.isInteger(list.index) ? Math.max(-1, Math.min(items.length - 1, list.index)) : -1;
    out[key] = { items, index, updatedAt: Number(list.updatedAt) || 0 };
  }
  return out;
}

function getChecklists() {
  if (checklistsCache) return Promise.resolve(checklistsCache);
  if (!checklistsPromise) {
    checklistsPromise = (async () => {
      let loaded;
      try {
        loaded = normalizeChecklists((await chrome.storage.local.get(CHECKLISTS_KEY))[CHECKLISTS_KEY]);
      } catch (_error) {
        loaded = {};
      }
      if (!checklistsCache) checklistsCache = loaded;
      return checklistsCache;
    })();
  }
  return checklistsPromise;
}

function scheduleSaveChecklists() {
  if (checklistsSaveTimer) clearTimeout(checklistsSaveTimer);
  checklistsSaveTimer = setTimeout(async () => {
    checklistsSaveTimer = null;
    const lists = checklistsCache || {};
    // Keep the most recently used lists only.
    const keys = Object.keys(lists).sort((a, b) => (lists[b].updatedAt || 0) - (lists[a].updatedAt || 0));
    for (const key of keys.slice(MAX_CHECKLISTS)) delete lists[key];
    // Stay well inside the storage.local quota: drop the oldest lists first.
    while (Object.keys(lists).length > 1 && JSON.stringify(lists).length > MAX_CHECKLISTS_BYTES) {
      const oldest = Object.keys(lists).sort((a, b) => (lists[a].updatedAt || 0) - (lists[b].updatedAt || 0))[0];
      delete lists[oldest];
    }
    try {
      await chrome.storage.local.set({ [CHECKLISTS_KEY]: lists });
    } catch (error) {
      debug('Could not save checklists', error);
    }
  }, 200);
}

// Checklists belong to a pair of origins, in either order (swapping sides
// keeps the list). The pinned origins are used once sync was started.
function checklistKeyFor(group) {
  if (!group) return null;
  const left = group.pinnedLeftOrigin || group.leftOrigin;
  const right = group.pinnedRightOrigin || group.rightOrigin;
  if (!left || !right) return null;
  return [left, right].sort().join('|');
}

function checklistFor(group, create = false) {
  const key = checklistKeyFor(group);
  if (!key || !checklistsCache) return null;
  if (!checklistsCache[key] && create) checklistsCache[key] = { items: [], index: -1, updatedAt: Date.now() };
  return checklistsCache[key] || null;
}

function checklistSummary(group) {
  const list = checklistFor(group);
  if (!list || !list.items.length) return null;
  const current = list.items[list.index] || null;
  return {
    count: list.items.length,
    index: list.index,
    done: list.items.filter((item) => item.status).length,
    path: current ? current.path : null,
    status: current ? current.status : null,
    canNavigate: Boolean(group.originsPinned && group.pinnedLeftOrigin && group.pinnedRightOrigin)
  };
}

// Accepts a path ("/pricing/?a=1#x") or a full http(s) URL (only its path,
// query and hash are kept). Returns null for anything else.
function normalizeChecklistPath(raw) {
  let text = String(raw || '').trim();
  if (!text || text.length > MAX_PATH_LENGTH) return null;
  try {
    if (/^https?:\/\//i.test(text)) {
      const url = new URL(text);
      text = `${url.pathname}${url.search}${url.hash}`;
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
      return null;
    }
    if (!text.startsWith('/')) text = `/${text}`;
    if (text.startsWith('//')) text = `/${text.replace(/^\/+/, '')}`;
    const url = new URL(text, 'https://checklist.invalid');
    if (url.origin !== 'https://checklist.invalid') return null;
    return `${url.pathname}${url.search}${url.hash}`.slice(0, MAX_PATH_LENGTH);
  } catch (_error) {
    return null;
  }
}

function addChecklistPaths(list, paths) {
  const existing = new Set(list.items.map((item) => item.path));
  let added = 0;
  for (const raw of paths) {
    if (list.items.length >= MAX_CHECKLIST_ITEMS) break;
    const path = normalizeChecklistPath(raw);
    if (!path || existing.has(path)) continue;
    existing.add(path);
    list.items.push({ path, status: null, note: '' });
    added += 1;
  }
  list.updatedAt = Date.now();
  return added;
}

function pathUrlOn(origin, path) {
  const normalized = normalizeChecklistPath(path);
  if (!normalized || !origin) return null;
  return buildMirroredUrl(new URL(normalized, 'https://checklist.invalid').href, origin);
}

// Opens checklist item `index` in both panes, each on its pinned origin.
async function goToChecklistItem(group, index) {
  const list = checklistFor(group);
  if (!list || index < 0 || index >= list.items.length) return { ok: false, reason: 'no-item' };
  if (!group.originsPinned || !group.pinnedLeftOrigin || !group.pinnedRightOrigin) return { ok: false, reason: 'not-pinned' };

  const path = list.items[index].path;
  const leftUrl = pathUrlOn(group.pinnedLeftOrigin, path);
  const rightUrl = pathUrlOn(group.pinnedRightOrigin, path);
  if (!leftUrl || !rightUrl) return { ok: false, reason: 'bad-path' };

  list.index = index;
  list.updatedAt = Date.now();
  scheduleSaveChecklists();

  // Both panes are sent on purpose: lock both so navigation sync does not
  // mirror either load to the other side again.
  const expiresAt = Date.now() + NAVIGATION_LOCK_MS * 2;
  group.navigationLocks = group.navigationLocks || {};
  group.navigationLocks[String(group.leftTabId)] = { url: leftUrl, expiresAt };
  group.navigationLocks[String(group.rightTabId)] = { url: rightUrl, expiresAt };
  await saveStateNow();

  try {
    await Promise.all([
      chrome.tabs.update(group.leftTabId, { url: leftUrl }),
      chrome.tabs.update(group.rightTabId, { url: rightUrl })
    ]);
  } catch (error) {
    debug('checklist navigation failed', error?.message || error);
    return { ok: false, reason: 'navigation' };
  }
  await sendGroupState(group);
  return { ok: true };
}

async function activeGroup() {
  const activeTab = await getActiveTab();
  if (!activeTab?.id || typeof activeTab.windowId !== 'number' || !isNormalHttpUrl(activeTab.url)) return { activeTab, group: null };
  await scanWindow(activeTab.windowId);
  return { activeTab, group: await getGroupForTab(activeTab.id, activeTab.windowId) };
}

async function checklistResponse(group, extra = {}) {
  await getChecklists();
  const list = group ? checklistFor(group) : null;
  const key = checklistKeyFor(group);
  return {
    ok: true,
    available: Boolean(group && key),
    canNavigate: Boolean(group?.originsPinned && group.pinnedLeftOrigin && group.pinnedRightOrigin),
    leftOrigin: group ? (group.pinnedLeftOrigin || group.leftOrigin || null) : null,
    rightOrigin: group ? (group.pinnedRightOrigin || group.rightOrigin || null) : null,
    items: list ? list.items : [],
    index: list ? list.index : -1,
    ...extra
  };
}

async function handlePopupChecklistMessage(message) {
  await getChecklists();
  const { activeTab, group } = await activeGroup();
  if (!group) return checklistResponse(null);

  if (message.type === MSG.POPUP_CHECKLIST_GET) return checklistResponse(group);

  if (message.type === MSG.POPUP_CHECKLIST_ADD || message.type === MSG.POPUP_CHECKLIST_ADD_CURRENT) {
    const list = checklistFor(group, true);
    if (!list) return checklistResponse(group);
    const paths = message.type === MSG.POPUP_CHECKLIST_ADD
      ? String(message.text || '').slice(0, 200000).split(/[\r\n]+/).slice(0, MAX_CHECKLIST_ITEMS)
      : [pageKeyOf(activeTab?.url)?.path];
    const added = addChecklistPaths(list, paths);
    scheduleSaveChecklists();
    await sendGroupState(group);
    return checklistResponse(group, { added });
  }

  const list = checklistFor(group);
  if (!list) return checklistResponse(group);
  const index = Number(message.index);

  if (message.type === MSG.POPUP_CHECKLIST_UPDATE && Number.isInteger(index) && list.items[index]
    && (typeof message.path !== 'string' || list.items[index].path === message.path)) {
    const item = list.items[index];
    if (message.status === null || CHECK_STATUSES.has(message.status)) item.status = message.status;
    if (typeof message.note === 'string') item.note = message.note.slice(0, MAX_NOTE_LENGTH);
    list.updatedAt = Date.now();
    scheduleSaveChecklists();
    await sendGroupState(group);
  } else if (message.type === MSG.POPUP_CHECKLIST_REMOVE && Number.isInteger(index) && list.items[index]
    && (typeof message.path !== 'string' || list.items[index].path === message.path)) {
    list.items.splice(index, 1);
    if (index === list.index) list.index = -1;
    else if (index < list.index) list.index -= 1;
    list.updatedAt = Date.now();
    scheduleSaveChecklists();
    await sendGroupState(group);
  } else if (message.type === MSG.POPUP_CHECKLIST_CLEAR) {
    delete checklistsCache[checklistKeyFor(group)];
    scheduleSaveChecklists();
    await sendGroupState(group);
  } else if (message.type === MSG.POPUP_CHECKLIST_GO) {
    const target = Number.isInteger(index) ? index : list.index + (Number(message.step) < 0 ? -1 : 1);
    const result = await goToChecklistItem(group, Math.max(0, Math.min(list.items.length - 1, target)));
    return checklistResponse(group, { navigation: result });
  }
  return checklistResponse(group);
}

// On-page panel: previous/next and marking the current page.
async function handleChecklistCommand(tabId, windowId, command, message) {
  await getChecklists();
  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);
  const list = group ? checklistFor(group) : null;
  if (!list || !list.items.length) return;
  if (command === CMD.CHECKLIST_GO) {
    const target = list.index + (Number(message.step) < 0 ? -1 : 1);
    if (target < 0 || target >= list.items.length) return;
    await goToChecklistItem(group, target);
    return;
  }
  if (command === CMD.CHECKLIST_MARK && list.items[list.index]) {
    const status = message.status;
    if (status !== null && !CHECK_STATUSES.has(status)) return;
    const item = list.items[list.index];
    item.status = item.status === status ? null : status;
    list.updatedAt = Date.now();
    scheduleSaveChecklists();
    await sendGroupState(group);
  }
}

// ---- Pane sizes -------------------------------------------------------------
// Each pane reports its viewport size (CSS pixels) when it loads and after a
// resize. Chrome has no API to move the Split View divider, so a width
// preset resizes the browser window until the chosen pane has that width
// (the divider keeps its ratio, so the other pane changes too).
const PANE_PRESETS = Object.freeze([375, 768, 1024, 1280, 1440]);
const MIN_PANE_WIDTH = 200;
const MAX_PANE_WIDTH = 8000;

function sanitizeViewport(raw) {
  const v = plainObjectOr(raw);
  const w = Math.round(clampNumber(v.w, 0, 100000));
  const h = Math.round(clampNumber(v.h, 0, 100000));
  return w && h ? { w, h } : null;
}

function paneSizesFor(group) {
  const sizes = plainObjectOr(group?.viewports);
  return {
    left: sizes[String(group?.leftTabId)] || null,
    right: sizes[String(group?.rightTabId)] || null
  };
}

function storeViewport(group, tabId, raw) {
  const size = sanitizeViewport(raw);
  if (!group || !size) return false;
  group.viewports = plainObjectOr(group.viewports);
  const key = String(tabId);
  const previous = group.viewports[key];
  if (previous && previous.w === size.w && previous.h === size.h) return false;
  group.viewports[key] = size;
  // Forget sizes of tabs that left the pair.
  for (const id of Object.keys(group.viewports)) {
    if (id !== String(group.leftTabId) && id !== String(group.rightTabId)) delete group.viewports[id];
  }
  return true;
}

async function handleViewportMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;
  const group = await getGroupForTab(tabId, windowId);
  if (!group) return;
  if (storeViewport(group, tabId, message.viewport)) {
    scheduleSaveState();
    await sendGroupState(group);
  }
  scheduleOverlayCapture(group);
}

async function readViewport(tabId) {
  const response = await safeSendMessage(tabId, { type: MSG.GET_VIEWPORT });
  if (!response?.ok) return null;
  return {
    size: sanitizeViewport(response.viewport),
    screen: plainObjectOr(response.screen)
  };
}

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Resizes the window so the pane `tabId` gets `targetWidth` CSS pixels.
// Pane width is close to linear in the window width (ratio of the divider),
// so a few secant steps converge. Returns { width, reached, limited }.
async function resizePaneTo(group, tabId, targetWidth) {
  const target = Math.round(clampNumber(targetWidth, MIN_PANE_WIDTH, MAX_PANE_WIDTH));
  let win = await chrome.windows.get(group.windowId);
  if (win.state !== 'normal') {
    await chrome.windows.update(win.id, { state: 'normal' });
    await sleepMs(300);
    win = await chrome.windows.get(group.windowId);
  }
  let reading = await readViewport(tabId);
  if (!reading?.size) return { width: null, reached: false, limited: false };

  const screen = reading.screen;
  const availWidth = Math.round(clampNumber(screen.availWidth, 0, 100000)) || null;
  const availLeft = Math.round(clampNumber(screen.availLeft, -100000, 100000));
  let windowWidth = win.width;
  let paneWidth = reading.size.w;
  let ratio = paneWidth / Math.max(1, windowWidth);
  let limited = false;

  for (let step = 0; step < 4 && Math.abs(paneWidth - target) > 1; step += 1) {
    let next = Math.round(windowWidth + (target - paneWidth) / Math.max(0.05, ratio));
    if (availWidth && next > availWidth) { next = availWidth; limited = true; }
    if (next < 400) { next = 400; limited = true; }
    if (next === windowWidth) break;
    const update = { width: next };
    if (availWidth && win.left + next > availLeft + availWidth) update.left = Math.max(availLeft, availLeft + availWidth - next);
    await chrome.windows.update(win.id, update);
    await sleepMs(250);
    win = await chrome.windows.get(group.windowId);
    reading = await readViewport(tabId);
    if (!reading?.size) break;
    const measured = reading.size.w;
    if (win.width !== windowWidth && measured !== paneWidth) ratio = (measured - paneWidth) / (win.width - windowWidth);
    windowWidth = win.width;
    paneWidth = measured;
    if (limited) break;
  }

  if (reading?.size) storeViewport(group, tabId, reading.size);
  const other = getPeerTabId(group, tabId);
  const otherReading = other ? await readViewport(other) : null;
  if (otherReading?.size) storeViewport(group, other, otherReading.size);
  scheduleSaveState();
  await sendGroupState(group);
  return { width: paneWidth, reached: Math.abs(paneWidth - target) <= 1, limited };
}

async function setPaneWidthForActiveSplit(side, width) {
  const activeTab = await getActiveTab();
  if (!activeTab?.id || typeof activeTab.windowId !== 'number') return { ok: false };
  await scanWindow(activeTab.windowId);
  const group = await getGroupForTab(activeTab.id, activeTab.windowId);
  if (!group) return { ok: false };
  const tabId = side === 'right' ? group.rightTabId : group.leftTabId;
  try {
    const result = await resizePaneTo(group, tabId, width);
    return { ok: true, side: side === 'right' ? 'right' : 'left', target: Math.round(width), ...result };
  } catch (error) {
    debug('pane resize failed', error?.message || error);
    return { ok: false };
  }
}

async function getGroupForTab(tabId, forceScanWindowId = null) {
  const state = await getState();
  let key = state.tabToGroupKey[String(tabId)];
  let group = key ? state.groups[key] : null;

  if (!group && forceScanWindowId != null) {
    await scanWindow(forceScanWindowId);
    key = state.tabToGroupKey[String(tabId)];
    group = key ? state.groups[key] : null;
  }

  return group || null;
}

async function getCurrentScroll(tabId, withAnchor = false) {
  const ok = await ensureContentScript(tabId);
  if (!ok) return null;

  const response = await safeSendMessage(tabId, { type: MSG.GET_SCROLL, withAnchor: Boolean(withAnchor) });
  if (!response || typeof response.scrollX !== 'number' || typeof response.scrollY !== 'number') return null;

  return { scrollX: response.scrollX, scrollY: response.scrollY, anchor: response.anchor || null };
}

// "On element/content" alignment: the source pane describes the top-most
// visible element (same descriptor format as hover/click: tag, id, data-*
// attributes, short text, structural path) plus where the viewport starts
// relative to it and the scroll percentage. Only passed while the pair uses
// that mode.
const MAX_DESCRIPTOR_CANDIDATES = 10;
const MAX_DESCRIPTOR_VALUE = 500;

function sanitizeDescriptor(raw) {
  const d = plainObjectOr(raw);
  const candidates = Array.isArray(d.candidates) ? d.candidates.slice(0, MAX_DESCRIPTOR_CANDIDATES) : [];
  return {
    tag: typeof d.tag === 'string' ? d.tag.slice(0, 40) : null,
    candidates: candidates
      .filter((c) => c && typeof c === 'object' && ['css', 'hrefPath', 'text'].includes(c.type) && typeof c.value === 'string')
      // Selectors come from page markup; refuse the expensive :has().
      .filter((c) => c.type !== 'css' || !/:has\(/i.test(c.value))
      .map((c) => ({
        type: c.type,
        value: c.value.slice(0, MAX_DESCRIPTOR_VALUE),
        strong: Boolean(c.strong),
        ...(typeof c.tag === 'string' ? { tag: c.tag.slice(0, 40) } : {})
      })),
    text: typeof d.text === 'string' ? d.text.slice(0, 200) : '',
    textFingerprint: typeof d.textFingerprint === 'string' ? d.textFingerprint.slice(0, 80) : ''
  };
}

function sanitizeAnchor(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const ratio = Number(raw.ratio);
  return {
    ...sanitizeDescriptor(raw),
    delta: clampNumber(raw.delta, -1000000, 1000000),
    ratio: Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : null
  };
}

// The signed offset the target pane adds on top of the source position.
function sideOffsetFor(group, sourceTabId) {
  const offsetY = Number(group.offsetY || 0);
  if (sourceTabId === group.leftTabId) return offsetY;
  if (sourceTabId === group.rightTabId) return -offsetY;
  return 0;
}

async function sendRemoteScroll(group, sourceTabId, targetTabId, scrollX, scrollY, anchor = null) {
  const adjusted = adjustScrollForTarget(group, sourceTabId, targetTabId, scrollX, scrollY);
  const useAnchor = choiceOr('alignMode', group.alignMode) === 'element';
  const ok = await ensureContentScript(targetTabId);

  if (!ok) {
    group.error = 'Other pane not reachable';
    scheduleSaveState();
    await sendGroupState(group, sourceTabId);
    return false;
  }

  const response = await safeSendMessage(targetTabId, {
    type: MSG.REMOTE_SCROLL,
    targetScrollX: adjusted.x,
    targetScrollY: adjusted.y,
    alignMode: useAnchor ? 'element' : 'pixel',
    anchor: useAnchor ? sanitizeAnchor(anchor) : null,
    sideOffsetY: sideOffsetFor(group, sourceTabId),
    sourceTabId,
    splitViewId: group.splitViewId,
    groupKey: group.groupKey,
    timestamp: Date.now()
  });

  if (!response?.ok) {
    group.error = 'Other pane not reachable';
    scheduleSaveState();
    await sendGroupState(group, sourceTabId);
    return false;
  }

  if (group.error) {
    group.error = null;
    scheduleSaveState();
    await sendGroupState(group);
  }

  return true;
}

async function alignPeerToSource(group, sourceTabId) {
  const targetTabId = getPeerTabId(group, sourceTabId);
  if (!targetTabId) return false;

  const current = await getCurrentScroll(sourceTabId, group.alignMode === 'element');
  if (!current) return false;

  group.lastKnownScrollX = current.scrollX;
  group.lastKnownScrollY = current.scrollY;
  group.lastSourceTabId = sourceTabId;
  scheduleSaveState();

  return sendRemoteScroll(group, sourceTabId, targetTabId, current.scrollX, current.scrollY, current.anchor);
}

async function alignTabToPeer(group, targetTabId) {
  const sourceTabId = getPeerTabId(group, targetTabId);
  if (!sourceTabId) return false;

  const current = await getCurrentScroll(sourceTabId, group.alignMode === 'element');
  if (current) return sendRemoteScroll(group, sourceTabId, targetTabId, current.scrollX, current.scrollY, current.anchor);

  if (typeof group.lastKnownScrollX === 'number' && typeof group.lastKnownScrollY === 'number') {
    return sendRemoteScroll(
      group,
      group.lastSourceTabId || sourceTabId,
      targetTabId,
      group.lastKnownScrollX,
      group.lastKnownScrollY
    );
  }

  return false;
}

async function enableCurrentSplitView(tabId, windowId) {
  await scanWindow(windowId);
  let group = await getGroupForTab(tabId, windowId);

  if (!group) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await scanWindow(windowId);
    group = await getGroupForTab(tabId, windowId);
  }

  if (!group) {
    await safeSendMessage(tabId, {
      type: MSG.TOAST,
      text: t('toastNoPair')
    });
    return;
  }

  // Both panes need a live content script before the pair is switched on, so
  // the first state, scroll and alignment reach them. Tabs that were open
  // before the extension was installed or updated get it injected here.
  await Promise.all(groupTabIds(group).map((id) => ensureContentScript(id)));

  await pinPairOrigins(group);
  group.enabled = true;
  group.error = null;
  group.navigationLocks = {};
  group.hideWpAdminBar = typeof group.hideWpAdminBar === 'boolean' ? group.hideWpAdminBar : DEFAULT_HIDE_WP_ADMIN_BAR;
  await reconcileReloading(group);
  await rememberPair(group);

  await saveStateNow();
  await sendGroupState(group);
  await alignPeerToSource(group, tabId);
  await syncZoomFromTab(group, tabId);
  await sendGroupState(group);

  // Safety net: re-send the state once more shortly after.
  const groupKey = group.groupKey;
  setTimeout(async () => {
    const state = await getState();
    const g = state.groups[groupKey];
    if (g && g.enabled) await sendGroupState(g);
  }, 700);
}

async function enableAllSplitViewsInCurrentWindow() {
  const state = await scanWindow(null);
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeWindowId = tabs[0]?.windowId;

  for (const group of Object.values(state.groups)) {
    if (activeWindowId != null && group.windowId !== activeWindowId) continue;
    await Promise.all(groupTabIds(group).map((id) => ensureContentScript(id)));
    await pinPairOrigins(group);
    group.enabled = true;
    group.error = null;
    group.navigationLocks = {};
    group.hideWpAdminBar = typeof group.hideWpAdminBar === 'boolean' ? group.hideWpAdminBar : DEFAULT_HIDE_WP_ADMIN_BAR;
    await rememberPair(group);
  }

  await saveStateNow();

  for (const group of Object.values(state.groups)) {
    if (activeWindowId != null && group.windowId !== activeWindowId) continue;
    await sendGroupState(group);
    const leftScroll = await getCurrentScroll(group.leftTabId, group.alignMode === 'element');
    if (leftScroll) await sendRemoteScroll(group, group.leftTabId, group.rightTabId, leftScroll.scrollX, leftScroll.scrollY, leftScroll.anchor);
    else await alignTabToPeer(group, group.leftTabId);
    await sendGroupState(group);
  }
}

async function stopCurrentSplitView(tabId, windowId) {
  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);
  if (!group) return;

  group.enabled = false;
  group.pauseReason = null;
  group.error = null;
  group.isReloadingTabs = {};
  if (group.overlay) group.overlay.on = false;
  group.inspect = false;
  // Stopped on purpose: do not suggest starting again for these two sites.
  if (group.pinnedLeftOrigin && group.pinnedRightOrigin) group.suggestDismissedKey = originPairKey(group.pinnedLeftOrigin, group.pinnedRightOrigin);
  await saveStateNow();
  await sendGroupState(group);
}

async function stopAllSplitViews() {
  const state = await getState();

  for (const group of Object.values(state.groups)) {
    group.enabled = false;
    if (group.overlay) group.overlay.on = false;
    group.inspect = false;
    if (group.pinnedLeftOrigin && group.pinnedRightOrigin) group.suggestDismissedKey = originPairKey(group.pinnedLeftOrigin, group.pinnedRightOrigin);
    group.pauseReason = null;
    group.error = null;
    group.isReloadingTabs = {};
  }

  await saveStateNow();
  for (const group of Object.values(state.groups)) await sendGroupState(group);
}

async function updateOffset(tabId, windowId, mode, payload = {}) {
  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);
  if (!group) return;

  if (mode === 'reset') {
    group.offsetX = 0;
    group.offsetY = 0;
  }

  if (mode === 'set') {
    if (Object.prototype.hasOwnProperty.call(payload, 'offsetX')) {
      group.offsetX = Number.isFinite(Number(payload.offsetX)) ? Math.round(Number(payload.offsetX)) : 0;
    }
    group.offsetY = Number.isFinite(Number(payload.offsetY)) ? Math.round(Number(payload.offsetY)) : 0;
  }

  group.error = null;
  await saveStateNow();
  await sendGroupState(group);

  if (group.enabled) {
    await alignPeerToSource(group, tabId);
    await sendGroupState(group);
  }
}

async function swapSides(tabId, windowId) {
  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);
  if (!group) return;

  const oldLeft = group.leftTabId;
  group.leftTabId = group.rightTabId;
  group.rightTabId = oldLeft;

  const oldLeftOrigin = group.leftOrigin;
  group.leftOrigin = group.rightOrigin;
  group.rightOrigin = oldLeftOrigin;

  const oldPinnedLeft = group.pinnedLeftOrigin;
  group.pinnedLeftOrigin = group.pinnedRightOrigin;
  group.pinnedRightOrigin = oldPinnedLeft;

  group.offsetX = -Number(group.offsetX || 0);
  group.offsetY = -Number(group.offsetY || 0);
  group.error = null;

  const state = await getState();
  state.tabToGroupKey[String(group.leftTabId)] = group.groupKey;
  state.tabToGroupKey[String(group.rightTabId)] = group.groupKey;

  await saveStateNow();
  await sendGroupState(group);

  if (group.enabled) {
    await alignPeerToSource(group, tabId);
    await sendGroupState(group);
  }
}

async function toggleWpAdminBar(tabId, windowId, explicitValue = null) {
  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);
  if (!group) return;

  group.hideWpAdminBar = typeof explicitValue === 'boolean' ? explicitValue : !Boolean(group.hideWpAdminBar);
  await saveStateNow();
  await sendGroupState(group);
}

async function setGroupBooleanOption(tabId, windowId, optionName, value) {
  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);
  if (!group) return;

  group[optionName] = Boolean(value);
  group.error = null;
  await saveStateNow();
  await sendGroupState(group);
  if (optionName === 'syncZoom' && group.enabled && value) await syncZoomFromTab(group, tabId);
}

async function setGroupChoiceOption(tabId, windowId, optionName, value) {
  if (!Object.prototype.hasOwnProperty.call(CHOICE_OPTIONS, optionName)) return;
  if (!CHOICE_OPTIONS[optionName].values.includes(value)) return;
  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);
  if (!group) return;

  group[optionName] = value;
  group.error = null;
  await saveStateNow();
  await sendGroupState(group);
  if (group.enabled) await alignPeerToSource(group, tabId);
}

// ---- "Reloading" status ------------------------------------------------------
// A pane is marked reloading when Chrome reports it loading and unmarked when
// it reports complete or its content script says READY. Tab events are
// handled one after another per tab (runForTab), so a slow "loading" handler
// can no longer set the mark after "complete" already cleared it. As a safety
// net every mark is re-checked against the real tab status a few times and
// dropped at the latest after the last delay.

const reloadingRecheckTimers = new Map();

function cancelReloadingRechecks(tabId) {
  const timers = reloadingRecheckTimers.get(tabId);
  if (timers) for (const timer of timers) clearTimeout(timer);
  reloadingRecheckTimers.delete(tabId);
}

function markTabReloading(group, tabId) {
  if (!group.isReloadingTabs || typeof group.isReloadingTabs !== 'object') group.isReloadingTabs = {};
  group.isReloadingTabs[String(tabId)] = Date.now();
  cancelReloadingRechecks(tabId);
  const groupKey = group.groupKey;
  const last = RELOADING_RECHECK_DELAYS.length - 1;
  reloadingRecheckTimers.set(tabId, RELOADING_RECHECK_DELAYS.map((delay, index) => setTimeout(() => {
    recheckReloadingTab(groupKey, tabId, index === last).catch((error) => debug('reloading recheck failed', error));
  }, delay)));
}

// Returns true when a mark was removed.
function clearTabReloading(group, tabId) {
  cancelReloadingRechecks(tabId);
  const key = String(tabId);
  if (!group?.isReloadingTabs || !Object.prototype.hasOwnProperty.call(group.isReloadingTabs, key)) return false;
  delete group.isReloadingTabs[key];
  return true;
}

async function recheckReloadingTab(groupKey, tabId, force) {
  const state = await getState();
  const group = state.groups[groupKey];
  if (!group || !group.isReloadingTabs?.[String(tabId)]) return;

  const tab = await safeGetTab(tabId);
  if (!force && tab && tab.status === 'loading') return;

  clearTabReloading(group, tabId);
  scheduleSaveState();
  await sendGroupState(group);
  if (group.enabled && tab && isNormalHttpUrl(tab.url)) await alignTabToPeer(group, tabId);
}

// Drops marks of panes that are no longer loading (or were marked too long
// ago). Used when the popup or a page asks for the status, which also covers
// a service worker restart that lost the recheck timers.
async function reconcileReloading(group) {
  if (!group?.isReloadingTabs) return false;
  const maxAge = RELOADING_RECHECK_DELAYS[RELOADING_RECHECK_DELAYS.length - 1];
  let changed = false;
  for (const key of Object.keys(group.isReloadingTabs)) {
    const markedAt = Number(group.isReloadingTabs[key]) || 0;
    const tab = await safeGetTab(Number(key));
    if (!tab || tab.status !== 'loading' || Date.now() - markedAt > maxAge) {
      if (clearTabReloading(group, Number(key))) changed = true;
    }
  }
  if (changed) scheduleSaveState();
  return changed;
}

// Tab events and READY messages of one tab are processed in order. A task
// that hangs (for example injecting into a page that never loads) releases
// the queue after a timeout.
const TAB_TASK_TIMEOUT_MS = 10000;
const tabTaskQueues = new Map();

function runForTab(tabId, task) {
  const previous = tabTaskQueues.get(tabId) || Promise.resolve();
  const next = previous.then(() => Promise.race([
    Promise.resolve().then(task),
    new Promise((resolve) => setTimeout(resolve, TAB_TASK_TIMEOUT_MS))
  ])).catch((error) => debug('tab task failed', tabId, error));
  tabTaskQueues.set(tabId, next);
  next.then(() => {
    if (tabTaskQueues.get(tabId) === next) tabTaskQueues.delete(tabId);
  });
  return next;
}

async function reloadPane(tabId, windowId, pane, bypassCache) {
  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);

  let targetTabId = tabId;
  if (group && pane === 'left') targetTabId = group.leftTabId;
  if (group && pane === 'right') targetTabId = group.rightTabId;

  if (group) {
    markTabReloading(group, targetTabId);
    group.error = null;
    await saveStateNow();
    await sendGroupState(group);
  }

  try {
    await chrome.tabs.reload(targetTabId, bypassCache ? { bypassCache: true } : undefined);
  } catch (error) {
    debug('tabs.reload failed', targetTabId, error?.message || error);
    if (group) {
      clearTabReloading(group, targetTabId);
      group.error = 'Could not reload pane';
      await saveStateNow();
      await sendGroupState(group);
    }
  }
}

async function handleScrollMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group || !group.enabled) return;

  // Cheap per-scroll check on the sender only; the peer is checked on every
  // navigation (tabs.onUpdated).
  await ensurePinsForEnabledGroup(group);
  if (getOrigin(sender.url || sender.tab?.url) !== pinnedOriginFor(group, tabId)) {
    await pauseForOriginChange(group);
    return;
  }

  group.lastKnownScrollX = Math.max(0, finiteOr(message.scrollX));
  group.lastKnownScrollY = Math.max(0, finiteOr(message.scrollY));
  group.lastSourceTabId = tabId;
  group.error = null;
  group.updatedAt = Date.now();
  scheduleSaveState();

  const targetTabId = getPeerTabId(group, tabId);
  if (!targetTabId) return;

  await sendRemoteScroll(group, tabId, targetTabId, group.lastKnownScrollX, group.lastKnownScrollY, message.anchor);
  scheduleOverlayCapture(group);
}

async function handleNavigationFromTab(tabId, windowId, sourceUrl) {
  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);
  if (!group) return;

  const sourceOrigin = getOrigin(sourceUrl);
  const side = getSide(group, tabId);
  if (side === 'left') group.leftOrigin = sourceOrigin || group.leftOrigin;
  if (side === 'right') group.rightOrigin = sourceOrigin || group.rightOrigin;

  if (!group.enabled) {
    scheduleSaveState();
    await sendGroupState(group, tabId);
    return;
  }

  // Leaving the pinned origin (another site, or a non-http page) pauses the
  // pair; nothing is mirrored to or from an origin outside the pinned pair.
  await ensurePinsForEnabledGroup(group);
  if (!sourceOrigin || sourceOrigin !== pinnedOriginFor(group, tabId)) {
    await pauseForOriginChange(group);
    return;
  }

  if (!group.syncNavigation) {
    scheduleSaveState();
    await sendGroupState(group, tabId);
    return;
  }

  const now = Date.now();
  const lock = group.navigationLocks?.[String(tabId)];
  if (lock && lock.expiresAt > now && sameUrl(lock.url, sourceUrl)) {
    delete group.navigationLocks[String(tabId)];
    scheduleSaveState();
    await sendGroupState(group, tabId);
    return;
  }

  const targetTabId = getPeerTabId(group, tabId);
  if (!targetTabId) return;

  const targetPin = pinnedOriginFor(group, targetTabId);
  const targetTab = await safeGetTab(targetTabId);
  if (!targetTab || !targetPin) return;
  if (getOrigin(targetTab.url) !== targetPin) {
    await pauseForOriginChange(group);
    return;
  }

  const targetUrl = buildMirroredUrl(sourceUrl, targetPin);
  if (!targetUrl || sameUrl(targetUrl, targetTab.url)) return;

  group.navigationLocks = group.navigationLocks || {};
  group.navigationLocks[String(targetTabId)] = {
    url: targetUrl,
    expiresAt: now + NAVIGATION_LOCK_MS
  };
  group.error = null;
  await saveStateNow();
  await sendGroupState(group);

  try {
    await chrome.tabs.update(targetTabId, { url: targetUrl });
  } catch (error) {
    debug('tabs.update navigation mirror failed', targetTabId, error?.message || error);
  }
}

async function handleClickMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group || !group.enabled || !group.mirrorClicks) return;
  if (!(await isPairOnPinnedOrigins(group, tabId, sender.url))) return;

  const targetTabId = getPeerTabId(group, tabId);
  if (!targetTabId) return;

  const ok = await ensureContentScript(targetTabId);
  if (!ok) return;

  await safeSendMessage(targetTabId, {
    type: MSG.REMOTE_CLICK,
    targetOrigin: pinnedOriginFor(group, targetTabId),
    sourceTabId: tabId,
    groupKey: group.groupKey,
    click: plainObjectOr(message.click),
    timestamp: Date.now()
  });
}

async function handleFocusMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group || !group.enabled || !group.mirrorClicks) return;
  if (!(await isPairOnPinnedOrigins(group, tabId, sender.url))) return;

  const targetTabId = getPeerTabId(group, tabId);
  if (!targetTabId) return;

  const ok = await ensureContentScript(targetTabId);
  if (!ok) return;

  await safeSendMessage(targetTabId, {
    type: MSG.REMOTE_FOCUS,
    targetOrigin: pinnedOriginFor(group, targetTabId),
    focus: plainObjectOr(message.focus)
  });
}

async function handleHoverMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group || !group.enabled || !group.mirrorHover) return;
  if (!(await isPairOnPinnedOrigins(group, tabId, sender.url))) return;

  const targetTabId = getPeerTabId(group, tabId);
  if (!targetTabId) return;

  const ok = await ensureContentScript(targetTabId);
  if (!ok) return;

  await safeSendMessage(targetTabId, {
    type: MSG.REMOTE_HOVER,
    targetOrigin: pinnedOriginFor(group, targetTabId),
    sourceTabId: tabId,
    groupKey: group.groupKey,
    hover: plainObjectOr(message.hover),
    timestamp: Date.now()
  });
}

async function handleHoverClearMessage(sender) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group || !group.enabled || !group.mirrorHover) return;

  const targetTabId = getPeerTabId(group, tabId);
  if (!targetTabId) return;

  await safeSendMessage(targetTabId, {
    type: MSG.REMOTE_HOVER_CLEAR,
    sourceTabId: tabId,
    groupKey: group.groupKey,
    timestamp: Date.now()
  });
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// Pointer position for the virtual cursor in the other pane. Only numbers
// leave the page: the viewport point, the viewport size and the kind of
// event. The sender must be on its pinned origin; the receiving pane checks
// its own origin against `targetOrigin` before drawing anything.
async function handlePointerMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group || !group.enabled || !group.showCursor || !group.originsPinned) return;
  if (getOrigin(sender.url || sender.tab?.url) !== pinnedOriginFor(group, tabId)) return;

  const targetTabId = getPeerTabId(group, tabId);
  const targetOrigin = pinnedOriginFor(group, targetTabId);
  if (!targetTabId || !targetOrigin) return;

  const raw = plainObjectOr(message.pointer);
  const kind = ['move', 'down', 'leave'].includes(raw.kind) ? raw.kind : 'move';
  await safeSendMessage(targetTabId, {
    type: MSG.REMOTE_POINTER,
    targetOrigin,
    pointer: {
      kind,
      clientX: clampNumber(raw.clientX, -10000, 100000),
      clientY: clampNumber(raw.clientY, -10000, 100000),
      vw: clampNumber(raw.vw, 0, 100000),
      vh: clampNumber(raw.vh, 0, 100000)
    }
  });
}

const MAX_OFFSET = 100000;

function formatSignedPx(value) {
  const n = Math.round(Number(value) || 0);
  return n > 0 ? `+${n}` : String(n);
}

// Alt (Option) was released after scrolling one pane on its own: the new
// distance between the panes becomes the pair's vertical scroll offset
// (right = left + offset). The sender reports its own position; the other
// pane's position is read here.
async function handleAltCommitMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group || !group.enabled) return;
  if (!(await isPairOnPinnedOrigins(group, tabId, sender.url))) return;

  const peerTabId = getPeerTabId(group, tabId);
  const peer = peerTabId ? await getCurrentScroll(peerTabId) : null;
  if (!peer) return;

  const ownY = Math.max(0, finiteOr(message.scrollY));
  const leftY = tabId === group.leftTabId ? ownY : peer.scrollY;
  const rightY = tabId === group.leftTabId ? peer.scrollY : ownY;
  group.offsetY = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, Math.round(rightY - leftY)));
  group.lastKnownScrollX = Math.max(0, finiteOr(message.scrollX));
  group.lastKnownScrollY = ownY;
  group.lastSourceTabId = tabId;
  group.error = null;
  await saveStateNow();
  await sendGroupState(group);
  await safeSendMessage(tabId, { type: MSG.TOAST, text: t('toastOffsetSet', [formatSignedPx(group.offsetY)]) });
}

// Scroll inside a scroll container (overflow area, modal, side panel): the
// container's descriptor and scroll position (numbers) go to the other pane,
// which finds the matching scrollable element. Like the page scroll, the
// sender must be on its pinned origin; the receiver checks its own origin.
async function handleContainerScrollMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group || !group.enabled || !group.syncContainers || !group.originsPinned) return;
  if (getOrigin(sender.url || sender.tab?.url) !== pinnedOriginFor(group, tabId)) return;

  const targetTabId = getPeerTabId(group, tabId);
  const targetOrigin = pinnedOriginFor(group, targetTabId);
  if (!targetTabId || !targetOrigin) return;

  const raw = plainObjectOr(message.container);
  scheduleOverlayCapture(group);
  await safeSendMessage(targetTabId, {
    type: MSG.REMOTE_CONTAINER_SCROLL,
    targetOrigin,
    alignMode: choiceOr('alignMode', group.alignMode),
    container: {
      ...sanitizeDescriptor(raw),
      scrollTop: clampNumber(raw.scrollTop, 0, 10000000),
      scrollLeft: clampNumber(raw.scrollLeft, 0, 10000000),
      ratioY: clampNumber(raw.ratioY, 0, 1),
      ratioX: clampNumber(raw.ratioX, 0, 1),
      clientX: clampNumber(raw.clientX, -10000, 100000),
      clientY: clampNumber(raw.clientY, -10000, 100000),
      vw: clampNumber(raw.vw, 0, 100000),
      vh: clampNumber(raw.vh, 0, 100000)
    }
  });
}

// Typing / form input ("Sync typing", off by default). The content script
// never sends password, one-time-code, payment, hidden or file fields, nor
// fields whose name/label looks sensitive, and only from trusted events.
// Here: only for an enabled pair with the option on, both panes on their
// pinned origins, and with strict limits on what the payload may contain.
const FIELD_KINDS = new Set(['text', 'checkbox', 'radio', 'select', 'editable']);
const MAX_FIELD_VALUE = 20000;

async function handleFieldInputMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group || !group.enabled || !group.syncInput) return;
  if (!(await isPairOnPinnedOrigins(group, tabId, sender.url))) return;

  const raw = plainObjectOr(message.field);
  if (!FIELD_KINDS.has(raw.kind)) return;
  if (typeof raw.value === 'string' && raw.value.length > MAX_FIELD_VALUE) return;

  const targetTabId = getPeerTabId(group, tabId);
  if (!targetTabId) return;

  await safeSendMessage(targetTabId, {
    type: MSG.REMOTE_FIELD_INPUT,
    targetOrigin: pinnedOriginFor(group, targetTabId),
    field: {
      ...sanitizeDescriptor(raw),
      kind: raw.kind,
      eventType: raw.eventType === 'change' ? 'change' : 'input',
      value: typeof raw.value === 'string' ? raw.value : '',
      checked: Boolean(raw.checked),
      values: Array.isArray(raw.values) ? raw.values.filter((v) => typeof v === 'string').slice(0, 200).map((v) => v.slice(0, 500)) : [],
      name: typeof raw.name === 'string' ? raw.name.slice(0, 200) : '',
      clientX: clampNumber(raw.clientX, -10000, 100000),
      clientY: clampNumber(raw.clientY, -10000, 100000),
      vw: clampNumber(raw.vw, 0, 100000),
      vh: clampNumber(raw.vh, 0, 100000)
    }
  });
}

// ---- Zoom sync -------------------------------------------------------------
// When one pane of a syncing pair is zoomed, the other pane gets the same
// zoom factor. The factor we set is remembered so the resulting
// onZoomChange of the other pane does not bounce back (no loop).
// tabId -> [{ factor, until }]: every factor we set recently, so fast
// Ctrl+/Ctrl- steps (several events in flight) are all recognised.
const expectedZoom = new Map();
const ZOOM_EPSILON = 0.001;
const ZOOM_EXPECT_MS = 1500;

function expectZoom(tabId, factor) {
  const now = Date.now();
  const list = (expectedZoom.get(tabId) || []).filter((entry) => entry.until > now);
  list.push({ factor, until: now + ZOOM_EXPECT_MS });
  expectedZoom.set(tabId, list);
}

function takeExpectedZoom(tabId, factor) {
  const now = Date.now();
  const list = (expectedZoom.get(tabId) || []).filter((entry) => entry.until > now);
  const index = list.findIndex((entry) => Math.abs(entry.factor - factor) < ZOOM_EPSILON);
  if (index >= 0) list.splice(index, 1);
  if (list.length) expectedZoom.set(tabId, list);
  else expectedZoom.delete(tabId);
  return index >= 0;
}

async function applyZoomToPeer(group, sourceTabId, factor) {
  const peerTabId = getPeerTabId(group, sourceTabId);
  if (!peerTabId || !Number.isFinite(factor) || factor <= 0) return;
  let current = null;
  try { current = await chrome.tabs.getZoom(peerTabId); } catch (_error) { return; }
  if (Math.abs(current - factor) < ZOOM_EPSILON) return;
  expectZoom(peerTabId, factor);
  try {
    await chrome.tabs.setZoom(peerTabId, factor);
  } catch (error) {
    takeExpectedZoom(peerTabId, factor);
    debug('tabs.setZoom failed', peerTabId, error?.message || error);
  }
}

async function handleZoomChange(tabId, newZoomFactor) {
  if (takeExpectedZoom(tabId, newZoomFactor)) return;
  // A change that is not ours while ours are still in flight: let the other
  // pane settle first instead of fighting it.
  if (expectedZoom.has(tabId)) return;
  const state = await getState();
  const group = state.groups[state.tabToGroupKey[String(tabId)]];
  if (!group || !group.enabled || !group.syncZoom) return;
  if (!(await isPairOnPinnedOrigins(group, tabId))) return;
  await applyZoomToPeer(group, tabId, newZoomFactor);
  scheduleOverlayCapture(group, 700);
}

// Gives the other pane the zoom of `sourceTabId` (on Start sync and when the
// option is switched on).
async function syncZoomFromTab(group, sourceTabId) {
  if (!group?.enabled || !group.syncZoom) return;
  try {
    await applyZoomToPeer(group, sourceTabId, await chrome.tabs.getZoom(sourceTabId));
  } catch (error) {
    debug('zoom alignment failed', error?.message || error);
  }
}

async function handleGetSplitStatusMessage(sender) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return buildHiddenState();

  const tab = await safeGetTab(tabId);
  if (!tab || !isNormalHttpUrl(tab.url)) {
    await sendHiddenState(tabId);
    return buildHiddenState();
  }

  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);
  if (!group) {
    await sendHiddenState(tabId);
    return buildHiddenState();
  }

  if (await reconcileReloading(group)) sendGroupState(group).catch(() => undefined);

  const show = await shouldShowFloatingUi(group);
  const state = buildUiStateForTab(group, tabId, show, await suggestionFor(group));
  await safeSendMessage(tabId, { type: MSG.STATE, state });
  return state;
}

async function refreshWindowUi(windowId) {
  const state = await scanWindow(windowId);
  const tabs = await chrome.tabs.query({ windowId });
  const validTabIds = new Set();

  for (const group of Object.values(state.groups)) {
    if (group.windowId !== windowId) continue;
    for (const id of groupTabIds(group)) validTabIds.add(id);
    await sendGroupState(group);
  }

  for (const tab of tabs) {
    if (!tab.id || !isNormalHttpUrl(tab.url)) continue;
    if (!validTabIds.has(tab.id)) await sendHiddenState(tab.id);
  }
}

async function handleReadyMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);

  if (!group) {
    await sendHiddenState(tabId);
    return;
  }

  // The page's content script is running, so this pane finished loading as
  // far as sync is concerned (also after a bfcache restore, where Chrome may
  // not report a new "complete").
  const wasReloading = clearTabReloading(group, tabId);

  storeViewport(group, tabId, message.viewport);
  if (Number.isFinite(message.scrollX)) group.lastKnownScrollX = Math.max(0, message.scrollX);
  if (Number.isFinite(message.scrollY)) group.lastKnownScrollY = Math.max(0, message.scrollY);
  if (isNormalHttpUrl(message.url)) {
    const side = getSide(group, tabId);
    if (side === 'left') group.leftOrigin = getOrigin(message.url) || group.leftOrigin;
    if (side === 'right') group.rightOrigin = getOrigin(message.url) || group.rightOrigin;
  }

  if (group.enabled) {
    await ensurePinsForEnabledGroup(group);
    if (getOrigin(sender.url || message.url) !== pinnedOriginFor(group, tabId)) {
      await pauseForOriginChange(group);
      return;
    }
  }

  await saveStateNow();
  // The peer's panel shows the pair status too; refresh both when this pane
  // stopped reloading.
  await sendGroupState(group, wasReloading ? null : tabId);

  if (group.enabled) {
    await alignTabToPeer(group, tabId);
    await sendGroupState(group, tabId);
    scheduleOverlayCapture(group, 700);
  }
}

async function handleUiCommand(sender, command, message = {}) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  if (GESTURE_REQUIRED_COMMANDS.has(command) && message.userGesture !== true) {
    debug('Rejected UI command without user gesture', command);
    return;
  }

  switch (command) {
    case CMD.SYNC_CURRENT:
      await enableCurrentSplitView(tabId, windowId);
      break;
    case CMD.SYNC_ALL:
      await enableAllSplitViewsInCurrentWindow();
      break;
    case CMD.STOP_CURRENT:
      await stopCurrentSplitView(tabId, windowId);
      break;
    case CMD.STOP_ALL:
      await stopAllSplitViews();
      break;
    case CMD.RELOAD_ACTIVE:
      await reloadPane(tabId, windowId, 'active', false);
      break;
    case CMD.HARD_RELOAD_ACTIVE:
      await reloadPane(tabId, windowId, 'active', true);
      break;
    case CMD.RELOAD_LEFT:
      await reloadPane(tabId, windowId, 'left', false);
      break;
    case CMD.HARD_RELOAD_LEFT:
      await reloadPane(tabId, windowId, 'left', true);
      break;
    case CMD.RELOAD_RIGHT:
      await reloadPane(tabId, windowId, 'right', false);
      break;
    case CMD.HARD_RELOAD_RIGHT:
      await reloadPane(tabId, windowId, 'right', true);
      break;
    case CMD.OFFSET_RESET:
      await updateOffset(tabId, windowId, 'reset');
      break;
    case CMD.SET_OFFSET:
      await updateOffset(tabId, windowId, 'set', message);
      break;
    case CMD.SWAP_SIDES:
      await swapSides(tabId, windowId);
      break;
    case CMD.TOGGLE_WP_ADMIN_BAR:
      await toggleWpAdminBar(tabId, windowId);
      break;
    case CMD.SET_WP_ADMIN_BAR:
      await toggleWpAdminBar(tabId, windowId, Boolean(message.value));
      break;
    case CMD.SET_NAVIGATION_SYNC:
      await setGroupBooleanOption(tabId, windowId, 'syncNavigation', Boolean(message.value));
      break;
    case CMD.SET_CLICK_MIRRORING:
      await setGroupBooleanOption(tabId, windowId, 'mirrorClicks', Boolean(message.value));
      break;
    case CMD.SET_HOVER_MIRRORING:
      await setGroupBooleanOption(tabId, windowId, 'mirrorHover', Boolean(message.value));
      break;
    case CMD.INSPECT_SET: {
      await scanWindow(windowId);
      const group = await getGroupForTab(tabId, windowId);
      if (group) await setInspect(group, Boolean(message.value));
      break;
    }
    case CMD.OVERLAY_SET:
    case CMD.OVERLAY_REFRESH:
      await handleOverlayCommand(tabId, windowId, command, message);
      break;
    case CMD.CHECKLIST_GO:
    case CMD.CHECKLIST_MARK:
      await handleChecklistCommand(tabId, windowId, command, message);
      break;
    case CMD.SET_SHOW_CURSOR:
      await setGroupBooleanOption(tabId, windowId, 'showCursor', Boolean(message.value));
      break;
    case CMD.SUGGEST_DISMISS: {
      await scanWindow(windowId);
      await dismissSuggestion(await getGroupForTab(tabId, windowId), message.forever === true);
      break;
    }
    default: {
      const option = Object.prototype.hasOwnProperty.call(OPTION_COMMANDS, command) ? OPTION_COMMANDS[command] : null;
      if (option?.kind === 'bool') await setGroupBooleanOption(tabId, windowId, option.field, Boolean(message.value));
      else if (option?.kind === 'choice') await setGroupChoiceOption(tabId, windowId, option.field, message.value);
      else debug('Unknown UI command', command);
    }
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0] || null;
}

function summarizeGroupForPopup(group) {
  if (!group) return null;
  const reloading = Boolean(group.isReloadingTabs && Object.keys(group.isReloadingTabs).length);
  return {
    enabled: Boolean(group.enabled),
    pauseReason: group.enabled ? null : (group.pauseReason || null),
    error: Boolean(group.error),
    reloading,
    offsetY: Number(group.offsetY || 0),
    syncNavigation: Boolean(group.syncNavigation),
    mirrorClicks: Boolean(group.mirrorClicks),
    mirrorHover: Boolean(group.mirrorHover),
    showCursor: Boolean(group.showCursor),
    ...extraOptionValues(group),
    hideWpAdminBar: Boolean(group.hideWpAdminBar),
    paneSizes: paneSizesFor(group),
    overlay: overlaySummaryFor(group, null),
    inspect: Boolean(group.enabled && group.inspect),
    rulerCount: Array.isArray(group.rulers) ? group.rulers.length : 0
  };
}

async function getPopupStatus() {
  const settings = await getSettings();
  const activeTab = await getActiveTab();

  if (!activeTab?.id || typeof activeTab.windowId !== 'number' || !isNormalHttpUrl(activeTab.url)) {
    // Without an http(s) URL we cannot inject. If Chrome reports a split view
    // the user is on an internal or restricted page; otherwise it's simply
    // not in a split view.
    const inSplit = isValidSplitViewId(activeTab?.splitViewId);
    return {
      ok: true,
      settings,
      reason: inSplit ? 'unsupported-page' : 'not-in-split',
      isInValidSplitView: false,
      canShowCurrent: false,
      group: null
    };
  }

  await scanWindow(activeTab.windowId);
  const group = await getGroupForTab(activeTab.id, activeTab.windowId);
  if (group && await reconcileReloading(group)) sendGroupState(group).catch(() => undefined);
  const buttonShownForCurrent = group ? await shouldShowFloatingUi(group) : false;
  const manualButtonOverride = group ? await getManualButtonOverride(group.groupKey) : 'default';

  let reason = 'ok';
  if (!group) {
    // In a split view but the pair is not two http(s) pages.
    reason = isValidSplitViewId(activeTab.splitViewId) ? 'unsupported-page' : 'not-in-split';
  }

  return {
    ok: true,
    settings,
    reason,
    isInValidSplitView: Boolean(group),
    canShowCurrent: Boolean(group),
    buttonShownForCurrent,
    manualButtonOverride,
    group: summarizeGroupForPopup(group),
    suggestion: group ? await suggestionFor(group) : null
  };
}

async function setSyncForActiveSplit(value) {
  const activeTab = await getActiveTab();
  if (!activeTab?.id || typeof activeTab.windowId !== 'number') return getPopupStatus();
  if (value) await enableCurrentSplitView(activeTab.id, activeTab.windowId);
  else await stopCurrentSplitView(activeTab.id, activeTab.windowId);
  return getPopupStatus();
}

async function setOptionForActiveSplit(option, value) {
  const field = Object.prototype.hasOwnProperty.call(POPUP_GROUP_OPTIONS, option) ? POPUP_GROUP_OPTIONS[option] : null;
  const activeTab = await getActiveTab();
  if (!field || !activeTab?.id || typeof activeTab.windowId !== 'number') return getPopupStatus();
  await setGroupBooleanOption(activeTab.id, activeTab.windowId, field, Boolean(value));
  return getPopupStatus();
}

async function setChoiceForActiveSplit(option, value) {
  const activeTab = await getActiveTab();
  if (!activeTab?.id || typeof activeTab.windowId !== 'number') return getPopupStatus();
  await setGroupChoiceOption(activeTab.id, activeTab.windowId, option, value);
  return getPopupStatus();
}

async function toggleButtonForCurrentSplit() {
  const activeTab = await getActiveTab();
  if (!activeTab?.id || typeof activeTab.windowId !== 'number') return getPopupStatus();

  await scanWindow(activeTab.windowId);
  const group = await getGroupForTab(activeTab.id, activeTab.windowId);
  if (!group) return getPopupStatus();

  const state = await getState();
  const currentlyShown = await shouldShowFloatingUi(group);

  if (currentlyShown) {
    delete state.manuallyShownGroups[group.groupKey];
    state.manuallyHiddenGroups[group.groupKey] = true;
  } else {
    delete state.manuallyHiddenGroups[group.groupKey];
    state.manuallyShownGroups[group.groupKey] = true;
  }

  await saveStateNow();
  await sendGroupState(group);
  return getPopupStatus();
}

function generateRulerId() {
  return 'r-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

async function sendRulerState(group, targetTabId = null) {
  const tabIds = targetTabId ? [targetTabId] : groupTabIds(group);
  const rulers = Array.isArray(group.rulers) ? group.rulers : [];
  for (const tabId of tabIds) {
    await safeSendMessage(tabId, { type: MSG.RULER_STATE, rulers });
  }
}

async function handlePopupRulerAdd(sender) {
  // From the on-page panel the sender tab is the target; from the toolbar
  // popup it is the active tab.
  const sourceTab = sender?.tab || await getActiveTab();
  if (!sourceTab?.id || typeof sourceTab.windowId !== 'number') return;

  await scanWindow(sourceTab.windowId);
  const group = await getGroupForTab(sourceTab.id, sourceTab.windowId);
  if (!group) return;

  group.rulers = Array.isArray(group.rulers) ? group.rulers : [];
  if (group.rulers.length >= MAX_RULERS) return;
  group.rulers.push({ id: generateRulerId(), y: 300, thickness: 2 });
  scheduleSaveState();
  await sendRulerState(group);
}

async function handleRulerMoveMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group || !isValidRulerId(message.id)) return;

  const ruler = Array.isArray(group.rulers) ? group.rulers.find((r) => r.id === message.id) : null;
  if (!ruler) return;
  ruler.y = clampRulerY(message.y);
  scheduleSaveState();

  const targetTabId = getPeerTabId(group, tabId);
  if (!targetTabId) return;

  await safeSendMessage(targetTabId, {
    type: MSG.REMOTE_RULER_MOVE,
    id: ruler.id,
    y: ruler.y
  });
}

async function handleRulerDeleteMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group || !isValidRulerId(message.id)) return;

  group.rulers = Array.isArray(group.rulers) ? group.rulers.filter((r) => r.id !== message.id) : [];
  scheduleSaveState();
  await sendRulerState(group);
}

async function handleRulerUpdateMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group) return;

  const ruler = Array.isArray(group.rulers) ? group.rulers.find((r) => r.id === message.id) : null;
  if (ruler && Number.isFinite(message.thickness)) {
    ruler.thickness = Math.max(1, Math.min(20, Math.round(message.thickness)));
  }
  scheduleSaveState();
  await sendRulerState(group);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message || typeof message.type !== 'string' || !isFromThisExtension(sender)) {
      sendResponse({ ok: false });
      return;
    }

    const fromPage = isFromContentScript(sender);
    const fromPopup = isFromExtensionPage(sender);
    const isPopupMessage = message.type.startsWith('SVSS_POPUP_');

    // POPUP_RULER_ADD is also sent by the on-page panel; every other popup
    // message is reserved for extension pages, and every other message for
    // the content script.
    const allowed = message.type === MSG.POPUP_RULER_ADD
      ? (fromPage || fromPopup)
      : (isPopupMessage ? fromPopup : fromPage);
    if (!allowed) {
      sendResponse({ ok: false });
      return;
    }

    if (message.type === MSG.READY) {
      await runForTab(sender.tab.id, () => handleReadyMessage(sender, message));
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.POINTER) {
      await handlePointerMessage(sender, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.VIEWPORT) {
      await handleViewportMessage(sender, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.INSPECT_HOVER) {
      await handleInspectHoverMessage(sender, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.INSPECT_CLEAR) {
      await handleInspectClearMessage(sender);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.POPUP_INSPECT_SET) {
      const { group } = await activeGroup();
      const result = group ? await setInspect(group, Boolean(message.value)) : { ok: false };
      sendResponse({ ...result, status: await getPopupStatus() });
      return;
    }

    if (message.type === MSG.POPUP_OVERLAY_SET || message.type === MSG.POPUP_OVERLAY_REFRESH) {
      sendResponse(await handlePopupOverlayMessage(message));
      return;
    }

    if (message.type.startsWith('SVSS_POPUP_HISTORY_') || message.type === MSG.POPUP_SET_REMEMBER_PAIRS) {
      sendResponse(await handlePopupHistoryMessage(message));
      return;
    }

    if (message.type.startsWith('SVSS_POPUP_CHECKLIST_')) {
      sendResponse(await handlePopupChecklistMessage(message));
      return;
    }

    if (message.type === MSG.POPUP_SET_PANE_WIDTH) {
      const width = Number(message.width);
      if (!PANE_PRESETS.includes(width) && !(Number.isInteger(width) && width >= MIN_PANE_WIDTH && width <= MAX_PANE_WIDTH)) {
        sendResponse({ ok: false });
        return;
      }
      const result = await setPaneWidthForActiveSplit(message.side === 'right' ? 'right' : 'left', width);
      sendResponse({ ...result, status: await getPopupStatus() });
      return;
    }

    if (message.type === MSG.FIELD_INPUT) {
      await handleFieldInputMessage(sender, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.CONTAINER_SCROLL) {
      await handleContainerScrollMessage(sender, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.ALT_COMMIT) {
      await handleAltCommitMessage(sender, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.SCROLL) {
      await handleScrollMessage(sender, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.NAVIGATED) {
      const tabId = sender.tab?.id;
      const windowId = sender.tab?.windowId;
      if (typeof tabId === 'number' && typeof windowId === 'number') {
        await handleNavigationFromTab(tabId, windowId, message.url);
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.CLICK) {
      await handleClickMessage(sender, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.FOCUS) {
      await handleFocusMessage(sender, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.HOVER) {
      await handleHoverMessage(sender, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.HOVER_CLEAR) {
      await handleHoverClearMessage(sender);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.COMMAND) {
      await handleUiCommand(sender, message.command, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.GET_SPLIT_STATUS) {
      const state = await handleGetSplitStatusMessage(sender);
      sendResponse({ ok: true, state });
      return;
    }

    if (message.type === MSG.POPUP_GET_STATUS) {
      sendResponse(await getPopupStatus());
      return;
    }

    if (message.type === MSG.POPUP_SUGGEST_DISMISS) {
      const { group } = await activeGroup();
      if (group) await dismissSuggestion(group, message.forever === true);
      sendResponse(await getPopupStatus());
      return;
    }

    if (message.type === MSG.POPUP_SET_SUGGEST || message.type === MSG.POPUP_SUGGEST_RESET) {
      if (message.type === MSG.POPUP_SET_SUGGEST) {
        await saveSettings({ ...(await getSettings()), suggestSync: Boolean(message.value) });
      } else {
        await saveSuggestDismissed([]);
        for (const group of Object.values((await getState()).groups)) delete group.suggestDismissedKey;
        scheduleSaveState();
      }
      const active = await getActiveTab();
      if (active?.windowId) await refreshWindowUi(active.windowId);
      sendResponse(await getPopupStatus());
      return;
    }

    if (message.type === MSG.POPUP_SET_ALWAYS_SHOW) {
      const current = await getSettings();
      await saveSettings({ ...current, alwaysShowButtonOnSplitScreen: Boolean(message.value) });
      const active = await getActiveTab();
      if (active?.windowId) await refreshWindowUi(active.windowId);
      sendResponse(await getPopupStatus());
      return;
    }

    if (message.type === MSG.POPUP_SET_DEFAULTS) {
      const current = await getSettings();
      const incoming = message.defaults && typeof message.defaults === 'object' ? message.defaults : {};
      const next = { ...current };
      for (const field of SETTINGS_DEFAULT_FIELDS) {
        if (typeof incoming[field] === 'boolean') next[field] = incoming[field];
      }
      for (const spec of Object.values(CHOICE_OPTIONS)) {
        if (spec.values.includes(incoming[spec.setting])) next[spec.setting] = incoming[spec.setting];
      }
      await saveSettings(next);
      sendResponse(await getPopupStatus());
      return;
    }

    if (message.type === MSG.POPUP_SET_GROUP_CHOICE) {
      const option = String(message.option || '');
      if (!Object.prototype.hasOwnProperty.call(CHOICE_OPTIONS, option)) {
        sendResponse(await getPopupStatus());
        return;
      }
      sendResponse(await setChoiceForActiveSplit(option, String(message.value || '')));
      return;
    }

    if (message.type === MSG.POPUP_SHOW_BUTTON_CURRENT) {
      sendResponse(await toggleButtonForCurrentSplit());
      return;
    }

    if (message.type === MSG.POPUP_SET_SYNC) {
      sendResponse(await setSyncForActiveSplit(Boolean(message.value)));
      return;
    }

    if (message.type === MSG.POPUP_SET_GROUP_OPTION) {
      sendResponse(await setOptionForActiveSplit(String(message.option || ''), Boolean(message.value)));
      return;
    }

    if (message.type === MSG.POPUP_RULER_ADD) {
      if (fromPage && message.userGesture !== true) {
        sendResponse({ ok: false });
        return;
      }
      await handlePopupRulerAdd(fromPage ? sender : null);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.RULER_MOVE) {
      await handleRulerMoveMessage(sender, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.RULER_DELETE) {
      await handleRulerDeleteMessage(sender, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.RULER_UPDATE) {
      await handleRulerUpdateMessage(sender, message);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === MSG.RULER_SELECT) {
      const tabId = sender.tab?.id;
      const windowId = sender.tab?.windowId;
      if (typeof tabId === 'number' && typeof windowId === 'number') {
        const group = await getGroupForTab(tabId, windowId);
        if (group) {
          const targetTabId = getPeerTabId(group, tabId);
          if (targetTabId) {
            const id = isValidRulerId(message.id) ? message.id : null;
            await safeSendMessage(targetTabId, { type: MSG.REMOTE_RULER_SELECT, id });
          }
        }
      }
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false });
  })().catch((error) => {
    debug('onMessage error', error);
    sendResponse({ ok: false });
  });

  return true;
});

chrome.commands.onCommand.addListener((command) => {
  (async () => {
    const activeTab = await getActiveTab();
    if (!activeTab?.id || !activeTab.windowId) return;

    switch (command) {
      case 'sync-current-split-view':
        await enableCurrentSplitView(activeTab.id, activeTab.windowId);
        break;
      case 'sync-all-split-views':
        await enableAllSplitViewsInCurrentWindow();
        break;
      case 'stop-current-split-view':
        await stopCurrentSplitView(activeTab.id, activeTab.windowId);
        break;
      case 'hard-reload-active-pane':
        await reloadPane(activeTab.id, activeTab.windowId, 'active', true);
        break;
      case 'toggle-inspect': {
        await scanWindow(activeTab.windowId);
        const group = await getGroupForTab(activeTab.id, activeTab.windowId);
        if (group) await setInspect(group, !group.inspect);
        break;
      }
      default:
        debug('Unknown command', command);
    }
  })().catch((error) => debug('commands.onCommand error', error));
});

async function handleTabUpdated(tabId, changeInfo, tab) {
  // Mark the pane as reloading before any slow work for this event, and
  // only from this per-tab queue, so the matching "complete" (processed
  // after this task) always clears it.
  if (changeInfo.status === 'loading') {
    const group = await getGroupForTab(tabId, tab.windowId);
    if (group?.enabled) {
      markTabReloading(group, tabId);
      group.error = null;
      scheduleSaveState();
    }
  }

  if (changeInfo.splitViewId !== undefined || changeInfo.url !== undefined) {
    await refreshWindowUi(tab.windowId);
  }

  // Every URL change is checked against the pinned origins, also changes to
  // non-http pages (those pause an enabled pair).
  if (changeInfo.url) {
    await handleNavigationFromTab(tabId, tab.windowId, changeInfo.url);
  }

  if (changeInfo.status === 'loading') {
    const group = await getGroupForTab(tabId, tab.windowId);
    if (group?.enabled) {
      await saveStateNow();
      await sendGroupState(group);
    }
  }

  if (changeInfo.status === 'complete') {
    await scanWindow(tab.windowId);
    const group = await getGroupForTab(tabId, tab.windowId);

    if (!group) {
      cancelReloadingRechecks(tabId);
      if (isNormalHttpUrl(tab.url)) await sendHiddenState(tabId);
      return;
    }

    clearTabReloading(group, tabId);
    group.error = null;
    await saveStateNow();

    if (isNormalHttpUrl(tab.url)) {
      await ensureContentScript(tabId);
      await sendGroupState(group, tabId);
      if (group.enabled) await alignTabToPeer(group, tabId);
    }

    await sendGroupState(group);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab || typeof tab.windowId !== 'number') return;
  // Chrome resets tab-specific badge values on navigation; set them again.
  if (changeInfo.status || changeInfo.url) badgeCache.delete(tabId);
  runForTab(tabId, () => handleTabUpdated(tabId, changeInfo, tab));
});

chrome.tabs.onZoomChange.addListener((zoomChangeInfo) => {
  const { tabId, newZoomFactor } = zoomChangeInfo || {};
  if (typeof tabId !== 'number' || !Number.isFinite(newZoomFactor)) return;
  handleZoomChange(tabId, newZoomFactor).catch((error) => debug('onZoomChange error', error));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  badgeCache.delete(tabId);
  (async () => {
    const state = await getState();
    const key = state.tabToGroupKey[String(tabId)];
    if (!key) return;

    const group = state.groups[key];
    delete state.tabToGroupKey[String(tabId)];
    delete state.groups[key];
    delete state.manuallyShownGroups[key];
    delete state.manuallyHiddenGroups[key];
    await saveStateNow();

    if (group) {
      for (const peerId of groupTabIds(group)) {
        if (peerId !== tabId) await sendHiddenState(peerId);
      }
    }
  })().catch((error) => debug('tabs.onRemoved error', error));
});

chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  refreshWindowUi(moveInfo.windowId).catch((error) => debug('tabs.onMoved error', error));
});

chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
  refreshWindowUi(attachInfo.newWindowId).catch((error) => debug('tabs.onAttached error', error));
});

chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
  refreshWindowUi(detachInfo.oldWindowId).catch((error) => debug('tabs.onDetached error', error));
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  (async () => {
    await scanWindow(activeInfo.windowId);
    const group = await getGroupForTab(activeInfo.tabId, activeInfo.windowId);
    if (group) await sendGroupState(group, activeInfo.tabId);
    else await sendHiddenState(activeInfo.tabId);
  })().catch((error) => debug('tabs.onActivated error', error));
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  refreshWindowUi(windowId).catch((error) => debug('windows.onFocusChanged error', error));
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[LOCAL_SETTINGS_KEY]) return;
  settingsCache = normalizeSettings(changes[LOCAL_SETTINGS_KEY].newValue);
  chrome.windows.getLastFocused().then((window) => {
    if (window?.id != null) return refreshWindowUi(window.id);
    return null;
  }).catch((error) => debug('storage.onChanged refresh failed', error));
});

chrome.permissions.onAdded.addListener(() => {
  refreshCapturePermission().catch(() => undefined);
});

chrome.permissions.onRemoved.addListener(() => {
  refreshCapturePermission().then(async (granted) => {
    if (granted) return;
    const state = await getState();
    for (const group of Object.values(state.groups)) {
      if (group.overlay?.on) {
        group.overlay.on = false;
        await sendGroupState(group);
      }
    }
  }).catch(() => undefined);
});

refreshCapturePermission().catch(() => undefined);

chrome.runtime.onInstalled.addListener(() => {
  Promise.all([getState().then(saveStateNow), getSettings().then(saveSettings)])
    .catch((error) => debug('onInstalled error', error));
});

chrome.runtime.onStartup.addListener(() => {
  Promise.all([getState(), getSettings()]).catch((error) => debug('onStartup error', error));
});
