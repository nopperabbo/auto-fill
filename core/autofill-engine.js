/**
 * autofill-engine.js — shared core for all delivery methods.
 *
 * Pattern lineage (all verified from repos >2k stars or Stripe-maintained APIs):
 *  - React native-setter + _valueTracker trick: refined-github, AutomaApp/automa
 *  - input→change→blur sequence: mozilla-mobile/firefox-ios LoginsHelper
 *  - HTMLSelectElement prototype setter: remix-project e2e suite
 *  - data-elements-stable-field-name selectors: Stripe-maintained stable API,
 *    used in freeCodeCamp, WooCommerce, useautumn e2e tests
 */
(function (root) {
  'use strict';

  // Captured before library init so React/Stripe/react-select can't shadow them.
  const NATIVE_INPUT_SETTER = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype, 'value').set;
  const NATIVE_TEXTAREA_SETTER = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype, 'value').set;
  const NATIVE_SELECT_SETTER = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype, 'value').set;

  function setNativeValue(el, value) {
    if (!el) return false;
    let protoSetter;
    if (el.tagName === 'INPUT') protoSetter = NATIVE_INPUT_SETTER;
    else if (el.tagName === 'TEXTAREA') protoSetter = NATIVE_TEXTAREA_SETTER;
    else if (el.tagName === 'SELECT') protoSetter = NATIVE_SELECT_SETTER;

    if (!protoSetter) {
      try { el.value = value; } catch (_) { return false; }
      return true;
    }

    try {
      // _valueTracker hack forces React's next diff to detect a change even
      // if the rendered value already equals what we're writing.
      // Ref: https://github.com/facebook/react/issues/11488
      if (el._valueTracker) {
        const prev = el.value;
        protoSetter.call(el, value);
        el._valueTracker.setValue(prev);
      } else {
        protoSetter.call(el, value);
      }
    } catch (_) {
      try { el.value = value; } catch (__) { return false; }
    }
    return true;
  }

  function dispatchFillEvents(el, opts) {
    opts = opts || {};
    // input → React onChange / RHF / Formik
    // change → native change listeners, <select>, jQuery
    // blur → marks field "touched" for onBlur-mode validation
    const events = opts.skipBlur ? ['input', 'change'] : ['input', 'change', 'blur'];
    for (const name of events) {
      const ev = new Event(name, { bubbles: true, composed: true, cancelable: true });
      try { ev.simulated = true; } catch (_) {}
      el.dispatchEvent(ev);
    }
  }

  function fillInput(el, value, opts) {
    if (el == null || value == null || value === '') return false;
    try { el.focus({ preventScroll: true }); } catch (_) {}
    if (!setNativeValue(el, String(value))) return false;
    dispatchFillEvents(el, opts);
    return true;
  }

  function fillSelect(el, needle) {
    if (!el || needle == null || needle === '') return false;
    const want = String(needle).trim().toLowerCase();
    const options = Array.from(el.options || []);

    let match = options.find(function (o) { return (o.value || '').toLowerCase() === want; });
    if (!match) match = options.find(function (o) { return (o.text || '').trim().toLowerCase() === want; });
    if (!match) match = options.find(function (o) { return (o.text || '').toLowerCase().includes(want); });
    if (!match && want.length === 2) {
      match = options.find(function (o) { return (o.value || '').toLowerCase().startsWith(want); });
    }
    if (!match) return false;

    try { el.focus({ preventScroll: true }); } catch (_) {}
    setNativeValue(el, match.value);
    // <select> fires `change`, not `input`.
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // Selectors ordered most-specific first — first visible hit wins.
  // Covers Stripe CardElement / PaymentElement / Checkout page + WHATWG
  // autocomplete spec + common checkout form naming conventions.
  const SELECTORS = {
    cardNumber: [
      'input[data-elements-stable-field-name="cardNumber"]',
      'input[autocomplete="cc-number"]',
      'input[name="cardnumber"]',
      'input[name="cardNumber"]',
      'input[name="number"]',
      'input[name="card[number]"]',
      'input[aria-label*="card number" i]',
      'input[placeholder*="card number" i]',
      'input[placeholder*="1234 1234" i]'
    ],
    cardExpiry: [
      'input[data-elements-stable-field-name="cardExpiry"]',
      'input[autocomplete="cc-exp"]',
      'input[name="cc-exp"]',
      'input[name="exp-date"]',
      'input[name="cardExpiry"]',
      'input[name="expiry"]',
      'input[name="card[expiry]"]',
      'input[aria-label*="expir" i]',
      'input[placeholder*="MM / YY" i]',
      'input[placeholder*="MM/YY" i]'
    ],
    cardExpMonth: [
      'input[autocomplete="cc-exp-month"]',
      'select[autocomplete="cc-exp-month"]',
      'input[name="cc-exp-month"]',
      'input[name="exp-month"]',
      'select[name*="month" i][name*="exp" i]'
    ],
    cardExpYear: [
      'input[autocomplete="cc-exp-year"]',
      'select[autocomplete="cc-exp-year"]',
      'input[name="cc-exp-year"]',
      'input[name="exp-year"]',
      'select[name*="year" i][name*="exp" i]'
    ],
    cardCvc: [
      'input[data-elements-stable-field-name="cardCvc"]',
      'input[autocomplete="cc-csc"]',
      'input[name="cvc"]',
      'input[name="cvv"]',
      'input[name="cardCvc"]',
      'input[name="card[cvc]"]',
      'input[aria-label*="cvc" i]',
      'input[aria-label*="cvv" i]',
      'input[aria-label*="security code" i]',
      'input[placeholder="CVC" i]'
    ],
    cardHolder: [
      'input[autocomplete="cc-name"]',
      'input[name="ccname"]',
      'input[name="cardName"]',
      'input[name="cardholderName"]',
      'input[name="name_on_card"]',
      'input[aria-label*="cardholder" i]',
      'input[placeholder*="name on card" i]',
      'input[placeholder*="full name on card" i]'
    ],
    email: [
      'input[autocomplete="email"]',
      'input[type="email"]',
      'input[name="email"]',
      'input[id*="email" i]'
    ],
    phone: [
      'input[autocomplete="tel"]',
      'input[type="tel"]',
      'input[name="phone"]',
      'input[id*="phone" i]'
    ],
    country: [
      'select[autocomplete="country"]',
      'select[name="country"]',
      'select[name="billingCountry"]',
      'input[autocomplete="country"]',
      'input[name="country"]'
    ],
    line1: [
      'input[autocomplete="address-line1"]',
      'input[name="address-line1"]',
      'input[name="addressLine1"]',
      'input[name="address1"]',
      'input[name="street"]',
      'input[name="billingAddressLine1"]',
      'input[aria-label*="address line 1" i]',
      'input[placeholder*="address line 1" i]'
    ],
    line2: [
      'input[autocomplete="address-line2"]',
      'input[name="address-line2"]',
      'input[name="addressLine2"]',
      'input[name="address2"]',
      'input[aria-label*="address line 2" i]'
    ],
    city: [
      'input[autocomplete="address-level2"]',
      'input[name="city"]',
      'input[name="locality"]',
      'input[name="billingCity"]',
      'input[aria-label*="city" i]'
    ],
    state: [
      'input[autocomplete="address-level1"]',
      'select[autocomplete="address-level1"]',
      'input[name="state"]',
      'input[name="province"]',
      'input[name="region"]',
      'select[name="state"]',
      'select[name="province"]',
      'input[aria-label*="province" i]',
      'input[aria-label*="state" i]'
    ],
    postalCode: [
      'input[data-elements-stable-field-name="postalCode"]',
      'input[autocomplete="postal-code"]',
      'input[name="postal"]',
      'input[name="postalCode"]',
      'input[name="postal_code"]',
      'input[name="postcode"]',
      'input[name="zip"]',
      'input[aria-label*="postal" i]',
      'input[aria-label*="zip" i]'
    ]
  };

  function queryFirst(scope, selectors) {
    for (let i = 0; i < selectors.length; i++) {
      try {
        const el = scope.querySelector(selectors[i]);
        if (el && isVisible(el) && !el.disabled && !el.readOnly) return el;
      } catch (_) {}
    }
    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.type === 'hidden') return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function pad2(v) {
    v = String(v == null ? '' : v).trim();
    if (v.length === 1) v = '0' + v;
    return v.slice(-2);
  }

  function formatExpiry(mm, yy) {
    return pad2(mm) + ' / ' + pad2(yy);
  }

  function yearLike(yy, el) {
    if (el.tagName === 'SELECT') {
      const opts = Array.from(el.options);
      const has4 = opts.some(function (o) { return /^20\d\d$/.test((o.value || o.text).trim()); });
      if (has4 && /^\d{2}$/.test(String(yy))) return '20' + pad2(yy);
    }
    return pad2(yy);
  }

  function frameLabel(scope) {
    try {
      if (scope === document) return (window.location && window.location.href) || '(top)';
      return '(custom root)';
    } catch (_) { return '(unknown)'; }
  }

  function fillFields(profile, scope) {
    scope = scope || document;
    const card = profile.card || {};
    const b = profile.billing || {};
    const filled = [];
    const missed = [];

    function tryFill(key, el, value, fn) {
      if (!el) { missed.push(key); return; }
      const ok = (fn || fillInput)(el, value);
      (ok ? filled : missed).push(key);
    }

    tryFill('cardNumber', queryFirst(scope, SELECTORS.cardNumber), card.number);
    tryFill('cardHolder', queryFirst(scope, SELECTORS.cardHolder), card.holder);
    tryFill('cardCvc',    queryFirst(scope, SELECTORS.cardCvc),    card.cvc);

    const monthEl = queryFirst(scope, SELECTORS.cardExpMonth);
    const yearEl  = queryFirst(scope, SELECTORS.cardExpYear);
    if (monthEl || yearEl) {
      if (monthEl) tryFill('cardExpMonth', monthEl, pad2(card.expMonth),
        monthEl.tagName === 'SELECT' ? fillSelect : fillInput);
      if (yearEl)  tryFill('cardExpYear',  yearEl,  yearLike(card.expYear, yearEl),
        yearEl.tagName === 'SELECT' ? fillSelect : fillInput);
    } else {
      const exp = queryFirst(scope, SELECTORS.cardExpiry);
      tryFill('cardExpiry', exp, formatExpiry(card.expMonth, card.expYear));
    }

    const countryEl = queryFirst(scope, SELECTORS.country);
    if (countryEl) {
      const ok = countryEl.tagName === 'SELECT'
        ? fillSelect(countryEl, b.country) || (b.countryName && fillSelect(countryEl, b.countryName))
        : fillInput(countryEl, b.countryName || b.country);
      (ok ? filled : missed).push('country');
    } else {
      missed.push('country');
    }

    tryFill('email', queryFirst(scope, SELECTORS.email), b.email);
    tryFill('phone', queryFirst(scope, SELECTORS.phone), b.phone);
    tryFill('line1', queryFirst(scope, SELECTORS.line1), b.line1);
    tryFill('line2', queryFirst(scope, SELECTORS.line2), b.line2);
    tryFill('city',  queryFirst(scope, SELECTORS.city),  b.city);

    const stateEl = queryFirst(scope, SELECTORS.state);
    if (stateEl) {
      const ok = stateEl.tagName === 'SELECT'
        ? fillSelect(stateEl, b.stateCode) || (b.state && fillSelect(stateEl, b.state))
        : fillInput(stateEl, b.state || b.stateCode);
      (ok ? filled : missed).push('state');
    } else {
      missed.push('state');
    }

    tryFill('postalCode', queryFirst(scope, SELECTORS.postalCode), b.postalCode);

    return { filled: filled, missed: missed, frame: frameLabel(scope) };
  }

  function submitForm(scope) {
    scope = scope || document;
    const candidates = Array.from(
      scope.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])')
    ).filter(isVisible).filter(function (el) { return !el.disabled; });

    const prefer = /(pay|place order|submit|confirm|continue|checkout|subscribe|buy)/i;
    let target = candidates.find(function (bt) { return prefer.test((bt.innerText || bt.value || '').trim()); });
    if (!target && candidates.length === 1) target = candidates[0];
    if (!target) return false;

    target.click();
    return true;
  }

  function fill(profile, opts) {
    opts = opts || {};
    const result = fillFields(profile, opts.root);
    if (opts.submit) {
      // 150ms lets the last blur-triggered validation settle before clicking submit.
      setTimeout(function () { submitForm(opts.root); }, 150);
    }
    return result;
  }

  const api = {
    fill: fill,
    fillFields: fillFields,
    fillInput: fillInput,
    fillSelect: fillSelect,
    submitForm: submitForm,
    setNativeValue: setNativeValue,
    SELECTORS: SELECTORS,
    _version: '1.0.0'
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.__AutoFill = api;
})(typeof window !== 'undefined' ? window : globalThis);
