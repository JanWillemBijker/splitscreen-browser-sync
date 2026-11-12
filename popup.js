'use strict';

const MSG = Object.freeze({
  POPUP_GET_STATUS: 'SVSS_POPUP_GET_STATUS',
  POPUP_SET_ALWAYS_SHOW: 'SVSS_POPUP_SET_ALWAYS_SHOW',
  POPUP_SET_DEFAULTS: 'SVSS_POPUP_SET_DEFAULTS',
  POPUP_SHOW_BUTTON_CURRENT: 'SVSS_POPUP_SHOW_BUTTON_CURRENT',
  POPUP_SET_SYNC: 'SVSS_POPUP_SET_SYNC',
  POPUP_SET_GROUP_OPTION: 'SVSS_POPUP_SET_GROUP_OPTION',
  POPUP_SET_GROUP_CHOICE: 'SVSS_POPUP_SET_GROUP_CHOICE',
  POPUP_SET_PANE_WIDTH: 'SVSS_POPUP_SET_PANE_WIDTH',
  POPUP_OVERLAY_SET: 'SVSS_POPUP_OVERLAY_SET',
  POPUP_OVERLAY_REFRESH: 'SVSS_POPUP_OVERLAY_REFRESH',
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
  POPUP_RULER_ADD: 'SVSS_POPUP_RULER_ADD'
});

const $ = (id) => document.getElementById(id);

const root = document.querySelector('.popup');
const statusTitle = $('statusTitle');
const statusBody = $('statusBody');
const statusMeta = $('statusMeta');
const syncToggle = $('syncToggle');
const emptySteps = $('emptySteps');
const currentGroup = $('currentGroup');
const alwaysShow = $('alwaysShow');
const showCurrent = $('showCurrent');
const addRuler = $('addRuler');
const groupOptionInputs = Array.from(document.querySelectorAll('[data-group-option]'));
const groupChoiceInputs = Array.from(document.querySelectorAll('[data-group-choice]'));
// Defaults with a fixed set of values (select elements).
const defaultChoices = [
  { el: $('defaultAlignMode'), key: 'defaultAlignMode', fallback: 'pixel' }
];

// Per-group option defaults applied to each new split screen pairing.
// Each entry maps a checkbox element to the settings field that stores it.
const defaultToggles = [
  { el: $('defaultHideWpAdminBar'), key: 'defaultHideWpAdminBar', fallbackOn: true },
  { el: $('defaultSyncNavigation'), key: 'defaultSyncNavigation', fallbackOn: true },
  { el: $('defaultMirrorClicks'), key: 'defaultMirrorClicks', fallbackOn: false },
  { el: $('defaultMirrorHover'), key: 'defaultMirrorHover', fallbackOn: true },
  { el: $('defaultShowCursor'), key: 'defaultShowCursor', fallbackOn: true },
  { el: $('defaultSyncContainers'), key: 'defaultSyncContainers', fallbackOn: true },
  { el: $('defaultSyncZoom'), key: 'defaultSyncZoom', fallbackOn: true },
  { el: $('defaultSyncInput'), key: 'defaultSyncInput', fallbackOn: false }
];

let busy = false;
let lastStatus = null;

function t(key, substitutions) {
  try {
    return chrome.i18n.getMessage(key, substitutions) || '';
  } catch (_error) {
    return '';
  }
}

function localize() {
  const lang = chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage() : 'en';
  document.documentElement.lang = String(lang || 'en').split('-')[0];
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const text = t(el.dataset.i18n);
    if (text) el.textContent = text;
  }
  for (const el of document.querySelectorAll('[data-i18n-aria]')) {
    const text = t(el.dataset.i18nAria);
    if (text) el.setAttribute('aria-label', text);
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const text = t(el.dataset.i18nPlaceholder);
    if (text) el.setAttribute('placeholder', text);
  }
}

// ---- Tabs ------------------------------------------------------------------
// WAI-ARIA tabs with automatic activation: arrow keys / Home / End move
// between tabs. The last chosen tab is remembered for this browser only.

const TAB_STORE_KEY = 'svssPopupTab';
const tabButtons = () => Array.from(document.querySelectorAll('[role="tab"]'));

