(function () {
  'use strict';

  const WIDGET_TAG = 'auto-fill-widget-7k2x9';

  // Element-based dedup: if our custom tag already exists in the doc,
  // the content script has already bootstrapped here. Survives SPA
  // re-injection better than `window.__flag`. Source: SingleFile pattern.
  if (document.querySelector(WIDGET_TAG)) return;

  let mutationIterations = 0;
  let mutationResetTimeout = null;
  let formObserver = null;
  let widget = null;

  // Throttle bailout from Bitwarden: >100 callbacks in 2s means either the
  // page is hostile-mutation-happy or we're in a feedback loop.
  function isRunaway() {
    if (mutationResetTimeout) clearTimeout(mutationResetTimeout);
    mutationIterations++;
    mutationResetTimeout = setTimeout(() => { mutationIterations = 0; }, 2000);
    return mutationIterations > 100;
  }

  function findPaymentForm() {
    if (!window.__AutoFill) return null;
    const selectors = window.__AutoFill.SELECTORS;
    const cardEl = tryFirst(selectors.cardNumber);
    const holderEl = tryFirst(selectors.cardHolder);
    const cvcEl = tryFirst(selectors.cardCvc);
    const hitCount = [cardEl, holderEl, cvcEl].filter(Boolean).length;
    if (hitCount < 2) return null;
    return cardEl || holderEl || cvcEl || null;
  }

  function tryFirst(selList) {
    for (const sel of selList) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null && !el.disabled) return el;
      } catch (_) {}
    }
    return null;
  }

  function buildWidget(anchorEl) {
    const host = document.createElement(WIDGET_TAG);
    Object.assign(host.style, {
      all: 'initial',
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '2147483647',
      display: 'block',
    });

    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
      <style>
        :host, * { box-sizing: border-box; }
        .wrap {
          font: 500 13px/1.3 system-ui, -apple-system, Segoe UI, sans-serif;
          color: #fff;
          background: #635bff;
          border-radius: 999px;
          padding: 10px 16px;
          box-shadow: 0 6px 20px rgba(0,0,0,.25), 0 1px 3px rgba(0,0,0,.15);
          cursor: pointer;
          user-select: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: transform .12s ease, box-shadow .12s ease;
        }
        .wrap:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,.3), 0 1px 3px rgba(0,0,0,.15); }
        .wrap.submit { background: #c41e3a; }
        .row { display: flex; gap: 6px; align-items: center; }
        .divider { width: 1px; height: 14px; background: rgba(255,255,255,.35); }
        .btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: transparent; color: inherit; border: 0; padding: 0;
          font: inherit; cursor: pointer;
        }
        .icon {
          width: 14px; height: 14px; display: inline-block;
        }
        .close {
          opacity: .7; font-size: 12px; margin-left: 4px; padding: 2px 6px;
          border-radius: 999px; cursor: pointer;
        }
        .close:hover { opacity: 1; background: rgba(255,255,255,.15); }
        .status {
          position: absolute; bottom: 52px; right: 0;
          background: #111; color: #fff; padding: 8px 12px;
          border-radius: 6px; font: 12px/1.4 system-ui;
          opacity: 0; transform: translateY(4px);
          transition: opacity .2s, transform .2s;
          pointer-events: none; max-width: 280px; white-space: pre-wrap;
        }
        .status.show { opacity: 1; transform: translateY(0); }
        .status.err { background: #b91c1c; }
      </style>
      <div class="wrap" role="toolbar" aria-label="Auto Fill">
        <button class="btn" data-action="fill" title="Fill (Ctrl+Shift+F)">
          <svg class="icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M3 2a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V6.414a1 1 0 00-.293-.707L10.293 2.293A1 1 0 009.586 2H3zm6 1.5L12.5 7H10a1 1 0 01-1-1V3.5z"/>
          </svg>
          <span>Fill</span>
        </button>
        <div class="divider"></div>
        <button class="btn" data-action="fill-submit" title="Fill + Submit (Ctrl+Shift+X)">
          <span>+ Submit</span>
        </button>
        <span class="close" data-action="close" title="Hide for this page">✕</span>
      </div>
      <div class="status"></div>
    `;

    const status = shadow.querySelector('.status');
    function setStatus(msg, cls) {
      status.textContent = msg;
      status.className = 'status show' + (cls ? ' ' + cls : '');
      setTimeout(() => { status.className = 'status'; }, 3500);
    }

    shadow.querySelector('.wrap').addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'close') { host.remove(); return; }
      const submit = action === 'fill-submit';
      chrome.runtime.sendMessage({ type: 'autofill:requestFill', submit }, (resp) => {
        if (chrome.runtime.lastError) {
          setStatus('Extension error: ' + chrome.runtime.lastError.message, 'err');
          return;
        }
        if (!resp) { setStatus('No response', 'err'); return; }
        if (resp.error) { setStatus(resp.error, 'err'); return; }
        const results = resp.results || [];
        const filled = results.reduce((n, r) => n + (r.filled?.length || 0), 0);
        setStatus(`Filled ${filled} field(s) across ${results.length} frame(s).`);
      });
    });

    document.documentElement.appendChild(host);
    return host;
  }

  function showWidget() {
    if (widget && widget.isConnected) return widget;
    const anchor = findPaymentForm();
    if (!anchor) return null;
    widget = buildWidget(anchor);
    return widget;
  }

  function hideWidget() {
    if (widget && widget.isConnected) widget.remove();
    widget = null;
  }

  function tick() {
    if (isRunaway()) {
      formObserver?.disconnect();
      return;
    }
    const anchor = findPaymentForm();
    if (anchor && !widget) showWidget();
    else if (!anchor && widget) hideWidget();
  }

  // Initial check + watch for SPA mutations
  tick();
  formObserver = new MutationObserver(tick);
  formObserver.observe(document.documentElement, { childList: true, subtree: true });

  // Respond to fill requests routed from background (popup/shortcut/context menu)
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== 'autofill:run') return;
    const isStripeFrame = location.hostname === 'js.stripe.com';
    const result = window.__AutoFill.fill(msg.profile, {
      submit: !!msg.submit && !isStripeFrame && window.top === window,
    });
    sendResponse({ frame: location.href, ...result });
    return true;
  });
})();
