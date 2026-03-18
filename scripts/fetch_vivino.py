#!/usr/bin/env python3
"""Fetch Vivino data for wines in the Excel wine list.

Strategy: The Vivino explore API doesn't support text search, so we:
1. Group our wines by country + wine type
2. For each group, paginate through Vivino's explore API results
3. Fuzzy-match our wine names against the results by winery name
4. Use curl subprocess for more resilient TLS fingerprinting
5. Rate-limit to avoid WAF blocks (3s+ between requests)

Usage:
  python scripts/fetch_vivino.py              # Full fetch with Vivino matching
  python scripts/fetch_vivino.py --parse-only # Just parse Excel to JSON
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import pandas as pd
from pathlib import Path
from difflib import SequenceMatcher

BASE_DIR = Path(__file__).resolve().parent.parent
EXCEL_PATH = BASE_DIR / "wine list 2026.xlsx"
OUTPUT_PATH = BASE_DIR / "data" / "wines.json"

VIVINO_EXPLORE_URL = "https://www.vivino.com/api/explore/explore"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
REQUEST_DELAY = 3.5  # seconds between requests

# Map our color names to Vivino wine_type_ids
# 1=Red, 2=White, 3=Sparkling, 4=Rosé, 7=Dessert/Sweet
COLOR_TO_TYPE_ID = {
    "Red": 1, "RED": 1, "Rouge": 1,
    "White": 2, "Blanc": 2, "off-White": 2,
    "Sparkling": 3,
    "Rose": 4, "Rosé": 4,
    "Sweet": 7, "sweet": 7, "half-sweet white": 7,
    "Orange": 2,  # closest match
}

# Map our country names to Vivino country codes
COUNTRY_TO_CODES = {
    "France": ["fr"],
    "Italy": ["it"],
    "Spain": ["es"],
    "Germany": ["de"],
    "Argentina": ["ar"],
    "Chile": ["cl"],
    "USA": ["us"],
    "South Africa": ["za"],
    "Austria": ["at"],
    "Swiss": ["ch"],
}


def split_bilingual(text):
    """Split 'Chinese\\nEnglish' text into {zh, en}."""
    if pd.isna(text) or not text:
        return {"zh": "", "en": ""}
    parts = str(text).split("\n", 1)
    if len(parts) == 2:
        return {"zh": parts[0].strip(), "en": parts[1].strip()}
    return {"zh": parts[0].strip(), "en": parts[0].strip()}


def parse_wine_name(text):
    """Split wine name, stripping '750mL' etc."""
    bi = split_bilingual(text)
    bi["zh"] = re.sub(r"\s*750\s*mL\s*", "", bi["zh"]).strip()
    bi["en"] = re.sub(r"\s*750\s*mL\s*", "", bi["en"]).strip()
    return bi


def parse_excel():
    """Parse wine list Excel into structured dicts."""
    df = pd.read_excel(EXCEL_PATH, sheet_name="FULL LIST", usecols=range(12))
    wines = []
    for _, row in df.iterrows():
        code = row.iloc[0]
        if pd.isna(code) or not str(code).strip():
            continue
        wine = {
            "id": str(row.iloc[0]).strip(),
            "country": split_bilingual(row.iloc[1]),
            "region": split_bilingual(row.iloc[2]),
            "appellation": split_bilingual(row.iloc[3]),
            "winery": split_bilingual(row.iloc[4]),
            "name": parse_wine_name(row.iloc[5]),
            "variety": split_bilingual(row.iloc[6]),
            "color": split_bilingual(row.iloc[7]),
            "classification": str(row.iloc[8]).strip() if pd.notna(row.iloc[8]) else None,
            "tradePrice": int(row.iloc[9]) if pd.notna(row.iloc[9]) else None,
            "retailPrice": int(row.iloc[10]) if pd.notna(row.iloc[10]) else None,
            "isNew": pd.notna(row.iloc[11]),
            "vivino": None,
        }
        wines.append(wine)
    return wines


def curl_get_json(url):
    """Use curl subprocess for more resilient TLS fingerprinting."""
    try:
        result = subprocess.run(
            ["curl", "-s", "-H", f"User-Agent: {USER_AGENT}", url],
            capture_output=True, text=True, timeout=20
        )
        if result.returncode != 0:
            return None
        return json.loads(result.stdout)
    except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception) as e:
        return None


def fetch_vivino_page(country_codes, wine_type_id, page=1, per_page=25):
    """Fetch one page of Vivino explore results."""
    params = {
        "country_code": "US",
        "currency_code": "USD",
        "min_rating": "1",
        "order_by": "ratings_count",
        "order": "desc",
        "page": str(page),
        "per_page": str(per_page),
    }
    if wine_type_id:
        params["wine_type_ids[]"] = str(wine_type_id)
    for cc in country_codes:
        params[f"country_codes[]"] = cc

    query_string = urllib.parse.urlencode(params, doseq=True)
    url = f"{VIVINO_EXPLORE_URL}?{query_string}"

    # Retry with backoff on failure
    for attempt in range(3):
        data = curl_get_json(url)
        if data:
            ev = data.get("explore_vintage", {})
            matches = ev.get("matches", [])
            total = ev.get("records_matched", 0)
            return matches, total
        wait = 15 * (attempt + 1)
        print(f"    [Rate limited, waiting {wait}s... (attempt {attempt+1}/3)]")
        time.sleep(wait)
    return [], 0


def normalize_name(name):
    """Normalize a wine/winery name for fuzzy matching."""
    name = name.lower().strip()
    # Remove common suffixes/prefixes
    name = re.sub(r"\b(chateau|domaine|bodega|weingut|tenuta|azienda|clos|maison)\b", "", name)
    # Remove vintage years
    name = re.sub(r"\b(19|20)\d{2}\b", "", name)
    # Remove punctuation
    name = re.sub(r"[^\w\s]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def winery_match_score(our_winery, vivino_winery):
    """Score how well a Vivino winery matches ours."""
    a = normalize_name(our_winery)
    b = normalize_name(vivino_winery)
    if not a or not b:
        return 0
    # Exact match
    if a == b:
        return 1.0
    # One contains the other
    if a in b or b in a:
        return 0.9
    # Fuzzy match
    return SequenceMatcher(None, a, b).ratio()


def wine_name_match_score(our_name, vivino_name):
    """Score how well a Vivino wine name matches ours."""
    a = normalize_name(our_name)
    b = normalize_name(vivino_name)
    if not a or not b:
        return 0
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.85
    return SequenceMatcher(None, a, b).ratio()


def find_best_match(wine, vivino_matches):
    """Find the best matching Vivino wine for one of our wines."""
    our_winery = wine["winery"]["en"]
    our_name = wine["name"]["en"]

    best_match = None
    best_score = 0

    for m in vivino_matches:
        v = m.get("vintage", {})
        w = v.get("wine", {})
        viv_winery = w.get("winery", {}).get("name", "")
        viv_name = w.get("name", "")

        # Combined score: winery match is most important
        ws = winery_match_score(our_winery, viv_winery)
        ns = wine_name_match_score(our_name, viv_name)
        score = ws * 0.6 + ns * 0.4

        if score > best_score:
            best_score = score
            best_match = m

    # Require minimum confidence
    if best_score >= 0.5:
        return best_match, best_score
    return None, 0


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
    if image_url and not image_url.startswith("http"):
        image_url = "https:" + image_url

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


def save_wines(wines):
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(wines, f, ensure_ascii=False, indent=2)


def main():
    print(f"Loading wines from {OUTPUT_PATH}")
    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        wines = json.load(f)
    print(f"Total: {len(wines)} wines")

    already = sum(1 for w in wines if w.get("vivino") is not None)
    print(f"Already have Vivino data: {already}")

    # Group wines by country + color for batch matching
    groups = {}
    for i, w in enumerate(wines):
        if w.get("vivino") is not None:
            continue
        country = w["country"]["en"]
        color = w["color"]["en"]
        key = (country, color)
        if key not in groups:
            groups[key] = []
        groups[key].append((i, w))

    print(f"Groups to process: {len(groups)}")
    for key, items in sorted(groups.items(), key=lambda x: -len(x[1])):
        print(f"  {key[0]} / {key[1]}: {len(items)} wines")

    total_found = 0
    total_not_found = 0
    request_count = 0

    for (country, color), wine_items in sorted(groups.items(), key=lambda x: -len(x[1])):
        country_codes = COUNTRY_TO_CODES.get(country, [])
        wine_type_id = COLOR_TO_TYPE_ID.get(color)

        if not country_codes:
            print(f"\n[SKIP] Unknown country: {country}")
            total_not_found += len(wine_items)
            continue

        print(f"\n{'='*60}")
        print(f"Fetching: {country} / {color} ({len(wine_items)} wines)")
        print(f"  Vivino filters: country_codes={country_codes}, type_id={wine_type_id}")

        # Collect all Vivino wines for this country+type
        all_vivino = []
        page = 1
        max_pages = min(40, max(5, len(wine_items) * 2))  # scale pages with group size

        while page <= max_pages:
            time.sleep(REQUEST_DELAY)
            request_count += 1
            matches, total_records = fetch_vivino_page(country_codes, wine_type_id, page=page, per_page=25)

            if not matches:
                print(f"  Page {page}: no results (or error), stopping")
                break

            all_vivino.extend(matches)
            print(f"  Page {page}: +{len(matches)} wines (total: {len(all_vivino)}/{total_records})")

            if len(all_vivino) >= total_records or len(matches) < 25:
                break
            page += 1

        if not all_vivino:
            print(f"  No Vivino wines found for this group")
            total_not_found += len(wine_items)
            continue

        # Match our wines against Vivino results
        print(f"  Matching {len(wine_items)} wines against {len(all_vivino)} Vivino entries...")
        group_found = 0
        for idx, wine in wine_items:
            best, score = find_best_match(wine, all_vivino)
            if best:
                wines[idx]["vivino"] = extract_vivino_data(best)
                vname = wines[idx]["vivino"]["vivinoWineName"]
                rating = wines[idx]["vivino"]["rating"]
                print(f"    [{score:.2f}] {wine['winery']['en']} -> {vname} (rating: {rating})")
                group_found += 1
                total_found += 1
            else:
                total_not_found += 1

        print(f"  Group result: {group_found}/{len(wine_items)} matched")

        # Save progress after each group
        save_wines(wines)
        print(f"  [Progress saved]")

    # Summary
    final_vivino = sum(1 for w in wines if w.get("vivino") is not None)
    print(f"\n{'='*60}")
    print(f"Done! API requests: {request_count}")
    print(f"  New matches:   {total_found}")
    print(f"  Not found:     {total_not_found}")
    print(f"  Total w/data:  {final_vivino}/{len(wines)}")
    print(f"  Saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    if "--parse-only" in sys.argv:
        print(f"Parsing Excel: {EXCEL_PATH}")
        wines = parse_excel()
        print(f"Found {len(wines)} wines")
        save_wines(wines)
        print(f"Saved to {OUTPUT_PATH} (no Vivino data)")
    else:
        main()