function selectTab(name, { focus = false } = {}) {
  const buttons = tabButtons();
  const target = buttons.find((b) => b.dataset.tab === name) || buttons[0];
  for (const button of buttons) {
    const selected = button === target;
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    button.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    if (panel) panel.hidden = !selected;
  }
  if (focus) target.focus();
  try { localStorage.setItem(TAB_STORE_KEY, target.dataset.tab); } catch (_error) { /* optional */ }
  document.dispatchEvent(new CustomEvent('svss-tab', { detail: target.dataset.tab }));
}

function currentTab() {
  return tabButtons().find((b) => b.getAttribute('aria-selected') === 'true')?.dataset.tab || 'sync';
}

for (const button of tabButtons()) {
  button.addEventListener('click', () => selectTab(button.dataset.tab));
  button.addEventListener('keydown', (event) => {
    const buttons = tabButtons();
    const index = buttons.indexOf(button);
    let next = null;
    if (event.key === 'ArrowRight') next = buttons[(index + 1) % buttons.length];
    else if (event.key === 'ArrowLeft') next = buttons[(index - 1 + buttons.length) % buttons.length];
    else if (event.key === 'Home') next = buttons[0];
    else if (event.key === 'End') next = buttons[buttons.length - 1];
    if (!next) return;
    event.preventDefault();
    selectTab(next.dataset.tab, { focus: true });
  });
}

function restoreTab() {
  let saved = null;
  try { saved = localStorage.getItem(TAB_STORE_KEY); } catch (_error) { saved = null; }
  selectTab(saved || 'sync');
}

async function sendMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (_error) {
    return null;
  }
}

function formatSigned(value) {
  const n = Math.round(Number(value) || 0);
  return n > 0 ? `+${n}` : String(n);
}

// One of: synced, paused, origin-paused, reloading, error, no-split, unsupported.
function resolveState(status) {
  if (!status) return 'no-split';
  if (!status.isInValidSplitView) return status.reason === 'unsupported-page' ? 'unsupported' : 'no-split';
  const group = status.group || {};
  if (group.error) return 'error';
  if (group.enabled && group.reloading) return 'reloading';
  if (!group.enabled && group.pauseReason === 'origin-changed') return 'origin-paused';
  return group.enabled ? 'synced' : 'paused';
}

const STATE_COPY = {
  synced: ['statusSyncedTitle', 'statusSyncedBody'],
  paused: ['statusPausedTitle', 'statusPausedBody'],
  'origin-paused': ['statusOriginPausedTitle', 'statusOriginPausedBody'],
  reloading: ['statusReloadingTitle', 'statusReloadingBody'],
  error: ['statusErrorTitle', 'statusErrorBody'],
  'no-split': ['statusNoSplitTitle', 'statusNoSplitBody'],
  unsupported: ['statusUnsupportedTitle', 'statusUnsupportedBody']
};

function renderStatus(status) {
  if (!status) status = lastStatus;
  lastStatus = status;

  const settings = status?.settings || {};
  alwaysShow.checked = settings.alwaysShowButtonOnSplitScreen !== false;

  for (const { el, key, fallbackOn } of defaultToggles) {
    if (!el) continue;
    const value = settings[key];
    el.checked = typeof value === 'boolean' ? value : fallbackOn;
  }

  for (const { el, key, fallback } of defaultChoices) {
    if (el) el.value = typeof settings[key] === 'string' ? settings[key] : fallback;
  }

  const state = resolveState(status);
  const inSplit = Boolean(status?.isInValidSplitView);
  const group = status?.group || {};
  root.dataset.state = state;

  const [titleKey, bodyKey] = STATE_COPY[state];
  statusTitle.textContent = t(titleKey);
  statusBody.textContent = t(bodyKey);

  const offset = Number(group.offsetY || 0);
  statusMeta.hidden = !(inSplit && offset !== 0);
  statusMeta.textContent = statusMeta.hidden ? '' : t('metaOffset', [formatSigned(offset)]);

  syncToggle.hidden = !inSplit;
  const enabled = Boolean(group.enabled);
  syncToggle.textContent = t(enabled ? 'btnStopSync' : 'btnStartSync');
  syncToggle.classList.toggle('btn-primary', !enabled);
  syncToggle.classList.toggle('btn-secondary', enabled);
  syncToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');

  emptySteps.hidden = state !== 'no-split';
  currentGroup.hidden = !inSplit;

  for (const input of groupOptionInputs) {
    input.checked = Boolean(group[input.dataset.groupOption]);
  }
  for (const select of groupChoiceInputs) {
    if (typeof group[select.dataset.groupChoice] === 'string') select.value = group[select.dataset.groupChoice];
  }

  for (const el of document.querySelectorAll('[data-needs-pair]')) el.hidden = !inSplit;
  for (const el of document.querySelectorAll('[data-need-pair-hint]')) el.hidden = inSplit;
  renderPaneSizes(group.paneSizes || {});
  if (inSplit && currentTab() === 'checklist') loadChecklist();
  renderOverlay(group);

  showCurrent.disabled = !inSplit;
  addRuler.disabled = !inSplit;
  showCurrent.textContent = t(status?.buttonShownForCurrent ? 'btnHidePanel' : 'btnShowPanel');
}

