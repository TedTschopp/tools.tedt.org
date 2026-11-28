"""Rebuild the two terrain brush PNGs from the atlas painters with Playwright WebKit."""

import argparse
import base64
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


def main():
    root = Path(__file__).resolve().parents[1]
    default = root / "web"
    if not default.is_dir():
        default = root / "tool-src/tools/edison-atlas"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("atlas", nargs="?", type=Path, default=default)
    parser.add_argument("--webkit-executable", help="Optional installed Playwright WebKit executable")
    args = parser.parse_args()
    atlas = args.atlas.resolve()
    with sync_playwright() as playwright:
        browser = playwright.webkit.launch(executable_path=args.webkit_executable)
        page = browser.new_page()

        def local_module(route):
            path = urlsplit(route.request.url).path
            if path == "/":
                route.fulfill(content_type="text/html", body="<!doctype html>")
            elif path.startswith("/js/") and path.endswith(".js"):
                route.fulfill(path=atlas / path.lstrip("/"), content_type="text/javascript")
            else:
                route.abort()

        page.route("http://atlas-art.invalid/**", local_module)
        page.goto("http://atlas-art.invalid/")
        for density in (1, 2):
            png = page.evaluate("""async density => {
                const { terrainPatternSheet } = await import('/js/usaciv/render/art/terrain.js');
                return terrainPatternSheet(density).toDataURL('image/png').split(',')[1];
            }""", density)
            (atlas / "assets" / f"terrain-patterns-{density}x.png").write_bytes(base64.b64decode(png))
        browser.close()


if __name__ == "__main__":
    main()
