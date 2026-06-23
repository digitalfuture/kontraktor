#!/usr/bin/env node
/**
 * SEO Deep Analysis — Kontraktor
 * Fetches data from Google Search Console (Webmasters v3), GSC v1 (for search analytics), and GA4 Data API.
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokensPath = path.join(__dirname, '../credentials/ga-oauth-tokens.json');
const credsPath = path.join(__dirname, '../credentials/ga-oauth.json');

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));

const SITE_URL = 'sc-domain:kontraktor.app';
const GA_PROPERTY = 'properties/538731523';

async function refreshToken() {
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.installed.client_id,
      client_secret: creds.installed.client_secret,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await resp.json();
  if (data.access_token) {
    tokens.access_token = data.access_token;
    if (data.expires_in) tokens.expiry_date = Date.now() + data.expires_in * 1000;
    fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
  } else {
    console.error('❌ Token refresh failed:', data);
    process.exit(1);
  }
  return data.access_token;
}

async function webmastersRequest(endpoint, method = 'GET', body = null) {
  const url = `https://www.googleapis.com/webmasters/v3/${endpoint}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  if (resp.status === 401) {
    tokens.access_token = await refreshToken();
    opts.headers.Authorization = `Bearer ${tokens.access_token}`;
    const retry = await fetch(url, opts);
    return retry.json();
  }
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${txt.substring(0, 300)}`);
  }
  return resp.json();
}

async function gscRequest(endpoint, method = 'GET', body = null) {
  const url = `https://searchconsole.googleapis.com/v1/${endpoint}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  if (resp.status === 401) {
    tokens.access_token = await refreshToken();
    opts.headers.Authorization = `Bearer ${tokens.access_token}`;
    const retry = await fetch(url, opts);
    if (!retry.ok) {
      const txt = await retry.text();
      throw new Error(`HTTP ${retry.status}: ${txt.substring(0, 300)}`);
    }
    return retry.json();
  }
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${txt.substring(0, 300)}`);
  }
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    const txt = await resp.text();
    throw new Error(`HTML response (not JSON): ${txt.substring(0, 200)}`);
  }
  return resp.json();
}

async function ga4Request(endpoint, method = 'POST', body = null) {
  const url = `https://analyticsdata.googleapis.com/v1beta/${endpoint}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  if (resp.status === 401) {
    tokens.access_token = await refreshToken();
    opts.headers.Authorization = `Bearer ${tokens.access_token}`;
    const retry = await fetch(url, opts);
    return retry.json();
  }
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${txt.substring(0, 300)}`);
  }
  return resp.json();
}

function parseGaRows(report) {
  if (!report.rows) return [];
  return report.rows.map(row => {
    const dims = row.dimensionValues ? row.dimensionValues.map(d => d.value) : [];
    const metrics = row.metricValues ? row.metricValues.map(m => m.value) : [];
    return { dimensions: dims, metrics };
  });
}

async function main() {
  console.log('\n=== 🔍 SEO Deep Analysis Report ===\n');
  console.log(`Date: ${new Date().toISOString()}\n`);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

  const dateStr7 = sevenDaysAgo.toISOString().split('T')[0];
  const dateStrNow = now.toISOString().split('T')[0];
  const dateStr14 = fourteenDaysAgo.toISOString().split('T')[0];
  const dateStr8 = eightDaysAgo.toISOString().split('T')[0];

  const siteEnc = encodeURIComponent(SITE_URL);

  // ── 1. GSC Sitemaps (Webmasters v3) ──
  console.log('--- 1. GSC Sitemaps ---');
  try {
    const sitemaps = await webmastersRequest(`sites/${siteEnc}/sitemaps`);
    const sm = sitemaps.sitemap || [];
    console.log(`Found ${sm.length} sitemaps`);
    for (const s of sm) {
      const c = s.contents && s.contents[0] ? s.contents[0] : {};
      console.log(`  Path: ${s.path}`);
      console.log(`  Submitted: ${c.submitted}, Indexed: ${c.indexed}, Errors: ${s.errors}, Warnings: ${s.warnings}`);
      console.log(`  Last submitted: ${s.lastSubmitted}, Last downloaded: ${s.lastDownloaded}`);
      console.log(`  Is pending: ${s.isPending}`);
      console.log('');
    }
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`);
  }

  // ── 2. GSC Search Analytics (last 7 days) ──
  console.log('--- 2. GSC Search Analytics (7 days) ---');
  try {
    const search = await gscRequest(
      `sites/${siteEnc}/searchAnalytics/query`,
      'POST',
      {
        startDate: dateStr7,
        endDate: dateStrNow,
        dimensions: ['page', 'query'],
        rowLimit: 30,
      }
    );
    if (search.rows && search.rows.length > 0) {
      console.log(`Total clicks: ${search.responseAggregation && search.responseAggregation.totalClicks || 'N/A'}`);
      search.rows.forEach(r => {
        console.log(`  Page: ${r.keys[0]}, Query: "${r.keys[1]}", Clicks: ${r.clicks}, Impressions: ${r.impressions}, Position: ${r.position}`);
      });
    } else {
      console.log('  No search analytics data available (new site or no traffic)');
      console.log(`  Full response: ${JSON.stringify(search).substring(0, 500)}`);
    }
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`);
  }

  // ── 3. GA4 Basic metrics (7 days) ──
  console.log('\n--- 3. GA4: Basic Metrics (7 days) ---');
  try {
    const gaBasic = await ga4Request(`${GA_PROPERTY}:runReport`, 'POST', {
      dateRanges: [{ startDate: dateStr7, endDate: dateStrNow }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'newUsers' },
      ],
    });
    const rows = parseGaRows(gaBasic);
    if (rows.length > 0) {
      console.log(`  Active Users: ${rows[0].metrics[0]}`);
      console.log(`  Sessions: ${rows[0].metrics[1]}`);
      console.log(`  Page Views: ${rows[0].metrics[2]}`);
      console.log(`  Bounce Rate: ${rows[0].metrics[3]}`);
      console.log(`  Avg Session Duration: ${rows[0].metrics[4]}s`);
      console.log(`  New Users: ${rows[0].metrics[5]}`);
    } else {
      console.log('  No GA data available');
    }
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`);
  }

  // ── 4. GA4 Top 10 pages ──
  console.log('\n--- 4. GA4: Top 10 Pages (7 days) ---');
  try {
    const gaPages = await ga4Request(`${GA_PROPERTY}:runReport`, 'POST', {
      dateRanges: [{ startDate: dateStr7, endDate: dateStrNow }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    });
    const pageRows = parseGaRows(gaPages);
    if (pageRows.length > 0) {
      pageRows.forEach(r => console.log(`  ${r.dimensions[0]}: ${r.metrics[0]} views`));
    } else {
      console.log('  No page data available');
    }
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`);
  }

  // ── 5. GA4 Traffic by source ──
  console.log('\n--- 5. GA4: Traffic by Source (7 days) ---');
  try {
    const gaSources = await ga4Request(`${GA_PROPERTY}:runReport`, 'POST', {
      dateRanges: [{ startDate: dateStr7, endDate: dateStrNow }],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    });
    const srcRows = parseGaRows(gaSources);
    if (srcRows.length > 0) {
      srcRows.forEach(r => console.log(`  ${r.dimensions[0]}: ${r.metrics[0]} sessions, ${r.metrics[1]} users`));
    } else {
      console.log('  No source data available');
    }
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`);
  }

  // ── 6. GA4 Trend: last 7 vs previous 7 ──
  console.log('\n--- 6. GA4: Trend (last 7 vs previous 7 days) ---');
  try {
    const gaTrend = await ga4Request(`${GA_PROPERTY}:runReport`, 'POST', {
      dateRanges: [
        { startDate: dateStr7, endDate: dateStrNow },
        { startDate: dateStr14, endDate: dateStr8 },
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'newUsers' },
      ],
    });
    const trendRows = parseGaRows(gaTrend);
    if (trendRows.length >= 2) {
      console.log(`  Last 7 days — Active Users: ${trendRows[0].metrics[0]}, Sessions: ${trendRows[0].metrics[1]}, Views: ${trendRows[0].metrics[2]}, New Users: ${trendRows[0].metrics[3]}`);
      console.log(`  Prev 7 days — Active Users: ${trendRows[1].metrics[0]}, Sessions: ${trendRows[1].metrics[1]}, Views: ${trendRows[1].metrics[2]}, New Users: ${trendRows[1].metrics[3]}`);
    } else if (trendRows.length === 1) {
      console.log(`  Only one period available: ${JSON.stringify(trendRows[0])}`);
    } else {
      console.log('  No trend data available');
    }
  } catch (e) {
    console.error(`  ❌ Error: ${e.message}`);
  }

  // ── 7. URL Inspection for homepage ──
  console.log('\n--- 7. GSC: URL Inspection (homepage) ---');
  try {
    const urlInspect = await gscRequest(
      `urlInspection/index:inspect`,
      'POST',
      {
        inspectionUrl: 'https://kontraktor.app/',
        siteUrl: SITE_URL,
      }
    );
    console.log(JSON.stringify(urlInspect, null, 2));
  } catch (e) {
    console.error(`  ❌ Error: ${e.message} — URL Inspection may not be available via API with current scopes`);
  }

  console.log('\n=== Deep Analysis Complete ===\n');
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