function formatSize(size) {
  return size && size.w && size.h ? `${size.w} × ${size.h}` : t('paneSizeUnknown');
}

function renderPaneSizes(sizes) {
  $('sizeLeft').textContent = formatSize(sizes.left);
  $('sizeRight').textContent = formatSize(sizes.right);
}

async function run(message) {
  if (busy) {
    // Undo the optimistic checkbox flip; the running request will re-render.
    renderStatus(lastStatus);
    return;
  }
  busy = true;
  root.setAttribute('aria-busy', 'true');
  try {
    const status = await sendMessage(message);
    if (status && status.ok !== false && status.settings) renderStatus(status);
    else await refresh();
  } finally {
    busy = false;
    root.removeAttribute('aria-busy');
  }
}

async function refresh() {
  renderStatus(await sendMessage({ type: MSG.POPUP_GET_STATUS }));
}

syncToggle.addEventListener('click', () => {
  const enabled = Boolean(lastStatus?.group?.enabled);
  run({ type: MSG.POPUP_SET_SYNC, value: !enabled });
});

for (const input of groupOptionInputs) {
  input.addEventListener('change', () => {
    run({ type: MSG.POPUP_SET_GROUP_OPTION, option: input.dataset.groupOption, value: input.checked });
  });
}

for (const select of groupChoiceInputs) {
  select.addEventListener('change', () => {
    run({ type: MSG.POPUP_SET_GROUP_CHOICE, option: select.dataset.groupChoice, value: select.value });
  });
}

for (const { el, key } of defaultChoices) {
  if (!el) continue;
  el.addEventListener('change', () => {
    run({ type: MSG.POPUP_SET_DEFAULTS, defaults: { [key]: el.value } });
  });
}

alwaysShow.addEventListener('change', () => {
  run({ type: MSG.POPUP_SET_ALWAYS_SHOW, value: alwaysShow.checked });
});

for (const { el, key } of defaultToggles) {
  if (!el) continue;
  el.addEventListener('change', () => {
    run({ type: MSG.POPUP_SET_DEFAULTS, defaults: { [key]: el.checked } });
  });
}

showCurrent.addEventListener('click', () => {
  run({ type: MSG.POPUP_SHOW_BUTTON_CURRENT });
});

addRuler.addEventListener('click', async () => {
  await sendMessage({ type: MSG.POPUP_RULER_ADD });
  await refresh();
});

for (const button of document.querySelectorAll('[data-preset]')) {
  button.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    root.setAttribute('aria-busy', 'true');
    const side = document.querySelector('input[name="presetSide"]:checked')?.value === 'right' ? 'right' : 'left';
    const result = $('presetResult');
    result.textContent = '';
    try {
      const response = await sendMessage({ type: MSG.POPUP_SET_PANE_WIDTH, side, width: Number(button.dataset.preset) });
      if (response?.status) renderStatus(response.status);
      const sideText = t(side === 'right' ? 'sideRightLower' : 'sideLeftLower');
      if (!response?.ok || !response.width) result.textContent = t('presetFailed');
      else result.textContent = t(response.reached ? 'presetReached' : 'presetLimited', [sideText, String(response.width)]);
    } finally {
      busy = false;
      root.removeAttribute('aria-busy');
    }
  });
}

// ---- Overlay --------------------------------------------------------------------
// Capturing a tab needs the optional '<all_urls>' permission. It is requested
// straight from the click (Chrome requires a user gesture), before anything
// else is awaited.

const CAPTURE_PERMISSION = { origins: ['<all_urls>'] };
let capturePermission = false;
let opacityTimer = null;

