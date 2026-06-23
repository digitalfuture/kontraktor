#!/usr/bin/env python3
"""Verify SPF record via Cloudflare API"""
import json, urllib.request, sys

with open('/root/kontraktor/.env') as f:
    for line in f:
        if line.startswith('CF_API_TOKEN='):
            token = line.strip().split('=', 1)[1]
            break

req = urllib.request.Request(
    'https://api.cloudflare.com/client/v4/zones/f74face1303ac2d6f53d361cb5a445e8/dns_records?type=TXT&name=kontraktor.app',
    headers={'Authorization': f'Bearer ***}
)
data = json.loads(urllib.request.urlopen(req).read())
for r in data.get('result', []):
    if 'spf1' in r['content']:
        print('SPF:', r['content'])
        print('Modified:', r['modified_on'])
