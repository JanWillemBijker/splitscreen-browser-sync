'use strict';

const DEBUG = false;
const SESSION_KEY = 'splitViewScrollSyncState';
const LOCAL_SETTINGS_KEY = 'splitViewScrollSyncSettings';
const SPLIT_NONE = chrome.tabs.SPLIT_VIEW_ID_NONE ?? -1;
const DEFAULT_HIDE_WP_ADMIN_BAR = true;
const DEFAULT_SYNC_NAVIGATION = false;
const DEFAULT_MIRROR_CLICKS = false;
const DEFAULT_MIRROR_HOVER = false;
const DEFAULT_ALWAYS_SHOW_BUTTON = true;
const SAVE_DEBOUNCE_MS = 150;
const NAVIGATION_LOCK_MS = 1500;

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
  POPUP_SHOW_BUTTON_CURRENT: 'SVSS_POPUP_SHOW_BUTTON_CURRENT'
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
  SET_HOVER_MIRRORING: 'SET_HOVER_MIRRORING'
});

let stateCache = null;
let settingsCache = null;
let saveTimer = null;

function debug(...args) {
  if (DEBUG) console.log('[SplitScreen Browser Sync]', ...args);
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
    defaultHideWpAdminBar: boolOr(settings.defaultHideWpAdminBar, DEFAULT_HIDE_WP_ADMIN_BAR),
    defaultSyncNavigation: boolOr(settings.defaultSyncNavigation, DEFAULT_SYNC_NAVIGATION),
    defaultMirrorClicks: boolOr(settings.defaultMirrorClicks, DEFAULT_MIRROR_CLICKS),
    defaultMirrorHover: boolOr(settings.defaultMirrorHover, DEFAULT_MIRROR_HOVER)
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
    mirrorHover: boolOr(s.defaultMirrorHover, DEFAULT_MIRROR_HOVER)
  };
}

async function getState() {
  if (stateCache) return stateCache;

  try {
    const stored = await chrome.storage.session.get(SESSION_KEY);
    stateCache = normalizeState(stored[SESSION_KEY]);
  } catch (error) {
    debug('storage.session unavailable, using in-memory state only', error);
    stateCache = normalizeState({});
  }

  return stateCache;
}

