'use strict';

const DEFAULT_PROFILES = {
  defaultProfile: 'test',
  profiles: {
    test: {
      label: 'Stripe Test Card',
      card: { number: '4242 4242 4242 4242', expMonth: '12', expYear: '34', cvc: '123', holder: 'John Doe' },
      billing: {
        email: 'john.doe@example.com', phone: '+1 555 0100',
        country: 'ID', countryName: 'Indonesia',
        line1: '123 Example Street', line2: 'Unit 42',
        city: 'Jakarta', state: 'DKI Jakarta', stateCode: 'JK',
        postalCode: '12190'
      }
    }
  }
};

async function getProfiles() {
  const { profiles } = await chrome.storage.local.get('profiles');
  return profiles || DEFAULT_PROFILES;
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
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get('profiles');
  if (!existing.profiles) await chrome.storage.local.set({ profiles: DEFAULT_PROFILES });
  await rebuildContextMenu();
});

chrome.runtime.onStartup.addListener(async () => {
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
