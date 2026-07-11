#!/usr/bin/env python3
"""Human-in-the-loop Facebook login. You log in by hand; the session is saved
to disk so post.py can reuse it. Nothing types your password — Camoufox just
opens a real browser window and waits for you.

Run:  ../.venv/bin/python login.py
"""
import json
import sys
from pathlib import Path

from camoufox.sync_api import Camoufox

HERE = Path(__file__).resolve().parent
STATE = HERE / "session" / "fb_state.json"


def main() -> int:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    print("Opening Camoufox… log in to Facebook in the window.")
    print("When you see your normal Facebook home feed, come back here and press Enter.")

    # headless=False: you need to see the window to log in.
    # persistent_context via storage_state on close.
    with Camoufox(headless=False, humanize=True, os="linux") as browser:
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto("https://www.facebook.com/", wait_until="domcontentloaded")

        input("\n>>> Press Enter here AFTER you are fully logged in… ")

        # Sanity check: are we actually logged in?
        page.goto("https://www.facebook.com/me", wait_until="domcontentloaded")
        if "login" in page.url:
            print("Still on a login page — session NOT saved. Re-run and finish login first.", file=sys.stderr)
            return 1

        ctx.storage_state(path=str(STATE))

    # Don't print cookie values; just confirm count.
    try:
        n = len(json.loads(STATE.read_text()).get("cookies", []))
    except Exception:
        n = "?"
    print(f"Session saved to {STATE} ({n} cookies). post.py can now run.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
