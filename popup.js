'use strict';

const MSG = Object.freeze({
  POPUP_GET_STATUS: 'SVSS_POPUP_GET_STATUS',
  POPUP_SET_ALWAYS_SHOW: 'SVSS_POPUP_SET_ALWAYS_SHOW',
  POPUP_SET_DEFAULTS: 'SVSS_POPUP_SET_DEFAULTS',
  POPUP_SHOW_BUTTON_CURRENT: 'SVSS_POPUP_SHOW_BUTTON_CURRENT',
  POPUP_RULER_ADD: 'SVSS_POPUP_RULER_ADD'
});

const alwaysShow = document.getElementById('alwaysShow');
const showCurrent = document.getElementById('showCurrent');
const addRuler = document.getElementById('addRuler');
const hint = document.getElementById('hint');
const statusText = document.getElementById('statusText');
const footerMeta = document.getElementById('footerMeta');

// Per-group option defaults applied to each new split screen pairing.
// Each entry maps a checkbox element to the settings field that stores it.
const defaultToggles = [
  { el: document.getElementById('defaultHideWpAdminBar'), key: 'defaultHideWpAdminBar', fallbackOn: true },
  { el: document.getElementById('defaultSyncNavigation'), key: 'defaultSyncNavigation', fallbackOn: true },
  { el: document.getElementById('defaultMirrorClicks'), key: 'defaultMirrorClicks', fallbackOn: true },
  { el: document.getElementById('defaultMirrorHover'), key: 'defaultMirrorHover', fallbackOn: true }
];

async function sendMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (_error) {
    return null;
  }
}

function renderStatus(status) {
  const settings = status?.settings || {};
  alwaysShow.checked = settings.alwaysShowButtonOnSplitScreen !== false;

  for (const { el, key, fallbackOn } of defaultToggles) {
    if (!el) continue;
    const value = settings[key];
    el.checked = typeof value === 'boolean' ? value : fallbackOn;
  }

  const inSplit = Boolean(status?.isInValidSplitView);
  const buttonShown = Boolean(status?.buttonShownForCurrent);
  showCurrent.disabled = !inSplit;
  if (addRuler) addRuler.disabled = !inSplit;
  showCurrent.textContent = buttonShown
    ? 'Hide button on current split screen'
    : 'Show button on current split screen';

  if (inSplit) {
    statusText.textContent = buttonShown ? 'Button is shown for this split screen.' : 'Button is hidden for this split screen.';
    hint.hidden = true;
    hint.textContent = '';
  } else {
    statusText.textContent = 'No valid split screen detected.';
    hint.hidden = false;
    hint.textContent = status?.hint || 'Current tab is not in a split screen.';
  }
}

function renderFooter() {
  const manifest = chrome.runtime.getManifest();
  const version = manifest.version ? `v${manifest.version}` : '';
  const author = manifest.author || 'Jan Willem Bijker';
  footerMeta.textContent = [version, author].filter(Boolean).join(' · ');
}

async function refresh() {
  const status = await sendMessage({ type: MSG.POPUP_GET_STATUS });
  renderStatus(status);
}

alwaysShow.addEventListener('change', async () => {
  const status = await sendMessage({
    type: MSG.POPUP_SET_ALWAYS_SHOW,
    value: alwaysShow.checked
  });
  renderStatus(status);
});

for (const { el, key } of defaultToggles) {
  if (!el) continue;
  el.addEventListener('change', async () => {
    const status = await sendMessage({
      type: MSG.POPUP_SET_DEFAULTS,
      defaults: { [key]: el.checked }
    });
    renderStatus(status);
  });
}

showCurrent.addEventListener('click', async () => {
  const status = await sendMessage({ type: MSG.POPUP_SHOW_BUTTON_CURRENT });
  renderStatus(status);
});

if (addRuler) {
  addRuler.addEventListener('click', async () => {
    await sendMessage({ type: MSG.POPUP_RULER_ADD });
  });
}

renderFooter();
refresh();
