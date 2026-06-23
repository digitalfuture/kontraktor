#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokensPath = path.join(__dirname, '../credentials/ga-oauth-tokens.json');
const credsPath = path.join(__dirname, '../credentials/ga-oauth.json');

const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));

const SITE_URL = 'sc-domain:kontraktor.app'; // Search Console property
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
    console.log('✅ Token refreshed');
  } else {
    console.error('❌ Token refresh failed:', data);
    process.exit(1);
  }
  return data.access_token;
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
    // Try refreshing token
    tokens.access_token = await refreshToken();
    opts.headers.Authorization = `Bearer ${tokens.access_token}`;
    const retry = await fetch(url, opts);
    return retry.json();
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
  return resp.json();
}

async function main() {
  console.log('\n=== 🔍 SEO Analysis Report ===\n');
  console.log(`Date: ${new Date().toISOString()}\n`);

  // 1. Google Search Console - Sitemaps
  console.log('--- GSC: Sitemaps ---');
  const sitemaps = await gscRequest(`sites/${encodeURIComponent(SITE_URL)}/sitemaps`);
  console.log(JSON.stringify(sitemaps, null, 2));

  // 2. GSC - Search Analytics (top 30 pages, last 7 days)
  console.log('\n--- GSC: Search Analytics (7 days) ---');
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const searchAnalytics = await gscRequest(
    `sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
    'POST',
    {
      startDate: sevenDaysAgo.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
      dimensions: ['page', 'query'],
      rowLimit: 30,
    }
  );
  console.log(JSON.stringify(searchAnalytics, null, 2));

  // 3. GA4 - Basic metrics last 7 days
  console.log('\n--- GA4: Active Users, Sessions, Page Views, Bounce Rate, Session Duration, New Users (7 days) ---');
  const ga7Start = sevenDaysAgo.toISOString().split('T')[0];
  const gaEnd = now.toISOString().split('T')[0];
  const gaBasic = await ga4Request(`${GA_PROPERTY}:runReport`, 'POST', {
    dateRanges: [{ startDate: ga7Start, endDate: gaEnd }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'newUsers' },
    ],
  });
  console.log(JSON.stringify(gaBasic, null, 2));

  // 4. GA4 - Top 10 pages by views (7 days)
  console.log('\n--- GA4: Top 10 Pages (7 days) ---');
  const gaTopPages = await ga4Request(`${GA_PROPERTY}:runReport`, 'POST', {
    dateRanges: [{ startDate: ga7Start, endDate: gaEnd }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 10,
  });
  console.log(JSON.stringify(gaTopPages, null, 2));

  // 5. GA4 - Traffic by source (7 days)
  console.log('\n--- GA4: Traffic by Source (7 days) ---');
  const gaSources = await ga4Request(`${GA_PROPERTY}:runReport`, 'POST', {
    dateRanges: [{ startDate: ga7Start, endDate: gaEnd }],
    dimensions: [{ name: 'sessionSource' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });
  console.log(JSON.stringify(gaSources, null, 2));

  // 6. GA4 - Trend comparison: last 7 days vs previous 7 days
  console.log('\n--- GA4: Trend (last 7 vs previous 7 days) ---');
  const prev7Start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const prev7End = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const gaTrend = await ga4Request(`${GA_PROPERTY}:runReport`, 'POST', {
    dateRanges: [
      { startDate: ga7Start, endDate: gaEnd },
      { startDate: prev7Start, endDate: prev7End },
    ],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'newUsers' },
    ],
  });
  console.log(JSON.stringify(gaTrend, null, 2));

  // 7. URL Inspection for critical pages
  console.log('\n--- GSC: URL Inspection for homepage ---');
  const urlInspect = await gscRequest(
    `urlInspection/index:inspect`,
    'POST',
    {
      inspectionUrl: 'https://kontraktor.app/',
      siteUrl: SITE_URL,
    }
  );
  console.log(JSON.stringify(urlInspect, null, 2));
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