async function refreshCapturePermission() {
  try { capturePermission = await chrome.permissions.contains(CAPTURE_PERMISSION); } catch (_error) { capturePermission = false; }
  renderOverlay(lastStatus?.group || {});
}

function renderOverlay(group) {
  const o = group.overlay || {};
  const enabled = Boolean(group.enabled);
  $('overlayPermission').hidden = capturePermission;
  $('overlayNeedSync').hidden = !capturePermission || enabled;
  const usable = capturePermission && enabled;
  $('overlayControls').hidden = !usable;
  $('overlayRefresh').parentElement.hidden = !usable || !o.on;
  $('overlayOn').checked = Boolean(o.on);
  for (const radio of document.querySelectorAll('input[name="overlaySide"]')) {
    radio.checked = o.target ? radio.value === o.target : false;
  }
  const opacity = Math.round((Number(o.opacity) || 0.5) * 100);
  if (document.activeElement !== $('overlayOpacity') && !opacityTimer) $('overlayOpacity').value = String(opacity);
  $('overlayOpacityValue').textContent = `${$('overlayOpacity').value}%`;
  $('overlayDifference').checked = o.blend === 'difference';
  $('overlaySwipe').checked = Boolean(o.swipe);
  for (const id of ['overlayOpacity', 'overlayDifference', 'overlaySwipe']) $(id).disabled = !o.on;
}

async function setOverlay(patch) {
  const response = await sendMessage({ type: MSG.POPUP_OVERLAY_SET, overlay: patch });
  if (response?.status) renderStatus(response.status);
  $('overlayResult').textContent = response && response.ok === false && response.reason === 'permission' ? t('overlayDeclined') : '';
  return response;
}

$('allowCapture').addEventListener('click', async () => {
  let granted = false;
  try { granted = await chrome.permissions.request(CAPTURE_PERMISSION); } catch (_error) { granted = false; }
  $('overlayResult').textContent = granted ? '' : t('overlayDeclined');
  await refreshCapturePermission();
});

$('overlayOn').addEventListener('change', () => {
  const side = document.querySelector('input[name="overlaySide"]:checked')?.value;
  setOverlay({ on: $('overlayOn').checked, ...(side ? { side } : {}) });
});

for (const radio of document.querySelectorAll('input[name="overlaySide"]')) {
  radio.addEventListener('change', () => setOverlay({ side: radio.value, on: true }));
}

$('overlayOpacity').addEventListener('input', () => {
  $('overlayOpacityValue').textContent = `${$('overlayOpacity').value}%`;
  if (opacityTimer) clearTimeout(opacityTimer);
  const opacity = Number($('overlayOpacity').value) / 100;
  opacityTimer = setTimeout(() => {
    opacityTimer = null;
    setOverlay({ opacity });
  }, 120);
});

$('overlayDifference').addEventListener('change', () => setOverlay({ blend: $('overlayDifference').checked ? 'difference' : 'normal' }));
$('overlaySwipe').addEventListener('change', () => setOverlay($('overlaySwipe').checked ? { swipe: true, opacity: 1 } : { swipe: false }));
$('overlayRefresh').addEventListener('click', () => sendMessage({ type: MSG.POPUP_OVERLAY_REFRESH }));

if (chrome.permissions?.onAdded) chrome.permissions.onAdded.addListener(() => refreshCapturePermission());
if (chrome.permissions?.onRemoved) chrome.permissions.onRemoved.addListener(() => refreshCapturePermission());

// ---- History of pairs ------------------------------------------------------------

let historyItems = [];
let renamingId = null;

const ICONS = {
  star: 'M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z',
  pencil: 'M10.8 2.6l2.6 2.6-7.6 7.6-3.2.6.6-3.2zM9.4 4l2.6 2.6',
  cross: 'M4 4l8 8M12 4l-8 8'
};

function icon(pathData) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  return svg;
}

function iconButton(pathData, label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-btn';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.appendChild(icon(pathData));
  button.addEventListener('click', onClick);
  return button;
}

function pairTitle(entry) {
  return entry.name || `${hostOf(entry.left.origin)} ↔ ${hostOf(entry.right.origin)}`;
}

