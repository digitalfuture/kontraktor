#!/usr/bin/env python3
"""Update market prices in ALL databases under the data directory.

Replaced single-DB script (was hardcoded to kontraktor.dev.db only).
Now globs all *.db files so prod, dev, staging all stay in sync.
"""
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────────
DATA_DIR = Path('/root/kontraktor/data')

# Canonical market price data — all prices in Indonesian Rupiah format
MARKET_PRICE_DATA = {
    'cosmetic': '150K Rp/m²',
    'capital': '300K Rp/m²',
    'turnkey': '500K Rp/m²',
    'design': '800K Rp/m²',
    'wiring': '50K Rp/point',
    'sockets': '30K Rp/pcs',
    'lighting': '80K Rp/point',
    'panels': '300K Rp',
    'install': '200K Rp/m²',
    'pipes': '50K Rp/m',
    'repair': '200K Rp/m²',
    'water-heater': '100K Rp',
    'wallpaper': '40K Rp/m²',
    'painting': '35K Rp/m²',
    'tiles': '80K Rp/m²',
    'ceilings': '150K Rp/m²',
    'frame': '1500K Rp/m²',
    'brick': '1800K Rp/m²',
    'blocks': '1600K Rp/m²',
    'saunas': '2500K Rp/m²',
    'insulation': '200K Rp/m²',
    'drainage': '300K Rp/m',
    'plaster': '300K Rp/m²',
    'siding': '250K Rp/m²',
    'stone': '500K Rp/m²',
    'fences': '150K Rp/m',
    'paths': '200K Rp/m²',
    'greening': '100K Rp/m²',
    'walls': '200K Rp',
    'floor': '180K Rp/m²',
    'disposal': '200K Rp',
    'buildings': '800K Rp',
}


def update_database(db_path: Path) -> dict:
    """Update all matching slugs in one database. Returns update stats."""
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()

    # Check the table exists
    try:
        cur.execute("SELECT COUNT(*) FROM subcategories")
    except sqlite3.OperationalError:
        conn.close()
        return {'status': 'skipped', 'reason': 'no subcategories table', 'updated': 0}

    updated = 0
    missed = []

    for slug, price in MARKET_PRICE_DATA.items():
        cur.execute(
            'UPDATE subcategories SET price_from = ? WHERE slug = ?',
            (price, slug)
        )
        if cur.rowcount > 0:
            updated += cur.rowcount
        else:
            missed.append(slug)

    conn.commit()

    # Gather coverage stats
    cur.execute("SELECT COUNT(*) FROM subcategories")
    total_rows = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM subcategories WHERE price_from IS NOT NULL")
    with_prices = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM subcategories WHERE price_from IS NULL")
    without_prices = cur.fetchone()[0]

    conn.close()

    return {
        'status': 'ok',
        'updated': updated,
        'total_rows': total_rows,
        'with_prices': with_prices,
        'without_prices': without_prices,
        'missed': missed,
    }


def main():
    db_paths = sorted(DATA_DIR.glob('*.db'))
    if not db_paths:
        print(f"[{datetime.now().isoformat()}] No databases found in {DATA_DIR}")
        sys.exit(0)

    print(f"[{datetime.now().isoformat()}] Found {len(db_paths)} database(s): {', '.join(p.name for p in db_paths)}")
    print(f"[{datetime.now().isoformat()}] Updating {len(MARKET_PRICE_DATA)} market price keys")

    for db_path in db_paths:
        result = update_database(db_path)
        if result['status'] == 'skipped':
            print(f"  {db_path.name}: ⏭️  Skipped — {result['reason']}")
            continue
        if result['missed']:
            print(f"  {db_path.name}: ⚠️  {result['updated']} rows, MISSED slugs: {result['missed']}")
        else:
            print(f"  {db_path.name}: ✅ {result['updated']} rows updated "
                  f"({result['with_prices']}/{result['total_rows']} with prices, "
                  f"{result['without_prices']} without)")

    print(f"[{datetime.now().isoformat()}] Done")


if __name__ == '__main__':
    main()
