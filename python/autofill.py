#!/usr/bin/env python3
"""
Auto Fill — Python Playwright CLI.

Port of playwright/autofill.js. Same flags, same strategy: inject the shared
engine (core/autofill-engine.js) into every frame (including cross-origin
Stripe iframes via CDP), call fill() in each, then submit the top frame.

Usage:
    python autofill.py --url <url> [--profile <key>] [--submit] [--headful]
                       [--channel chrome] [--wait 3000]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import BrowserContext, Frame, Page, async_playwright

ROOT = Path(__file__).resolve().parent.parent
ENGINE_SRC = (ROOT / "core" / "autofill-engine.js").read_text(encoding="utf-8")
PROFILES_PATH = (ROOT / "profiles.json") if (ROOT / "profiles.json").exists() else (ROOT / "profiles.example.json")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="autofill",
        description="Auto-fill payment forms via Playwright (Stripe iframes supported).",
    )
    parser.add_argument("--url", required=True, help="Target page URL")
    parser.add_argument("--profile", help="Profile key from profiles.json (default: defaultProfile)")
    parser.add_argument("--submit", action="store_true", help="Click submit after filling")
    parser.add_argument("--headful", "--headed", action="store_true", help="Show the browser window")
    parser.add_argument("--channel", help="Browser channel (e.g. 'chrome', 'msedge')")
    parser.add_argument("--wait", type=int, default=3000, help="Delay in ms after page load before filling")
    return parser.parse_args()


async def inject_engine(frame: Frame) -> bool:
    """
    Evaluate the engine IIFE in a frame. Returns False if the frame is
    cross-origin and not ready (Playwright still bypasses, but the frame
    might not have a document yet).
    """
    try:
        await frame.evaluate(ENGINE_SRC)
        return True
    except Exception:
        return False


async def fill_frame(frame: Frame, profile: dict, submit: bool) -> dict | None:
    """Call window.__AutoFill.fill() in the frame and return the result dict."""
    js = """
        ({ profile, submit }) => {
            if (!window.__AutoFill) return { skipped: true, reason: 'engine missing', url: location.href };
            return {
                url: location.href,
                ...window.__AutoFill.fill(profile, { submit: submit && window.top === window })
            };
        }
    """
    try:
        return await frame.evaluate(js, {"profile": profile, "submit": submit})
    except Exception as e:
        return {"error": str(e), "url": frame.url}


def attach_frame_listeners(target: Page | BrowserContext) -> None:
    """
    Pre-inject the engine into every new frame as soon as it attaches/navigates.
    This catches Stripe iframes that mount after first paint.
    """
    async def on_frame(frame: Frame) -> None:
        await inject_engine(frame)

    target.on("frameattached", lambda f: asyncio.create_task(on_frame(f)))
    target.on("framenavigated", lambda f: asyncio.create_task(on_frame(f)))


async def run(args: argparse.Namespace) -> int:
    store = json.loads(PROFILES_PATH.read_text(encoding="utf-8"))
    profile_key = args.profile or store.get("defaultProfile")
    profile = store["profiles"].get(profile_key) if profile_key else None
    if profile is None:
        available = ", ".join(store["profiles"].keys())
        print(f'Unknown profile "{profile_key}". Available: {available}', file=sys.stderr)
        return 1

    print(f'[autofill] profile="{profile_key}" submit={args.submit} url={args.url}')

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=not args.headful,
            channel=args.channel,
        )
        context = await browser.new_context()
        attach_frame_listeners(context)

        page = await context.new_page()
        attach_frame_listeners(page)

        await page.goto(args.url, wait_until="load")
        await page.wait_for_timeout(args.wait)

        for f in page.frames:
            await inject_engine(f)

        results = []
        for f in page.frames:
            r = await fill_frame(f, profile, submit=False)
            if r and (r.get("filled") or r.get("error") or r.get("skipped")):
                results.append(r)

        print("\n[autofill] per-frame results:")
        for r in results:
            if r.get("error"):
                print(f"  ✗ {r['url']} — {r['error']}")
            elif r.get("skipped"):
                print(f"  — {r['url']} — {r.get('reason', '')}")
            else:
                filled = ", ".join(r.get("filled", [])) or "(none)"
                missed = ", ".join(r.get("missed", [])) or "(none)"
                print(f"  ✓ {r['url']}\n    filled: {filled}\n    missed: {missed}")

        if args.submit:
            # 300ms lets the last blur-triggered validation settle before submit.
            await page.wait_for_timeout(300)
            clicked = await page.evaluate("() => window.__AutoFill && window.__AutoFill.submitForm()")
            print(f"\n[autofill] submit: {'clicked' if clicked else 'no submit button found in top frame'}")
            await page.wait_for_timeout(3000)
        elif args.headful:
            print("\n[autofill] headful mode — browser left open, Ctrl+C to exit.")
            try:
                await asyncio.Event().wait()
            except (KeyboardInterrupt, asyncio.CancelledError):
                pass

        if not args.headful:
            await browser.close()
    return 0


def main() -> None:
    try:
        sys.exit(asyncio.run(run(parse_args())))
    except KeyboardInterrupt:
        print("\ninterrupted")
        sys.exit(130)


if __name__ == "__main__":
    main()
