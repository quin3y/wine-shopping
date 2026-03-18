#!/usr/bin/env python3
"""Fetch Vivino data using Playwright browser to bypass WAF."""

import json
import re
import sys
import time
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Install playwright: pip install playwright && playwright install chromium")
    sys.exit(1)

BASE_DIR = Path(__file__).resolve().parent.parent
EXCEL_PATH = BASE_DIR / "wine list 2026.xlsx"
OUTPUT_PATH = BASE_DIR / "data" / "wines.json"
REQUEST_DELAY = 2.0  # seconds between requests


def load_wines():
    """Load existing wines.json."""
    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_wines(wines):
    """Save wines.json."""
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(wines, f, ensure_ascii=False, indent=2)


def extract_vivino_data(match):
    """Extract structured data from a Vivino API match."""
    vintage = match.get("vintage", {})
    wine = vintage.get("wine", {})
    stats = vintage.get("statistics", {})
    taste = wine.get("taste", {})
    structure = taste.get("structure", {})
    flavor_data = taste.get("flavor", [])

    flavors = []
    if isinstance(flavor_data, list):
        for group in flavor_data:
            for kw in group.get("primary_keywords", []):
                name = kw.get("name", "")
                if name:
                    flavors.append(name)

    taste_dict = None
    if isinstance(structure, dict) and structure:
        taste_dict = {
            "acidity": structure.get("acidity"),
            "sweetness": structure.get("sweetness"),
            "tannin": structure.get("tannin"),
            "intensity": structure.get("intensity"),
            "fizziness": structure.get("fizziness"),
        }

    image = vintage.get("image", {})
    image_url = image.get("location", "") if isinstance(image, dict) else ""

    wine_id = wine.get("id", "")
    slug = wine.get("seo_name", "")
    winery_slug = wine.get("winery", {}).get("seo_name", "")
    vivino_url = ""
    if winery_slug and slug:
        vivino_url = f"https://www.vivino.com/{winery_slug}/{slug}"

    return {
        "rating": stats.get("ratings_average"),
        "ratingsCount": stats.get("ratings_count"),
        "taste": taste_dict,
        "flavors": flavors if flavors else None,
        "imageUrl": image_url or None,
        "vivinoUrl": vivino_url or None,
        "vivinoWineName": wine.get("name", ""),
    }


def main():
    wines = load_wines()
    total = len(wines)
    already = sum(1 for w in wines if w.get("vivino") is not None)
    print(f"Total: {total}, Already have Vivino data: {already}")

    to_fetch = [(i, w) for i, w in enumerate(wines) if w.get("vivino") is None]
    if not to_fetch:
        print("All wines already have Vivino data!")
        return

    print(f"Need to fetch: {len(to_fetch)} wines")
    print("Launching browser...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
        )
        page = context.new_page()

        # Visit Vivino homepage first to get cookies
        print("Visiting Vivino homepage to establish session...")
        page.goto("https://www.vivino.com", wait_until="domcontentloaded", timeout=30000)
        time.sleep(3)

        # Now use the API with browser cookies
        found = 0
        not_found = 0
        errors = 0

        for idx, (i, wine) in enumerate(to_fetch):
            query = wine["name"]["en"] or wine["winery"]["en"]
            if not query:
                print(f"  [{idx+1}/{len(to_fetch)}] SKIP (no English name): {wine['name']['zh']}")
                not_found += 1
                continue

            print(f"  [{idx+1}/{len(to_fetch)}] Searching: {query}")

            try:
                # Use page.evaluate to make fetch request with browser cookies
                api_url = f"https://www.vivino.com/api/explore/explore?q={query}&page=1&per_page=5"
                result = page.evaluate(
                    """async (url) => {
                        try {
                            const r = await fetch(url, {credentials: 'include'});
                            if (!r.ok) return {error: r.status};
                            return await r.json();
                        } catch(e) {
                            return {error: e.message};
                        }
                    }""",
                    api_url,
                )

                if isinstance(result, dict) and "error" in result:
                    print(f"    -> API error: {result['error']}")
                    errors += 1
                else:
                    matches = result.get("explore_vintage", {}).get("matches", [])
                    if matches:
                        wine["vivino"] = extract_vivino_data(matches[0])
                        rating = wine["vivino"].get("rating")
                        matched = wine["vivino"].get("vivinoWineName", "")
                        print(f"    -> Found: {matched} (rating: {rating})")
                        found += 1
                    else:
                        print(f"    -> Not found on Vivino")
                        not_found += 1

            except Exception as e:
                print(f"    -> Error: {e}")
                errors += 1

            # Save progress every 20 wines
            if (idx + 1) % 20 == 0:
                save_wines(wines)
                print(f"  [Progress saved: {idx+1}/{len(to_fetch)}, found: {found}]")

            time.sleep(REQUEST_DELAY)

        browser.close()

    # Final save
    save_wines(wines)
    total_vivino = sum(1 for w in wines if w.get("vivino") is not None)
    print(f"\nDone!")
    print(f"  New found:     {found}")
    print(f"  Not found:     {not_found}")
    print(f"  Errors:        {errors}")
    print(f"  Total w/data:  {total_vivino}/{total}")


if __name__ == "__main__":
    main()
