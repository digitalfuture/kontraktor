#!/usr/bin/env node
/**
 * SEO Google APIs v2 — Google Search Console (searchconsole v1) + GA4
 * Usage: node scripts/seo-google-apis.mjs
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CREDENTIALS_PATH = path.join(ROOT, 'credentials', 'ga-oauth.json');
const TOKENS_PATH = path.join(ROOT, 'credentials', 'ga-oauth-tokens.json');
const GA_PROPERTY_ID = '538731523';

// Try different site URL formats
const SITE_URLS = [
  'sc-domain:kontraktor.app',
  'https://kontraktor.app',
  'https://www.kontraktor.app',
];

function getAuth() {
  if (!fs.existsSync(CREDENTIALS_PATH) || !fs.existsSync(TOKENS_PATH)) {
    console.error('[✗] Missing OAuth files');
    process.exit(1);
  }
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8')).installed;
  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));

  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uris?.[0] || 'http://localhost',
  );
  oauth2Client.setCredentials(tokens);

  oauth2Client.on('tokens', (newTokens) => {
    if (newTokens.refresh_token) {
      const saved = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
      saved.refresh_token = newTokens.refresh_token;
      fs.writeFileSync(TOKENS_PATH, JSON.stringify(saved, null, 2));
    }
    if (newTokens.access_token) {
      const saved = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
      saved.access_token = newTokens.access_token;
      saved.expiry_date = newTokens.expiry_date;
      fs.writeFileSync(TOKENS_PATH, JSON.stringify(saved, null, 2));
    }
  });

  return oauth2Client;
}

async function findValidSiteUrl(auth) {
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  // Check which site URLs are accessible
  for (const siteUrl of SITE_URLS) {
    try {
      const res = await searchconsole.sitemaps.list({ siteUrl });
      if (res.data) {
        console.log(`  ✅ Site access granted for: ${siteUrl}`);
        return siteUrl;
      }
    } catch (err) {
      console.log(`  ❌ ${siteUrl}: ${err.message}`);
    }
  }
  return null;
}

async function querySearchConsole(auth) {
  const searchconsole = google.searchconsole({ version: 'v1', auth });

  // Find the right site URL
  const siteUrl = await findValidSiteUrl(auth);
  if (!siteUrl) {
    console.log('  ⚠️  Could not access any site URL in GSC');
    return;
  }

  // ── Sitemaps ──
  console.log('\n📊 Sitemaps status');
  try {
    const sitemaps = await searchconsole.sitemaps.list({ siteUrl });
    const list = sitemaps.data.sitemap || [];
    if (list.length === 0) {
      console.log('  ⚠️  No sitemaps found');
    } else {
      for (const s of list) {
        const submitted = parseInt(s.contents?.length || '0', 10);
        const indexed = s.contents?.filter(c => c.indexed === true || c.indexed === 'true').length || 0;
        console.log(`  ${s.path}`);
        console.log(`    Submitted: ${submitted} URLs, Indexed: ${indexed}`);
      }
    }
  } catch (err) {
    console.log(`  ✗ Sitemap error: ${err.message}`);
    console.log(`    Response:`, err.response?.data || 'N/A');
  }

  // ── Search Analytics ──
  console.log('\n📊 Search Analytics (last 7 days, top 30)');
  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: '2026-06-14',
        endDate: '2026-06-21',
        dimensions: ['page'],
        rowLimit: 30,
      },
    });
    const rows = response.data.rows || [];
    if (rows.length === 0) {
      console.log('  ⚠️  No search analytics data available');
      console.log('  (Site may not have enough traffic or not yet indexed)');
    } else {
      let totalClicks = 0, totalImpressions = 0;
      for (const r of rows) {
        totalClicks += r.clicks || 0;
        totalImpressions += r.impressions || 0;
        console.log(`  ${r.keys?.[0] || '?'}`);
        console.log(`    Clicks: ${r.clicks || 0} | Impressions: ${r.impressions || 0} | CTR: ${((r.clicks || 0) / (r.impressions || 1) * 100).toFixed(1)}% | Position: ${r.position?.toFixed(1) || '?'}`);
      }
      console.log(`  ─── Total: ${totalClicks} clicks, ${totalImpressions} impressions`);
    }
  } catch (err) {
    console.log(`  ✗ Search analytics error: ${err.message}`);
    if (err.response) console.log(`    Response:`, JSON.stringify(err.response.data).slice(0, 500));
  }

  // ── URL Inspection ──
  console.log('\n📊 URL Inspection (key pages)');
  const keyPages = [
    '/', '/services', '/contractors',
    '/post', '/terms', '/privacy',
  ];
  for (const page of keyPages) {
    try {
      const inspection = await searchconsole.urlInspection.index.inspect({
        requestBody: {
          siteUrl,
          inspectionUrl: `${siteUrl.startsWith('sc-domain') ? 'https://kontraktor.app' : siteUrl}${page}`,
        },
      });
      const result = inspection.data.inspectionResult;
      if (result) {
        const idx = result.indexStatusResult || {};
        console.log(`  ${page}:`);
        console.log(`    Verdict: ${idx.verdict || 'N/A'}`);
        console.log(`    Coverage: ${idx.coverageState || 'N/A'}`);
        console.log(`    Robots: ${idx.robotsTxtState || 'N/A'}`);
        if (idx.verdict !== 'PASS') {
          console.log(`    ⚠️  Issue: ${idx.crawledAs || 'not indexed'}`);
        }
      }
    } catch (err) {
      if (err.response?.status === 404) {
        console.log(`  ${page}: ⚠️  URL not found in Google index`);
      } else {
        console.log(`  ${page}: ✗ ${err.message}`);
      }
    }
  }
}

async function queryGA4(auth) {
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
  const property = `properties/${GA_PROPERTY_ID}`;

  console.log('\n\n📈 GA4 — Last 7 days');
  try {
    const response = await analyticsData.properties.runReport({
      property,
      requestBody: {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
          { name: 'newUsers' },
        ],
      },
    });
    if (response.data.rows?.length) {
      const vals = response.data.rows[0].metricValues || [];
      console.log(`  Active users:        ${vals[0]?.value || 0}`);
      console.log(`  Sessions:            ${vals[1]?.value || 0}`);
      console.log(`  Page views:          ${vals[2]?.value || 0}`);
      console.log(`  Bounce rate:         ${parseFloat(vals[3]?.value || '0').toFixed(1)}%`);
      console.log(`  Avg session dur:     ${Math.round(parseFloat(vals[4]?.value || '0'))}s`);
      console.log(`  New users:           ${vals[5]?.value || 0}`);
    } else {
      console.log('  ⚠️  No data');
    }
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`);
  }

  console.log('\n📈 GA4 — Top 10 pages');
  try {
    const response = await analyticsData.properties.runReport({
      property,
      requestBody: {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 10,
      },
    });
    if (response.data.rows?.length) {
      for (const row of response.data.rows) {
        const dims = row.dimensionValues || [];
        const vals = row.metricValues || [];
        console.log(`  ${dims[0]?.value || ''}: ${vals[0]?.value || 0} views, ${vals[1]?.value || 0} users`);
      }
    } else {
      console.log('  ⚠️  No data');
    }
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`);
  }

  console.log('\n📈 GA4 — Traffic by source');
  try {
    const response = await analyticsData.properties.runReport({
      property,
      requestBody: {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      },
    });
    if (response.data.rows?.length) {
      for (const row of response.data.rows) {
        const dims = row.dimensionValues || [];
        const vals = row.metricValues || [];
        console.log(`  ${dims[0]?.value || '(direct)'}: ${vals[0]?.value || 0} users, ${vals[1]?.value || 0} sessions`);
      }
    } else {
      console.log('  ⚠️  No data');
    }
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`);
  }

  console.log('\n📈 GA4 — 28-day trend');
  try {
    const response = await analyticsData.properties.runReport({
      property,
      requestBody: {
        dateRanges: [
          { startDate: '7daysAgo', endDate: 'today' },
          { startDate: '14daysAgo', endDate: '8daysAgo' },
        ],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
        ],
      },
    });
    if (response.data.rows?.length) {
      const r0 = response.data.rows[0]?.metricValues || [];
      console.log(`  Last 7 days:`);
      console.log(`    Users: ${r0[0]?.value || 0}, Sessions: ${r0[1]?.value || 0}, Views: ${r0[2]?.value || 0}`);
      if (response.data.rows[1]) {
        const r1 = response.data.rows[1]?.metricValues || [];
        const pUsers = parseInt(r1[0]?.value || '0');
        const cUsers = parseInt(r0[0]?.value || '0');
        const change = pUsers > 0 ? ((cUsers - pUsers) / pUsers * 100).toFixed(1) : 'N/A';
        console.log(`  Previous 7 days:`);
        console.log(`    Users: ${r1[0]?.value || 0}, Sessions: ${r1[1]?.value || 0}, Views: ${r1[2]?.value || 0}`);
        console.log(`  📊 Change: ${change}%`);
      }
    } else {
      console.log('  ⚠️  No trend data');
    }
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`);
  }
}

async function main() {
  console.log('🔍 SEO Google APIs — starting queries');
  console.log(`   GA4 Property: ${GA_PROPERTY_ID}`);
  console.log(`   Trying site URLs: ${SITE_URLS.join(', ')}`);

  const auth = getAuth();

  await querySearchConsole(auth);
  await queryGA4(auth);

  console.log('\n✅ Done');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