function renderHistory(data) {
  if (data) {
    historyItems = Array.isArray(data.history) ? data.history : [];
    if (typeof data.rememberPairs === 'boolean') $('rememberPairs').checked = data.rememberPairs;
  }
  const list = $('historyList');
  list.textContent = '';
  $('historyEmpty').hidden = historyItems.length > 0;
  for (const entry of historyItems) {
    const li = document.createElement('li');
    li.className = 'hist-item';
    if (renamingId === entry.id) {
      const form = document.createElement('form');
      form.className = 'hist-rename';
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 60;
      input.value = entry.name || '';
      input.placeholder = `${hostOf(entry.left.origin)} ↔ ${hostOf(entry.right.origin)}`;
      input.setAttribute('aria-label', t('historyNameLabel'));
      const save = document.createElement('button');
      save.type = 'submit';
      save.className = 'btn btn-secondary btn-small';
      save.textContent = t('btnSave');
      form.append(input, save);
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        renamingId = null;
        renderHistory(await sendMessage({ type: MSG.POPUP_HISTORY_UPDATE, id: entry.id, name: input.value }));
      });
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        renamingId = null;
        renderHistory();
      });
      li.appendChild(form);
      list.appendChild(li);
      setTimeout(() => input.focus(), 0);
      continue;
    }
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'hist-open';
    const name = document.createElement('span');
    name.className = 'hist-name';
    name.textContent = pairTitle(entry);
    const sub = document.createElement('span');
    sub.className = 'hist-sub';
    sub.textContent = entry.name
      ? `${hostOf(entry.left.origin)}${entry.left.path} · ${hostOf(entry.right.origin)}${entry.right.path}`
      : `${entry.left.path} · ${entry.right.path}`;
    open.append(name, sub);
    open.setAttribute('aria-label', t('historyOpenLabel', [pairTitle(entry)]));
    open.title = `${entry.left.origin}${entry.left.path}\n${entry.right.origin}${entry.right.path}`;
    open.addEventListener('click', () => openHistory(entry.id));

    const pin = iconButton(ICONS.star, t(entry.pinned ? 'historyUnpin' : 'historyPin'), async () => {
      renderHistory(await sendMessage({ type: MSG.POPUP_HISTORY_UPDATE, id: entry.id, pinned: !entry.pinned }));
    });
    pin.setAttribute('aria-pressed', entry.pinned ? 'true' : 'false');
    const rename = iconButton(ICONS.pencil, t('historyRename'), () => {
      renamingId = entry.id;
      renderHistory();
    });
    const remove = iconButton(ICONS.cross, t('historyDelete'), async () => {
      renderHistory(await sendMessage({ type: MSG.POPUP_HISTORY_DELETE, id: entry.id }));
    });
    li.append(open, pin, rename, remove);
    list.appendChild(li);
  }
}

async function openHistory(id) {
  $('historyResult').textContent = '';
  const response = await sendMessage({ type: MSG.POPUP_HISTORY_OPEN, id });
  if (!response) return; // the popup may close when a new tab opens
  renderHistory(response);
  const mode = response.result?.mode;
  const key = !response.result?.ok ? 'historyFailed'
    : mode === 'manual' ? 'historyManual'
      : mode === 'created' ? 'historyCreated' : 'historyReused';
  $('historyResult').textContent = t(key);
}

async function loadHistory() {
  renderHistory(await sendMessage({ type: MSG.POPUP_HISTORY_GET }));
}

$('rememberPairs').addEventListener('change', async () => {
  renderHistory(await sendMessage({ type: MSG.POPUP_SET_REMEMBER_PAIRS, value: $('rememberPairs').checked }));
});

$('clearHistory').addEventListener('click', async () => {
  renderHistory(await sendMessage({ type: MSG.POPUP_HISTORY_CLEAR, keepPinned: true }));
  $('clearHistoryResult').textContent = t('historyCleared');
});

// ---- Checklist tab --------------------------------------------------------------

let checklist = null;
let noteTimer = null;
let clearArmed = false;
const STATUS_KEYS = { ok: 'statusOk', fail: 'statusFail', na: 'statusNa' };

function hostOf(origin) {
  try { return new URL(origin).host; } catch (_error) { return ''; }
}

function setChecklistResult(text) {
  $('checklistResult').textContent = text || '';
}

