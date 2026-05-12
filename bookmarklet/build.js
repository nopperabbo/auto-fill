#!/usr/bin/env node
// build.js — bundle engine + profile into a single bookmarklet URL and install page.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const engine = fs.readFileSync(path.join(ROOT, 'core/autofill-engine.js'), 'utf8');
const profilesPath = fs.existsSync(path.join(ROOT, 'profiles.json'))
  ? path.join(ROOT, 'profiles.json')
  : path.join(ROOT, 'profiles.example.json');
const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
const outDir = path.join(ROOT, 'bookmarklet', 'dist');
fs.mkdirSync(outDir, { recursive: true });

function minify(src) {
  // Cheap minifier — preserves behavior. Safe for our single IIFE.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\n\s*\n/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*([=+\-*/%<>!&|,;:?(){}\[\]])\s*/g, '$1')
    .trim();
}

function buildFor(profileKey, submit) {
  const profile = profiles.profiles[profileKey];
  if (!profile) throw new Error(`Unknown profile: ${profileKey}`);

  const wrapper = `
(function(){
  ${engine}
  var p = ${JSON.stringify(profile)};
  var r = window.__AutoFill.fill(p, { submit: ${submit ? 'true' : 'false'} });
  console.log('[autofill]', r);
  var msg = 'Filled: ' + r.filled.length + ' / Missed: ' + r.missed.join(',');
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;background:#111;color:#fff;padding:8px 12px;border-radius:6px;font:13px system-ui;box-shadow:0 4px 12px rgba(0,0,0,.3)';
  document.body.appendChild(t);
  setTimeout(function(){ t.remove(); }, 4000);
})();
  `.trim();

  const minified = minify(wrapper);
  return 'javascript:' + encodeURIComponent(minified);
}

const links = [];
for (const key of Object.keys(profiles.profiles)) {
  const label = profiles.profiles[key].label || key;
  links.push({
    key,
    label,
    fillOnly: buildFor(key, false),
    fillSubmit: buildFor(key, true),
  });
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Auto Fill — Bookmarklet Install</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1.25rem; color: #222; }
  h1 { font-size: 1.4rem; }
  .profile { border: 1px solid #e0e0e0; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
  .profile h2 { margin: 0 0 .5rem; font-size: 1.05rem; }
  .bm { display: inline-block; padding: .5rem .9rem; background: #635bff; color: #fff; text-decoration: none; border-radius: 6px; margin-right: .5rem; margin-top: .25rem; font-weight: 500; }
  .bm.submit { background: #c41e3a; }
  code { background: #f6f6f6; padding: .1rem .3rem; border-radius: 3px; font-size: .9em; }
  .warn { background: #fff8e1; border-left: 4px solid #ffb300; padding: .75rem 1rem; margin: 1rem 0; border-radius: 4px; }
  .warn strong { color: #b26a00; }
</style>
</head>
<body>
  <h1>Auto Fill — Install Bookmarklets</h1>
  <p><strong>How to install:</strong> drag each button below to your bookmarks bar.
     Open a payment form, then click the bookmark to fill.</p>

  <div class="warn">
    <strong>⚠️ Limitation:</strong> Bookmarklets cannot fill inside Stripe's
    cross-origin iframes (<code>js.stripe.com</code>). Use the extension,
    userscript, or Playwright CLI for Stripe Elements / Stripe Checkout iframe forms.
    Bookmarklets work great for plain HTML and same-origin React forms.
  </div>

  ${links.map(l => `
    <div class="profile">
      <h2>${l.label} <small style="color:#666;font-weight:normal">(${l.key})</small></h2>
      <a class="bm" href="${l.fillOnly}" onclick="event.preventDefault();alert('Drag me to your bookmarks bar — don\\'t click here.')">Fill — ${l.label}</a>
      <a class="bm submit" href="${l.fillSubmit}" onclick="event.preventDefault();alert('Drag me to your bookmarks bar — don\\'t click here.')">Fill + Submit — ${l.label}</a>
    </div>
  `).join('')}

  <h2 style="margin-top:2rem">Rebuild</h2>
  <p>After editing <code>profiles.json</code>, regenerate:</p>
  <pre style="background:#f6f6f6;padding:.75rem;border-radius:4px"><code>node bookmarklet/build.js</code></pre>
</body>
</html>
`;

fs.writeFileSync(path.join(outDir, 'install.html'), html);
console.log('Built:', path.join(outDir, 'install.html'));
console.log('Profiles:', links.map(l => l.key).join(', '));
