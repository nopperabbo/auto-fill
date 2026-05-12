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

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get('profiles');
  if (!existing.profiles) {
    await chrome.storage.local.set({ profiles: DEFAULT_PROFILES });
  }
});

// Fan out fill message to every frame in the active tab.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'autofill:dispatch') return;
  (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { sendResponse({ error: 'no active tab' }); return; }
    const frames = await chrome.webNavigation.getAllFrames?.({ tabId: tab.id }).catch(() => null);
    const results = [];
    if (frames) {
      for (const f of frames) {
        try {
          const r = await chrome.tabs.sendMessage(tab.id, { type: 'autofill:run', profile: msg.profile, submit: msg.submit }, { frameId: f.frameId });
          if (r) results.push(r);
        } catch (_) {}
      }
    } else {
      // webNavigation not permitted — fallback to broadcast (content script exists in every frame)
      const r = await chrome.tabs.sendMessage(tab.id, { type: 'autofill:run', profile: msg.profile, submit: msg.submit }).catch(() => null);
      if (r) results.push(r);
    }
    sendResponse({ results });
  })();
  return true;
});