function renderChecklist(data) {
  if (data) checklist = data;
  const c = checklist;
  if (!c || !c.available) return;
  const items = Array.isArray(c.items) ? c.items : [];
  const index = Number.isInteger(c.index) ? c.index : -1;
  const done = items.filter((item) => item.status).length;
  const fails = items.filter((item) => item.status === 'fail').length;

  $('checklistOrigins').textContent = [hostOf(c.leftOrigin), hostOf(c.rightOrigin)].filter(Boolean).join(' ↔ ');
  $('checklistEmpty').hidden = items.length > 0;
  $('checklistProgressWrap').hidden = !items.length;
  $('checklistCurrent').hidden = !items.length;
  $('checklistListWrap').hidden = !items.length;
  $('checklistExport').hidden = !items.length;

  $('checklistProgress').textContent = t('checklistProgress', [String(done), String(items.length)]);
  $('checklistFails').textContent = fails ? t('checklistFailCount', [String(fails)]) : '';
  const bar = $('checklistBar');
  bar.setAttribute('aria-valuemax', String(items.length));
  bar.setAttribute('aria-valuenow', String(done));
  bar.setAttribute('aria-valuetext', $('checklistProgress').textContent);
  $('checklistBarFill').style.width = items.length ? `${Math.round((done / items.length) * 100)}%` : '0';

  const current = items[index] || null;
  $('checklistPos').textContent = current ? t('checklistPosition', [String(index + 1), String(items.length)]) : '';
  $('checklistPath').textContent = current ? current.path : '';
  $('checklistPath').hidden = !current;
  const hint = !c.canNavigate ? t('checklistNeedSync') : (current ? '' : t('checklistNoCurrent'));
  $('checklistHint').textContent = hint;
  $('checklistHint').hidden = !hint;
  $('checklistPrev').disabled = !c.canNavigate || index <= 0;
  $('checklistNext').disabled = !c.canNavigate || index >= items.length - 1;
  for (const chip of document.querySelectorAll('#checklistStatus .chip')) {
    chip.disabled = !current;
    chip.setAttribute('aria-pressed', current && current.status === chip.dataset.status ? 'true' : 'false');
  }
  const note = $('checklistNote');
  note.disabled = !current;
  if (document.activeElement !== note) note.value = current ? current.note || '' : '';

  const list = $('checklistList');
  const focusedIndex = document.activeElement?.closest?.('.check-item')?.dataset.index ?? null;
  const focusedRole = document.activeElement?.dataset?.role || null;
  list.textContent = '';
  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'check-item';
    li.dataset.index = String(i);
    if (i === index) li.setAttribute('aria-current', 'true');
    const dot = document.createElement('span');
    dot.className = 'check-dot';
    if (item.status) dot.dataset.status = item.status;
    dot.setAttribute('role', 'img');
    dot.setAttribute('aria-label', t(item.status ? STATUS_KEYS[item.status] : 'statusOpen'));
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'check-open';
    open.dataset.role = 'open';
    open.textContent = item.path;
    open.title = item.note ? `${item.path} · ${item.note}` : item.path;
    open.setAttribute('aria-label', t('checklistOpen', [item.path]));
    open.disabled = !c.canNavigate;
    open.addEventListener('click', () => checklistCall({ type: MSG.POPUP_CHECKLIST_GO, index: i }));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'check-remove';
    remove.dataset.role = 'remove';
    remove.setAttribute('aria-label', t('checklistRemove', [item.path]));
    remove.appendChild(crossIcon());
    remove.addEventListener('click', () => checklistCall({ type: MSG.POPUP_CHECKLIST_REMOVE, index: i }));
    li.append(dot, open, remove);
    list.appendChild(li);
  });
  if (focusedIndex !== null && focusedRole) {
    const again = list.querySelector(`.check-item[data-index="${focusedIndex}"] [data-role="${focusedRole}"]`)
      || list.querySelector(`.check-item:last-child [data-role="${focusedRole}"]`);
    if (again) again.focus();
  }
}

function crossIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 10 10');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M1 1l8 8M9 1L1 9');
  svg.appendChild(path);
  return svg;
}

async function checklistCall(message) {
  const data = await sendMessage(message);
  if (data && data.ok) renderChecklist(data);
  return data;
}

async function loadChecklist() {
  await checklistCall({ type: MSG.POPUP_CHECKLIST_GET });
}

function currentChecklistIndex() {
  return checklist && Number.isInteger(checklist.index) ? checklist.index : -1;
}

$('checklistPrev').addEventListener('click', () => checklistCall({ type: MSG.POPUP_CHECKLIST_GO, step: -1 }));
$('checklistNext').addEventListener('click', () => checklistCall({ type: MSG.POPUP_CHECKLIST_GO, step: 1 }));

