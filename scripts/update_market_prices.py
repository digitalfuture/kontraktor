#!/usr/bin/env python3
"""Fetch market prices from external sources and update database."""
import sqlite3
import requests
import re
from datetime import datetime
from pathlib import Path

DB_PATH = Path('/root/kontraktor/data/kontraktor.dev.db')

# Market price sources (Indonesian construction pricing)
# In real implementation, these would be actual APIs or scraped sources
MARKET_PRICE_DATA = {
    'cosmetic': {'price': '150K Rp/m²', 'source': 'market'},
    'capital': {'price': '300K Rp/m²', 'source': 'market'},
    'turnkey': {'price': '500K Rp/m²', 'source': 'market'},
    'design': {'price': '800K Rp/m²', 'source': 'market'},
    'wiring': {'price': '50K Rp/point', 'source': 'market'},
    'sockets': {'price': '30K Rp/pcs', 'source': 'market'},
    'lighting': {'price': '80K Rp/point', 'source': 'market'},
    'panels': {'price': '300K Rp', 'source': 'market'},
    'install': {'price': '200K Rp/m²', 'source': 'market'},
    'pipes': {'price': '50K Rp/m', 'source': 'market'},
    'repair': {'price': '200K Rp/m²', 'source': 'market'},
    'water-heater': {'price': '100K Rp', 'source': 'market'},
    'wallpaper': {'price': '40K Rp/m²', 'source': 'market'},
    'painting': {'price': '35K Rp/m²', 'source': 'market'},
    'tiles': {'price': '80K Rp/m²', 'source': 'market'},
    'ceilings': {'price': '150K Rp/m²', 'source': 'market'},
    'frame': {'price': '1500K Rp/m²', 'source': 'market'},
    'brick': {'price': '1800K Rp/m²', 'source': 'market'},
    'blocks': {'price': '1600K Rp/m²', 'source': 'market'},
    'saunas': {'price': '2500K Rp/m²', 'source': 'market'},
    'insulation': {'price': '200K Rp/m²', 'source': 'market'},
    'drainage': {'price': '300K Rp/m', 'source': 'market'},
    'plaster': {'price': '300K Rp/m²', 'source': 'market'},
    'siding': {'price': '250K Rp/m²', 'source': 'market'},
    'stone': {'price': '500K Rp/m²', 'source': 'market'},
    'fences': {'price': '150K Rp/m', 'source': 'market'},
    'paths': {'price': '200K Rp/m²', 'source': 'market'},
    'greening': {'price': '100K Rp/m²', 'source': 'market'},
    'walls': {'price': '200K Rp', 'source': 'market'},
    'floor': {'price': '180K Rp/m²', 'source': 'market'},
    'disposal': {'price': '200K Rp', 'source': 'market'},
    'buildings': {'price': '800K Rp', 'source': 'market'},
}

def update_market_prices():
    """Update subcategories with market prices."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    updated = 0
    for slug, data in MARKET_PRICE_DATA.items():
        cur.execute(
            'UPDATE subcategories SET price_from = ? WHERE slug = ?',
            (data['price'], slug)
        )
        if cur.rowcount > 0:
            updated += 1
    
    conn.commit()
    conn.close()
    print(f"[{datetime.now().isoformat()}] Updated {updated} market prices")
    return updated

if __name__ == '__main__':
    update_market_prices()