#!/usr/bin/env node
/**
 * Playwright autofill CLI.
 *
 * Usage:
 *   node autofill.js --url <url> [--profile <key>] [--submit] [--headful] [--channel chrome]
 *
 * Strategy:
 *   1. Inject the core engine into every frame (including cross-origin Stripe iframes —
 *      Playwright bypasses same-origin policy via CDP).
 *   2. Call fill() in every frame. Each frame fills whatever selectors it finds.
 *   3. Top frame submits last.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ENGINE_SRC = fs.readFileSync(path.join(ROOT, 'core/autofill-engine.js'), 'utf8');
const PROFILES_PATH = fs.existsSync(path.join(ROOT, 'profiles.json'))
  ? path.join(ROOT, 'profiles.json')
  : path.join(ROOT, 'profiles.example.json');

function parseArgs(argv) {
  const args = { submit: false, headful: false, waitFor: 3000 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--url') args.url = next();
    else if (a === '--profile') args.profile = next();
    else if (a === '--submit') args.submit = true;
    else if (a === '--headful' || a === '--headed') args.headful = true;
    else if (a === '--channel') args.channel = next();
    else if (a === '--wait') args.waitFor = Number(next()) || 3000;
    else if (a === '--help' || a === '-h') args.help = true;
    else console.warn('Unknown arg:', a);
  }
  return args;
}

function help() {
  console.log(`
Auto Fill — Playwright CLI

  --url <url>        Target page URL (required)
  --profile <key>    Profile key from profiles.json (default: defaultProfile)
  --submit           Click submit after filling
  --headful          Show browser window
  --channel chrome   Use installed Chrome instead of bundled Chromium
  --wait <ms>        Wait this long after page load before filling (default: 3000)

Example:
  node autofill.js --url https://example.com/checkout --profile personal --submit --headful
`);
}

async function injectEngineIntoFrame(frame) {
  try {
    // addScriptTag is scoped to each frame; content is the engine IIFE.
    await frame.evaluate(ENGINE_SRC);
    return true;
  } catch (e) {
    // Cross-origin frames that aren't yet loaded will throw; skip them.
    return false;
  }
}

async function fillFrame(frame, profile, submit) {
  try {
    return await frame.evaluate(({ profile, submit }) => {
      if (!window.__AutoFill) return { skipped: true, reason: 'engine missing', url: location.href };
      return {
        url: location.href,
        ...window.__AutoFill.fill(profile, { submit: submit && window.top === window }),
      };
    }, { profile, submit });
  } catch (e) {
    return { error: e.message, url: frame.url() };
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.url) { help(); process.exit(args.help ? 0 : 1); }

  const store = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf8'));
  const profileKey = args.profile || store.defaultProfile;
  const profile = store.profiles[profileKey];
  if (!profile) {
    console.error(`Unknown profile "${profileKey}". Available: ${Object.keys(store.profiles).join(', ')}`);
    process.exit(1);
  }

  console.log(`[autofill] profile="${profileKey}" submit=${args.submit} url=${args.url}`);

  const browser = await chromium.launch({
    headless: !args.headful,
    channel: args.channel,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Pre-inject engine into every new frame the moment it navigates. This catches
  // Stripe iframes that mount after first paint.
  context.on('page', (p) => {
    p.on('frameattached', async (f) => { await injectEngineIntoFrame(f); });
    p.on('framenavigated', async (f) => { await injectEngineIntoFrame(f); });
  });
  page.on('frameattached', async (f) => { await injectEngineIntoFrame(f); });
  page.on('framenavigated', async (f) => { await injectEngineIntoFrame(f); });

  await page.goto(args.url, { waitUntil: 'load' });
  await page.waitForTimeout(args.waitFor);

  // Inject into every frame we can see now.
  for (const f of page.frames()) {
    await injectEngineIntoFrame(f);
  }

  const results = [];
  // Fill each frame independently — they each handle their own input set.
  for (const f of page.frames()) {
    const r = await fillFrame(f, profile, false);
    if (r && (r.filled?.length || r.error || r.skipped)) results.push(r);
  }

  console.log('\n[autofill] per-frame results:');
  for (const r of results) {
    if (r.error) console.log(`  ✗ ${r.url} — ${r.error}`);
    else if (r.skipped) console.log(`  — ${r.url} — ${r.reason}`);
    else console.log(`  ✓ ${r.url}\n    filled: ${r.filled.join(', ') || '(none)'}\n    missed: ${r.missed.join(', ') || '(none)'}`);
  }

  if (args.submit) {
    // Let validation settle after last blur.
    await page.waitForTimeout(300);
    const clicked = await page.evaluate(() => window.__AutoFill?.submitForm());
    console.log(`\n[autofill] submit: ${clicked ? 'clicked' : 'no submit button found in top frame'}`);
    // Give the submission a chance to navigate/respond before we close.
    await page.waitForTimeout(3000);
  } else if (args.headful) {
    console.log('\n[autofill] headful mode — browser left open, Ctrl+C to exit.');
    await new Promise(() => {}); // wait forever
  }

  if (!args.headful) await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