for (const chip of document.querySelectorAll('#checklistStatus .chip')) {
  chip.addEventListener('click', () => {
    const index = currentChecklistIndex();
    const item = checklist?.items?.[index];
    if (!item) return;
    const status = item.status === chip.dataset.status ? null : chip.dataset.status;
    checklistCall({ type: MSG.POPUP_CHECKLIST_UPDATE, index, status });
  });
}

$('checklistNote').addEventListener('input', () => {
  if (noteTimer) clearTimeout(noteTimer);
  const index = currentChecklistIndex();
  const note = $('checklistNote').value;
  noteTimer = setTimeout(() => {
    noteTimer = null;
    checklistCall({ type: MSG.POPUP_CHECKLIST_UPDATE, index, note });
  }, 400);
});

$('checklistAdd').addEventListener('click', async () => {
  const paste = $('checklistPaste');
  const data = await checklistCall({ type: MSG.POPUP_CHECKLIST_ADD, text: paste.value });
  if (data?.ok) {
    paste.value = '';
    setChecklistResult(t('checklistAdded', [String(data.added || 0)]));
  }
});

$('checklistAddCurrent').addEventListener('click', async () => {
  const data = await checklistCall({ type: MSG.POPUP_CHECKLIST_ADD_CURRENT });
  if (data?.ok) setChecklistResult(t('checklistAdded', [String(data.added || 0)]));
});

$('checklistClear').addEventListener('click', async () => {
  const button = $('checklistClear');
  if (!clearArmed) {
    clearArmed = true;
    button.textContent = t('btnClearConfirm');
    setTimeout(() => {
      clearArmed = false;
      button.textContent = t('btnClearList');
    }, 3000);
    return;
  }
  clearArmed = false;
  button.textContent = t('btnClearList');
  await checklistCall({ type: MSG.POPUP_CHECKLIST_CLEAR });
});

function statusLabel(status) {
  return status ? t(STATUS_KEYS[status]) : '';
}

function urlOn(origin, path) {
  try { return new URL(path, origin).href; } catch (_error) { return ''; }
}

// Spreadsheet apps run cells that start with = + - @ as formulas; a leading
// apostrophe keeps them as text.
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function checklistCsv() {
  const c = checklist;
  const rows = [t('csvHeader')];
  c.items.forEach((item, i) => {
    rows.push([
      i + 1,
      item.path,
      statusLabel(item.status),
      item.note || '',
      urlOn(c.leftOrigin, item.path),
      urlOn(c.rightOrigin, item.path)
    ].map(csvCell).join(','));
  });
  return `\ufeff${rows.join('\r\n')}\r\n`;
}

function checklistText() {
  const c = checklist;
  const marks = { ok: '✓', fail: '✗', na: '–' };
  const lines = [[hostOf(c.leftOrigin), hostOf(c.rightOrigin)].filter(Boolean).join(' ↔ ')];
  for (const item of c.items) {
    const mark = item.status ? marks[item.status] : '○';
    const label = item.status ? ` (${statusLabel(item.status)})` : '';
    lines.push(`${mark} ${item.path}${label}${item.note ? ` — ${item.note}` : ''}`);
  }
  lines.push('', t('checklistProgress', [String(c.items.filter((i) => i.status).length), String(c.items.length)]));
  return lines.join('\n');
}

$('checklistCsv').addEventListener('click', () => {
  if (!checklist?.items?.length) return;
  const blob = new Blob([checklistCsv()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  const host = hostOf(checklist.rightOrigin || checklist.leftOrigin).replace(/[^a-z0-9.-]/gi, '_') || 'pages';
  link.href = url;
  link.download = `checklist-${host}-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

$('checklistCopy').addEventListener('click', async () => {
  if (!checklist?.items?.length) return;
  try {
    await navigator.clipboard.writeText(checklistText());
    setChecklistResult(t('checklistCopied'));
  } catch (_error) {
    setChecklistResult('');
  }
});

document.addEventListener('svss-tab', (event) => {
  if (event.detail === 'checklist') loadChecklist();
});

$('openShortcuts').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }).catch(() => undefined);
});

$('version').textContent = `v${chrome.runtime.getManifest().version}`;
localize();
restoreTab();
refresh();
loadHistory();
refreshCapturePermission();
