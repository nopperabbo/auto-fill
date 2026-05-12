(function () {
  'use strict';

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || msg.type !== 'autofill:run') return;
    const profile = msg.profile;
    const submit = !!msg.submit;
    const isStripeFrame = location.hostname === 'js.stripe.com';
    // Only top-frame submits; Stripe iframes just fill their own inputs.
    const result = window.__AutoFill.fill(profile, { submit: submit && !isStripeFrame && window.top === window });
    sendResponse({ frame: location.href, ...result });
    return true;
  });
})();
