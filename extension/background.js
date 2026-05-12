'use strict';

const DEFAULT_PROFILES_URL = chrome.runtime.getURL('default-profiles.json');

const FALLBACK_PROFILES = {
  defaultProfile: 'test',
  profiles: {
    test: {
      label: 'Stripe Test Card — US',
      card: { number: '4242 4242 4242 4242', expMonth: '12', expYear: '34', cvc: '123', holder: 'John Doe' },
      billing: {
        email: 'john.doe@example.com', phone: '+1 555 0100',
        country: 'US', countryName: 'United States',
        line1: '123 Example Street', line2: 'Unit 42',
        city: 'New York', state: 'New York', stateCode: 'NY',
        postalCode: '10001'
      }
    }
  }
};

async function loadBundledDefaults() {
  try {
    const resp = await fetch(DEFAULT_PROFILES_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data || !data.profiles || typeof data.profiles !== 'object') {
      throw new Error('malformed default-profiles.json');
    }
    return data;
  } catch (e) {
    console.warn('[auto-fill] bundled defaults unavailable, using inline fallback:', e);
    return FALLBACK_PROFILES;
  }
}

async function getProfiles() {
  const { profiles } = await chrome.storage.local.get('profiles');
  if (profiles && profiles.profiles && Object.keys(profiles.profiles).length) return profiles;
  return await loadBundledDefaults();
}

// Escape "&" in menu titles because some OSes interpret it as accelerator marker.
// Source: Bitwarden main-context-menu-handler sanitizeContextMenuTitle.
function sanitize(s) {
  return String(s).replace(/&/g, '&&');
}

async function dispatchFillToActiveTab(profile, submit) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return { error: 'no active tab' };
  const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id }).catch(() => null);
  const results = [];
  if (frames) {
    for (const f of frames) {
      try {
        const r = await chrome.tabs.sendMessage(tab.id, { type: 'autofill:run', profile, submit }, { frameId: f.frameId });
        if (r) results.push(r);
      } catch (_) {}
    }
  } else {
    const r = await chrome.tabs.sendMessage(tab.id, { type: 'autofill:run', profile, submit }).catch(() => null);
    if (r) results.push(r);
  }
  return { results };
}

async function fillWithProfileKey(key, submit) {
  const store = await getProfiles();
  const profile = store.profiles[key];
  if (!profile) return { error: `profile "${key}" not found` };
  return await dispatchFillToActiveTab(profile, submit);
}

async function fillDefault(submit) {
  const store = await getProfiles();
  return await fillWithProfileKey(store.defaultProfile, submit);
}

// ─── Context menu: Auto Fill → <profile> → Fill / Fill+Submit ───────────────
const MENU_ROOT = 'autofill-root';

async function rebuildContextMenu() {
  await chrome.contextMenus.removeAll();
  const store = await getProfiles();

  chrome.contextMenus.create({
    id: MENU_ROOT,
    title: 'Auto Fill',
    contexts: ['page', 'editable'],
  });

  for (const key of Object.keys(store.profiles)) {
    const label = sanitize(store.profiles[key].label || key);
    chrome.contextMenus.create({
      id: `fill:${key}`,
      parentId: MENU_ROOT,
      title: `Fill — ${label}`,
      contexts: ['page', 'editable'],
    });
    chrome.contextMenus.create({
      id: `fillsubmit:${key}`,
      parentId: MENU_ROOT,
      title: `Fill + Submit — ${label}`,
      contexts: ['page', 'editable'],
    });
  }
}

chrome.contextMenus.onClicked.addListener(async (info) => {
  const m = String(info.menuItemId).match(/^(fill|fillsubmit):(.+)$/);
  if (!m) return;
  const [, kind, key] = m;
  await fillWithProfileKey(key, kind === 'fillsubmit');
});

// ─── Keyboard shortcuts ─────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'fill_default')     await fillDefault(false);
  else if (command === 'fill_and_submit') await fillDefault(true);
});

// ─── Lifecycle: seed defaults, build menu, rebuild on profile changes ───────
function _isLegacyIndonesiaStore(store) {
  if (!store || !store.profiles) return false;
  for (const key of Object.keys(store.profiles)) {
    const b = store.profiles[key] && store.profiles[key].billing;
    if (b && (b.country === 'ID' || b.countryName === 'Indonesia')) return true;
  }
  return false;
}

async function seedOrMigrate({ force = false } = {}) {
  const existing = await chrome.storage.local.get('profiles');
  const has = existing.profiles && existing.profiles.profiles && Object.keys(existing.profiles.profiles).length;

  if (!has) {
    const bundled = await loadBundledDefaults();
    await chrome.storage.local.set({ profiles: bundled });
    return { seeded: true, count: Object.keys(bundled.profiles).length };
  }

  if (force || _isLegacyIndonesiaStore(existing.profiles)) {
    const bundled = await loadBundledDefaults();
    await chrome.storage.local.set({ profiles: bundled });
    return { migrated: true, count: Object.keys(bundled.profiles).length };
  }

  return { kept: true, count: Object.keys(existing.profiles.profiles).length };
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const result = await seedOrMigrate({ force: false });
  console.log('[auto-fill] onInstalled', details.reason, result);
  await rebuildContextMenu();
});

chrome.runtime.onStartup.addListener(async () => {
  await seedOrMigrate({ force: false });
  await rebuildContextMenu();
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local' && changes.profiles) {
    await rebuildContextMenu();
  }
});

// ─── Message router: from popup + floating widget ───────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === 'autofill:requestFill') {
    // From floating widget — use default profile.
    (async () => {
      const result = await fillDefault(!!msg.submit);
      sendResponse(result);
    })();
    return true;
  }

  if (msg.type === 'autofill:dispatch') {
    // From popup — explicit profile.
    (async () => {
      const result = await dispatchFillToActiveTab(msg.profile, !!msg.submit);
      sendResponse(result);
    })();
    return true;
  }

  if (msg.type === 'autofill:listProfiles') {
    (async () => {
      const store = await getProfiles();
      sendResponse(store);
    })();
    return true;
  }
});
