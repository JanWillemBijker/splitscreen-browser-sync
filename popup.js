'use strict';

const MSG = Object.freeze({
  POPUP_GET_STATUS: 'SVSS_POPUP_GET_STATUS',
  POPUP_SET_ALWAYS_SHOW: 'SVSS_POPUP_SET_ALWAYS_SHOW',
  POPUP_SET_DEFAULTS: 'SVSS_POPUP_SET_DEFAULTS',
  POPUP_SHOW_BUTTON_CURRENT: 'SVSS_POPUP_SHOW_BUTTON_CURRENT',
  POPUP_SET_SYNC: 'SVSS_POPUP_SET_SYNC',
  POPUP_SET_GROUP_OPTION: 'SVSS_POPUP_SET_GROUP_OPTION',
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

// Per-group option defaults applied to each new split screen pairing.
// Each entry maps a checkbox element to the settings field that stores it.
const defaultToggles = [
  { el: $('defaultHideWpAdminBar'), key: 'defaultHideWpAdminBar', fallbackOn: true },
  { el: $('defaultSyncNavigation'), key: 'defaultSyncNavigation', fallbackOn: true },
  { el: $('defaultMirrorClicks'), key: 'defaultMirrorClicks', fallbackOn: false },
  { el: $('defaultMirrorHover'), key: 'defaultMirrorHover', fallbackOn: true },
  { el: $('defaultShowCursor'), key: 'defaultShowCursor', fallbackOn: true }
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

  showCurrent.disabled = !inSplit;
  addRuler.disabled = !inSplit;
  showCurrent.textContent = t(status?.buttonShownForCurrent ? 'btnHidePanel' : 'btnShowPanel');
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

$('openShortcuts').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }).catch(() => undefined);
});

$('version').textContent = `v${chrome.runtime.getManifest().version}`;
localize();
refresh();
