#!/usr/bin/env python3
"""SEO Daily Report — Kontraktor (Russian, concise)"""
import urllib.request, urllib.error, json, sqlite3, re, datetime, os, urllib.parse, google.auth.transport.requests, google.oauth2.credentials
from googleapiclient.discovery import build

BASE_URL = "https://kontraktor.app"
DB_PATH = "/root/kontraktor/data/kontraktor.prod.db"

def fetch(path):
    try:
        req = urllib.request.Request(f"{BASE_URL}{path}", headers={"User-Agent": "Kontraktor-SEO/1.0"})
        resp = urllib.request.urlopen(req, timeout=15)
        return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, str(e)

def count(table, where="1=1"):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(f"SELECT COUNT(*) FROM {table} WHERE {where}")
        return c.fetchone()[0]
    except:
        return "?"
    finally:
        try: conn.close()
        except: pass

def check_jsonld(html):
    schemas = []
    for m in re.finditer(r'application/ld\+json">(.*?)</script>', html, re.DOTALL):
        try:
            decoded = m.group(1).replace('&#34;', '"')
            schemas.append(json.loads(decoded).get('@type', 'unknown'))
        except: pass
    return schemas

def check_gsc():
    """Check Google Search Console status via API"""
    token_path = "/root/kontraktor/credentials/ga-oauth-tokens.json"
    if not os.path.exists(token_path):
        return None
    try:
        with open(token_path) as f:
            td = json.load(f)
        creds = google.oauth2.credentials.Credentials(
            token=td['access_token'],
            refresh_token=td.get('refresh_token'),
            token_uri='https://oauth2.googleapis.com/token',
            client_id=os.environ.get('GOOGLE_OAUTH_CLIENT_ID', ''),
            client_secret=os.environ.get('GOOGLE_OAUTH_CLIENT_SECRET', ''),
            scopes=td.get('scope', '').split()
        )
        auth_req = google.auth.transport.requests.Request()
        creds.refresh(auth_req)
        sc = build('searchconsole', 'v1', credentials=creds)
        sites = sc.sites().list().execute()
        for s in sites.get('siteEntry', []):
            if 'kontraktor' in s.get('siteUrl', ''):
                return s.get('permissionLevel', 'unknown')
    except Exception as e:
        return f"error: {e}"
    return None

def check_sitemap_gsc():
    """Check sitemap status in GSC"""
    token_path = "/root/kontraktor/credentials/ga-oauth-tokens.json"
    if not os.path.exists(token_path):
        return None
    try:
        with open(token_path) as f:
            td = json.load(f)
        token = td['access_token']
        site_url = urllib.parse.quote('sc-domain:kontraktor.app', safe='')
        url = f"https://www.googleapis.com/webmasters/v3/sites/{site_url}/sitemaps"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read())
        for s in data.get('sitemap', []):
            contents = s.get('contents', [{}])[0] if s.get('contents') else {}
            return {
                'submitted': contents.get('submitted', '?'),
                'errors': contents.get('errors', '?'),
                'warnings': contents.get('warnings', '?')
            }
    except:
        return None

def main():
    now = datetime.datetime.now().strftime('%d.%m.%Y %H:%M')
    lines = [f"📊 SEO отчёт — {now}", ""]
    issues = []

    # DB stats
    c = count("contractors", "is_active = 1")
    p = count("projects", "status IN ('pending', 'active')")
    u = count("users", "is_active = 1")
    r = count("reviews", "is_approved = 1")
    lines.append(f"🏗 {c} контракторов | {p} проектов | {u} пользователей | {r} отзывов")
    lines.append("")

    # Check pages
    pages = {"/": "Главная", "/services": "Услуги", "/contractors": "Контракторы",
             "/post": "Проекты", "/terms": "Terms", "/privacy": "Privacy"}
    
    page_ok = 0
    for path, name in pages.items():
        status, html = fetch(path)
        if status != 200:
            issues.append(f"❌ {name}: HTTP {status}")
            continue
        schemas = check_jsonld(html)
        has_desc = 'name="description"' in html
        has_canon = 'rel="canonical"' in html
        if not has_desc:
            issues.append(f"⚠️ {name}: нет description")
        if len(schemas) < 1:
            issues.append(f"⚠️ {name}: нет JSON-LD")
        if not has_canon:
            issues.append(f"⚠️ {name}: нет canonical")
        page_ok += 1

    # Sitemap
    status, html = fetch("/sitemap.xml")
    urls = html.count("<url>") if status == 200 else 0
    if status != 200 or urls == 0:
        issues.append(f"❌ Sitemap: HTTP {status}")

    lines.append(f"🔍 Страниц проверено: {page_ok}/{len(pages)}")
    lines.append(f"🗺 Sitemap: {urls} URL" if urls else "")

    # GSC
    gsc_level = check_gsc()
    if gsc_level:
        lines.append(f"📈 Google Search Console: владелец ({gsc_level})")
        sm = check_sitemap_gsc()
        if sm:
            lines.append(f"  Sitemap: {sm['submitted']} URL, ошибок: {sm['errors']}")
            if sm.get('warnings', 0) != '?':
                lines.append(f"  Предупреждений: {sm['warnings']}")
    elif gsc_level is None:
        issues.append("⚠️ GSC: нет токена доступа")
    else:
        issues.append("⚠️ GSC: не подключён")

    lines.append("")

    if issues:
        lines.append("⚠️ *Найдено проблем:*")
        for i in issues:
            lines.append(f"  {i}")
    else:
        lines.append("✅ *Все страницы в порядке*")
    lines.append("")

    # Recommendations
    recs = []
    if c < 5:
        recs.append("Добавить контракторов — сейчас менее 5")
    if p == 0:
        recs.append("Опубликовать тестовые проекты")
    if r < 5:
        recs.append("Стимулировать отзывы клиентов")

    if recs:
        lines.append("💡 *Рекомендации:*")
        for i in recs:
            lines.append(f"  • {i}")
        lines.append("")

    print("\n".join(l for l in lines if l))

if __name__ == "__main__":
    main()