async function getSettings() {
  if (settingsCache) return settingsCache;

  try {
    const stored = await chrome.storage.local.get(LOCAL_SETTINGS_KEY);
    settingsCache = normalizeSettings(stored[LOCAL_SETTINGS_KEY]);
  } catch (error) {
    debug('storage.local unavailable, using default settings', error);
    settingsCache = normalizeSettings({});
  }

  return settingsCache;
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

function buildMirroredUrl(sourceUrl, targetUrl) {
  if (!isNormalHttpUrl(sourceUrl) || !isNormalHttpUrl(targetUrl)) return null;

  try {
    const source = new URL(sourceUrl);
    const target = new URL(targetUrl);

    if (!/^https?:$/.test(source.protocol) || !/^https?:$/.test(target.protocol)) return null;
    if (source.origin === target.origin) return source.href;

    return `${target.origin}${source.pathname}${source.search}${source.hash}`;
  } catch (_error) {
    return null;
  }
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

async function ensureContentScript(tabId) {
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

function buildHiddenState(reason = 'Current tab is not in a split screen.') {
  return {
    show: false,
    enabled: false,
    wpAdminBarHidden: false,
    color: 'gray',
    statusText: reason,
    syncNavigation: false,
    mirrorClicks: false,
    mirrorHover: false
  };
}

function buildUiStateForTab(group, tabId, show = true) {
  const enabled = Boolean(group.enabled);
  const reloading = Boolean(group.isReloadingTabs && group.isReloadingTabs[String(tabId)]);
  const hasOffset = Number(group.offsetX || 0) !== 0 || Number(group.offsetY || 0) !== 0;

  let color = 'gray';
  let statusText = 'Sync off';

  if (group.error) {
    color = 'red';
    statusText = group.error;
  } else if (enabled && (reloading || hasOffset)) {
    color = 'orange';
    statusText = reloading ? 'Sync active, pane reloading' : 'Sync active with offset';
  } else if (enabled) {
    color = 'green';
    statusText = 'Sync active';
  }

  return {
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
    wpAdminBarHidden: enabled && Boolean(group.hideWpAdminBar),
    color,
    statusText,
    reloading
  };
}

async function sendHiddenState(tabId, reason) {
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
  const tabIds = targetTabId ? [targetTabId] : groupTabIds(group);
  const show = await shouldShowFloatingUi(group);

  for (const tabId of tabIds) {
    const tab = await safeGetTab(tabId);
    if (!tab || !isNormalHttpUrl(tab.url)) continue;

    const ok = await ensureContentScript(tabId);
    if (!ok) continue;

    await safeSendMessage(tabId, {
      type: MSG.STATE,
      state: buildUiStateForTab(group, tabId, show)
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
    lastKnownScrollX: 0,
    lastKnownScrollY: 0,
    lastSourceTabId: null,
    isReloadingTabs: {},
    navigationLocks: {},
    clickLocks: {},
    leftOrigin: null,
    rightOrigin: null,
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

    state.groups[key] = {
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
      lastKnownScrollX: Number(existing.lastKnownScrollX || 0),
      lastKnownScrollY: Number(existing.lastKnownScrollY || 0),
      lastSourceTabId: existing.lastSourceTabId ?? null,
      isReloadingTabs: existing.isReloadingTabs || {},
      navigationLocks: existing.navigationLocks || {},
      clickLocks: existing.clickLocks || {},
      leftOrigin: getOrigin(leftTab?.url) || existing.leftOrigin || null,
      rightOrigin: getOrigin(rightTab?.url) || existing.rightOrigin || null,
      error: null,
      updatedAt: Date.now()
    };

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

async function getCurrentScroll(tabId) {
  const ok = await ensureContentScript(tabId);
  if (!ok) return null;

  const response = await safeSendMessage(tabId, { type: MSG.GET_SCROLL });
  if (!response || typeof response.scrollX !== 'number' || typeof response.scrollY !== 'number') return null;

  return { scrollX: response.scrollX, scrollY: response.scrollY };
}

async function sendRemoteScroll(group, sourceTabId, targetTabId, scrollX, scrollY) {
  const adjusted = adjustScrollForTarget(group, sourceTabId, targetTabId, scrollX, scrollY);
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

  const current = await getCurrentScroll(sourceTabId);
  if (!current) return false;

  group.lastKnownScrollX = current.scrollX;
  group.lastKnownScrollY = current.scrollY;
  group.lastSourceTabId = sourceTabId;
  scheduleSaveState();

  return sendRemoteScroll(group, sourceTabId, targetTabId, current.scrollX, current.scrollY);
}

async function alignTabToPeer(group, targetTabId) {
  const sourceTabId = getPeerTabId(group, targetTabId);
  if (!sourceTabId) return false;

  const current = await getCurrentScroll(sourceTabId);
  if (current) return sendRemoteScroll(group, sourceTabId, targetTabId, current.scrollX, current.scrollY);

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
  const group = await getGroupForTab(tabId, windowId);
  if (!group) return;

  group.enabled = true;
  group.error = null;
  group.hideWpAdminBar = typeof group.hideWpAdminBar === 'boolean' ? group.hideWpAdminBar : DEFAULT_HIDE_WP_ADMIN_BAR;

  await saveStateNow();
  await sendGroupState(group);
  await alignPeerToSource(group, tabId);
  await sendGroupState(group);
}

async function enableAllSplitViewsInCurrentWindow() {
  const state = await scanWindow(null);
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeWindowId = tabs[0]?.windowId;

  for (const group of Object.values(state.groups)) {
    if (activeWindowId != null && group.windowId !== activeWindowId) continue;
    group.enabled = true;
    group.error = null;
    group.hideWpAdminBar = typeof group.hideWpAdminBar === 'boolean' ? group.hideWpAdminBar : DEFAULT_HIDE_WP_ADMIN_BAR;
  }

  await saveStateNow();

  for (const group of Object.values(state.groups)) {
    if (activeWindowId != null && group.windowId !== activeWindowId) continue;
    await sendGroupState(group);
    const leftScroll = await getCurrentScroll(group.leftTabId);
    if (leftScroll) await sendRemoteScroll(group, group.leftTabId, group.rightTabId, leftScroll.scrollX, leftScroll.scrollY);
    else await alignTabToPeer(group, group.leftTabId);
    await sendGroupState(group);
  }
}

async function stopCurrentSplitView(tabId, windowId) {
  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);
  if (!group) return;

  group.enabled = false;
  group.error = null;
  group.isReloadingTabs = {};
  await saveStateNow();
  await sendGroupState(group);
}

async function stopAllSplitViews() {
  const state = await getState();

  for (const group of Object.values(state.groups)) {
    group.enabled = false;
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
}

async function reloadPane(tabId, windowId, pane, bypassCache) {
  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);

  let targetTabId = tabId;
  if (group && pane === 'left') targetTabId = group.leftTabId;
  if (group && pane === 'right') targetTabId = group.rightTabId;

  if (group) {
    group.isReloadingTabs = group.isReloadingTabs || {};
    group.isReloadingTabs[String(targetTabId)] = true;
    group.error = null;
    await saveStateNow();
    await sendGroupState(group);
  }

  try {
    await chrome.tabs.reload(targetTabId, bypassCache ? { bypassCache: true } : undefined);
  } catch (error) {
    debug('tabs.reload failed', targetTabId, error?.message || error);
    if (group) {
      delete group.isReloadingTabs[String(targetTabId)];
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

  group.lastKnownScrollX = Number(message.scrollX || 0);
  group.lastKnownScrollY = Number(message.scrollY || 0);
  group.lastSourceTabId = tabId;
  group.error = null;
  group.updatedAt = Date.now();
  scheduleSaveState();

  const targetTabId = getPeerTabId(group, tabId);
  if (!targetTabId) return;

  await sendRemoteScroll(group, tabId, targetTabId, group.lastKnownScrollX, group.lastKnownScrollY);
}

async function handleNavigationFromTab(tabId, windowId, sourceUrl) {
  if (!isNormalHttpUrl(sourceUrl)) return;

  await scanWindow(windowId);
  const group = await getGroupForTab(tabId, windowId);
  if (!group) return;

  const side = getSide(group, tabId);
  if (side === 'left') group.leftOrigin = getOrigin(sourceUrl) || group.leftOrigin;
  if (side === 'right') group.rightOrigin = getOrigin(sourceUrl) || group.rightOrigin;

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

  const targetTab = await safeGetTab(targetTabId);
  if (!targetTab || !isNormalHttpUrl(targetTab.url)) return;

  const targetUrl = buildMirroredUrl(sourceUrl, targetTab.url);
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
  if (!group || !group.mirrorClicks) return;

  const targetTabId = getPeerTabId(group, tabId);
  if (!targetTabId) return;

  const ok = await ensureContentScript(targetTabId);
  if (!ok) return;

  await safeSendMessage(targetTabId, {
    type: MSG.REMOTE_CLICK,
    sourceTabId: tabId,
    groupKey: group.groupKey,
    click: message.click || {},
    timestamp: Date.now()
  });
}

async function handleHoverMessage(sender, message) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group || !group.mirrorHover) return;

  const targetTabId = getPeerTabId(group, tabId);
  if (!targetTabId) return;

  const ok = await ensureContentScript(targetTabId);
  if (!ok) return;

  await safeSendMessage(targetTabId, {
    type: MSG.REMOTE_HOVER,
    sourceTabId: tabId,
    groupKey: group.groupKey,
    hover: message.hover || {},
    timestamp: Date.now()
  });
}

async function handleHoverClearMessage(sender) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

  const group = await getGroupForTab(tabId, windowId);
  if (!group || !group.mirrorHover) return;

  const targetTabId = getPeerTabId(group, tabId);
  if (!targetTabId) return;

  await safeSendMessage(targetTabId, {
    type: MSG.REMOTE_HOVER_CLEAR,
    sourceTabId: tabId,
    groupKey: group.groupKey,
    timestamp: Date.now()
  });
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

  const show = await shouldShowFloatingUi(group);
  const state = buildUiStateForTab(group, tabId, show);
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

  if (typeof message.scrollX === 'number') group.lastKnownScrollX = message.scrollX;
  if (typeof message.scrollY === 'number') group.lastKnownScrollY = message.scrollY;
  if (isNormalHttpUrl(message.url)) {
    const side = getSide(group, tabId);
    if (side === 'left') group.leftOrigin = getOrigin(message.url) || group.leftOrigin;
    if (side === 'right') group.rightOrigin = getOrigin(message.url) || group.rightOrigin;
  }

  await saveStateNow();
  await sendGroupState(group, tabId);

  if (group.enabled) {
    await alignTabToPeer(group, tabId);
    await sendGroupState(group, tabId);
  }
}

async function handleUiCommand(sender, command, message = {}) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;
  if (typeof tabId !== 'number' || typeof windowId !== 'number') return;

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
    default:
      debug('Unknown UI command', command);
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0] || null;
}

async function getPopupStatus() {
  const settings = await getSettings();
  const activeTab = await getActiveTab();

  if (!activeTab?.id || typeof activeTab.windowId !== 'number' || !isNormalHttpUrl(activeTab.url)) {
    return {
      ok: true,
      settings,
      isInValidSplitView: false,
      canShowCurrent: false,
      hint: 'Current tab is not in a split screen.'
    };
  }

  await scanWindow(activeTab.windowId);
  const group = await getGroupForTab(activeTab.id, activeTab.windowId);
  const buttonShownForCurrent = group ? await shouldShowFloatingUi(group) : false;
  const manualButtonOverride = group ? await getManualButtonOverride(group.groupKey) : 'default';

  return {
    ok: true,
    settings,
    isInValidSplitView: Boolean(group),
    canShowCurrent: Boolean(group),
    buttonShownForCurrent,
    manualButtonOverride,
    hint: group ? '' : 'Current tab is not in a split screen.'
  };
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message || typeof message.type !== 'string') {
      sendResponse({ ok: false });
      return;
    }

    if (message.type === MSG.READY) {
      await handleReadyMessage(sender, message);
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
      const allowed = ['defaultHideWpAdminBar', 'defaultSyncNavigation', 'defaultMirrorClicks', 'defaultMirrorHover'];
      for (const field of allowed) {
        if (typeof incoming[field] === 'boolean') next[field] = incoming[field];
      }
      await saveSettings(next);
      sendResponse(await getPopupStatus());
      return;
    }

    if (message.type === MSG.POPUP_SHOW_BUTTON_CURRENT) {
      sendResponse(await toggleButtonForCurrentSplit());
      return;
    }

    sendResponse({ ok: false });
  })().catch((error) => {
    debug('onMessage error', error);
    sendResponse({ ok: false, error: error?.message || String(error) });
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
      default:
        debug('Unknown command', command);
    }
  })().catch((error) => debug('commands.onCommand error', error));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  (async () => {
    if (!tab || typeof tab.windowId !== 'number') return;

    if (changeInfo.splitViewId !== undefined || changeInfo.url !== undefined) {
      await refreshWindowUi(tab.windowId);
    }

    if (changeInfo.url && isNormalHttpUrl(changeInfo.url)) {
      await handleNavigationFromTab(tabId, tab.windowId, changeInfo.url);
    }

    if (changeInfo.status === 'loading') {
      const group = await getGroupForTab(tabId, tab.windowId);
      if (group?.enabled) {
        group.isReloadingTabs = group.isReloadingTabs || {};
        group.isReloadingTabs[String(tabId)] = true;
        group.error = null;
        await saveStateNow();
        await sendGroupState(group);
      }
    }

    if (changeInfo.status === 'complete') {
      await scanWindow(tab.windowId);
      const group = await getGroupForTab(tabId, tab.windowId);

      if (!group) {
        if (isNormalHttpUrl(tab.url)) await sendHiddenState(tabId);
        return;
      }

      group.isReloadingTabs = group.isReloadingTabs || {};
      delete group.isReloadingTabs[String(tabId)];
      group.error = null;
      await saveStateNow();

      if (isNormalHttpUrl(tab.url)) {
        await ensureContentScript(tabId);
        await sendGroupState(group, tabId);
        if (group.enabled) await alignTabToPeer(group, tabId);
      }

      await sendGroupState(group);
    }
  })().catch((error) => debug('tabs.onUpdated error', error));
});

chrome.tabs.onRemoved.addListener((tabId) => {
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

chrome.runtime.onInstalled.addListener(() => {
  Promise.all([getState().then(saveStateNow), getSettings().then(saveSettings)])
    .catch((error) => debug('onInstalled error', error));
});

chrome.runtime.onStartup.addListener(() => {
  Promise.all([getState(), getSettings()]).catch((error) => debug('onStartup error', error));
});
