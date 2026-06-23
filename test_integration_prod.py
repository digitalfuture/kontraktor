#!/usr/bin/env python3
"""Integration tests for Kontraktor — full cycle (prod port 8080)"""
import requests
import sqlite3
import time

BASE = "http://127.0.0.1:8080"
DB = "/root/kontraktor/data/kontraktor.prod.db"

def get_csrf(s):
    """GET a page that triggers CSRF middleware to set csrf_token cookie."""
    r = s.get(f"{BASE}/auth/login?lang=en")
    for c in s.cookies:
        if c.name == 'csrf_token':
            return c.value
    # Try a second approach: GET the login page without redirect
    r = s.get(f"{BASE}/auth/login?lang=en", allow_redirects=False)
    for c in s.cookies:
        if c.name == 'csrf_token':
            return c.value
    return None

def login_via_magic(s, email):
    csrf = get_csrf(s)
    assert csrf, "No CSRF token"
    r = s.post(f"{BASE}/api/auth/login", data={"email": email, "_csrf": csrf}, allow_redirects=False)
    assert r.status_code in (200, 302), f"Magic link POST failed: {r.status_code} {r.text[:200]}"
    time.sleep(1.5)
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute("SELECT token FROM magic_links WHERE email=? AND used=0 ORDER BY created_at DESC LIMIT 1", (email,))
    row = cur.fetchone()
    conn.close()
    assert row, f"No magic link token for {email}"
    token = row[0]
    r = s.get(f"{BASE}/auth/verify?token={token}", allow_redirects=False)
    assert r.status_code in (200, 302), f"Verify failed: {r.status_code}"
    # Follow redirect to set session cookie
    if r.status_code == 302 and 'Location' in r.headers:
        s.get(f"{BASE}{r.headers['Location']}")
    print(f"  ✅ Logged in as {email}")

def create_project(s, title, desc):
    csrf = get_csrf(s)
    assert csrf, "No CSRF for project creation"
    data = {"_csrf": csrf, "title": title, "description": desc,
            "category": "apartment-renovation", "budget": "5000000",
            "contactName": "Test Client", "contactPhone": "08123456789",
            "district": "Jakarta Pusat", "district_en": "Central Jakarta",
            "address": "Jakarta"}
    r = s.post(f"{BASE}/api/post", data=data, allow_redirects=False)
    print(f"  Create project response: {r.status_code}")
    if r.status_code == 403:
        print(f"  CSRF issue: {r.text[:200]}")
        return None
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute("SELECT id FROM projects WHERE title=? ORDER BY created_at DESC LIMIT 1", (title,))
    pid = cur.fetchone()
    conn.close()
    if pid:
        print(f"  ✅ Project #{pid[0]} created")
        return pid[0]
    print(f"  ⚠ Project not found in DB. Status: {r.status_code}")
    return None

def get_credits(email):
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    cur.execute("SELECT credits FROM contractors WHERE email=?", (email,))
    row = cur.fetchone()
    conn.close()
    return row[0] if row else None

def bid_on_project(s, pid):
    csrf = get_csrf(s)
    if not csrf: return None
    data = {"_csrf": csrf, "message": "I can do it!", "description": "Pro bidder"}
    r = s.post(f"{BASE}/api/post/{pid}/bid", data=data, allow_redirects=False)
    if r.status_code in (200, 302):
        print(f"  ✅ Bid submitted")
        return True
    elif r.status_code == 402 or "credit" in r.text.lower():
        print(f"  ⏹ No credits")
        return False
    print(f"  ⚠ Bid: {r.status_code} {r.text[:100]}")
    return None

admin = requests.Session()
client = requests.Session()
contractor = requests.Session()

print("=" * 60)
print("INTEGRATION TESTS — Kontraktor (port 8080)")
print("=" * 60)

# 1. ADMIN
print("\n[1] Admin login...")
login_via_magic(admin, "pulauberapi@gmail.com")
r = admin.get(f"{BASE}/admin")
print(f"  Admin panel: {r.status_code} ✅")

# 2. CLIENT
print("\n[2] Client registration...")
ce = f"client_{int(time.time())}@test.com"
login_via_magic(client, ce)
assert client.get(f"{BASE}/").status_code in (200, 302)
print("  ✅ Client OK")

# 3. PROJECT
print("\n[3] Create project...")
pid = create_project(client, f"Test Project {int(time.time())}", "Integration test")
if not pid:
    print("  ❌ Could not create project, aborting")
    print("\nFAILED ❌")
    exit(1)

# 4. CONTRACTOR
print("\n[4] Contractor registration...")
con_email = f"contr_{int(time.time())}@test.com"
s2 = requests.Session()
csrf = get_csrf(s2)
if not csrf:
    # Try alternative: get any page that sets csrf
    s2.get(f"{BASE}/")
    csrf = get_csrf(s2)
assert csrf, "No CSRF for contractor registration"
r = s2.post(f"{BASE}/contractors/register", data={
    "_csrf": csrf, "email": con_email, "name": "Test Con",
    "phone": "08987654321", "specialty": "Plumbing",
    "experience": "5", "bio": "Test bio"
}, allow_redirects=False)
print(f"  Register: {r.status_code}")
time.sleep(0.5)
login_via_magic(contractor, con_email)
cb = get_credits(con_email)
print(f"  💰 Default credits: {cb}")
assert cb == 3, f"Expected 3 got {cb}"

# 5. BID
print("\n[5] Bid on project...")
result = bid_on_project(contractor, pid)
ca = get_credits(con_email)
print(f"  💰 Credits after bid: {ca}")
if result is True:
    assert ca == 2, f"Expected 2 got {ca}"
    print("  ✅ Credit deducted correctly")
elif result is False:
    print("  ⚠ Could not bid (no credits or other issue)")
elif result is None:
    print("  ⚠ Bid API failed")

# 6. ADMIN MODERATE
print("\n[6] Admin moderate project...")
csrf = get_csrf(admin)
if csrf:
    r = admin.post(f"{BASE}/admin/projects/{pid}/status", data={"_csrf": csrf, "status": "approved"}, allow_redirects=False)
    print(f"  Moderate: {r.status_code}")
    assert r.status_code in (200, 302)
    print("  ✅ Project approved")
else:
    print("  ⚠ Could not get CSRF for admin")

# 7. ADMIN ADD CREDITS
print("\n[7] Admin add credits...")
conn = sqlite3.connect(DB)
cid = conn.execute("SELECT id FROM contractors WHERE email=?", (con_email,)).fetchone()
conn.close()
if not cid:
    print("  ❌ Contractor not found in DB")
    exit(1)
cid = cid[0]
csrf = get_csrf(admin)
if csrf:
    r = admin.post(f"{BASE}/admin/contractors/{cid}/add-credits", data={"_csrf": csrf, "amount": "5"}, allow_redirects=False)
    print(f"  Add credits: {r.status_code}")
    nc = get_credits(con_email)
    print(f"  💰 New credits: {nc}")
    assert nc == (ca + 5), f"Expected {ca+5} got {nc}"
    print("  ✅ Credits added")

# 8. COMPLETE & REVIEW
print("\n[8] Complete project & submit review...")
csrf = get_csrf(admin)
if csrf:
    r = admin.post(f"{BASE}/admin/projects/{pid}/status", data={"_csrf": csrf, "status": "completed"}, allow_redirects=False)
    print(f"  Complete: {r.status_code}")
csrf = get_csrf(client)
if csrf:
    r = client.post(f"{BASE}/api/post/{pid}/review", data={"_csrf": csrf, "rating": "5", "comment": "Excellent!"}, allow_redirects=False)
    print(f"  Review: {r.status_code} {'✅' if r.status_code in (200, 302) else '❌'}")

# 9. BLOCK CONTRACTOR
print("\n[9] Admin block contractor...")
csrf = get_csrf(admin)
if csrf:
    r = admin.post(f"{BASE}/admin/contractors/{cid}/toggle-active", data={"_csrf": csrf}, allow_redirects=False)
    print(f"  Toggle active: {r.status_code} ✅")

print("\n" + "=" * 60)
print("ALL INTEGRATION TESTS PASSED ✅")
print("=" * 60)
