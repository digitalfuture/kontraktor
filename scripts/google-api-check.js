#!/usr/bin/env node
/**
 * Google APIs проверка для SEO отчёта
 * Использует OAuth2 для GSC и GA4
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_DIR=path.join(__dirname, '..', 'credentials');
const SITE_URL = 'sc-domain:kontraktor.app';
const GA4_PROPERTY = 'properties/538731523';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Auth ───
function getOAuthClient() {
  const oauthTokens = JSON.parse(fs.readFileSync(path.join(CREDENTIALS_DIR, 'ga-oauth-tokens.json'), 'utf-8'));
  const oauthCreds = JSON.parse(fs.readFileSync(path.join(CREDENTIALS_DIR, 'ga-oauth.json'), 'utf-8'));

  const oauth2Client = new google.auth.OAuth2(
    oauthCreds.installed.client_id,
    oauthCreds.installed.client_secret,
    oauthCreds.installed.redirect_uris[0]
  );
  oauth2Client.setCredentials(oauthTokens);

  // Refresh token if needed
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      const current = JSON.parse(fs.readFileSync(path.join(CREDENTIALS_DIR, 'ga-oauth-tokens.json'), 'utf-8'));
      Object.assign(current, tokens);
      fs.writeFileSync(path.join(CREDENTIALS_DIR, 'ga-oauth-tokens.json'), JSON.stringify(current, null, 2));
    }
  });

  return oauth2Client;
}

// ─── GSC via Search Console API ───
async function queryGSC() {
  console.log('\n========== GOOGLE SEARCH CONSOLE ==========');
  
  const auth = getOAuthClient();
  const sc = google.searchconsole({ version: 'v1', auth });

  // 1. Sitemaps list
  console.log('\n--- Sitemaps ---');
  try {
    const sitemapsRes = await sc.sitemaps.list({ siteUrl: SITE_URL });
    const sitemaps = sitemapsRes.data.sitemap || [];
    if (sitemaps.length === 0) {
      console.log('  ⚠️ No sitemaps found in GSC');
    } else {
      sitemaps.forEach(s => {
        console.log(`  📄 ${s.path}`);
        console.log(`     Submitted: ${s.contents?.length || 0} URLs`);
        console.log(`     Last downloaded: ${s.lastDownloaded || 'never'}`);
        console.log(`     Status: ${s.errors ? s.errors + ' errors' : 'OK'}`);
        if (s.isPending) console.log('     ⏳ Pending...');
        if (s.warnings) console.log(`     ⚠️ Warnings: ${s.warnings}`);
      });
    }
  } catch (e) {
    console.log(`  ❌ Error fetching sitemaps: ${e.message.substring(0, 200)}`);
  }

  // 2. URL Inspection for key pages
  console.log('\n--- URL Inspection (key pages) ---');
  const urlsToCheck = [
    'https://kontraktor.app/',
    'https://kontraktor.app/services',
    'https://kontraktor.app/contractors',
    'https://kontraktor.app/post',
    'https://kontraktor.app/terms',
  ];
  for (const url of urlsToCheck) {
    try {
      await sleep(500);
      const inspRes = await sc.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl: url,
          siteUrl: SITE_URL,
          languageCode: 'id-ID',
        }
      });
      const result = inspRes.data.inspectionResult;
      if (result) {
        console.log(`  🔍 ${url}`);
        console.log(`     Index status: ${result.indexStatusResult?.verdict || 'unknown'}`);
        console.log(`     Crawl status: ${result.crawlResult?.crawlStatus || 'unknown'}`);
        console.log(`     User can index: ${result.indexStatusResult?.userCanIndex ?? 'unknown'}`);
        console.log(`     Index state: ${result.indexStatusResult?.indexState || 'unknown'}`);
        if (result.indexStatusResult?.lastCrawlTime) {
          console.log(`     Last crawl: ${result.indexStatusResult.lastCrawlTime}`);
        }
        if (result.indexStatusResult?.robotsTxtState) {
          console.log(`     robots.txt: ${result.indexStatusResult.robotsTxtState}`);
        }
        if (result.indexStatusResult?.coveringState) {
          console.log(`     Coverage: ${result.indexStatusResult.coveringState}`);
        }
        if (result.indexStatusResult?.pageFetchState) {
          console.log(`     Page fetch: ${result.indexStatusResult.pageFetchState}`);
        }
        if (result.indexStatusResult?.sitemap) {
          console.log(`     Sitemap ref: ${result.indexStatusResult.sitemap}`);
        }
      } else {
        console.log(`  🔍 ${url} — no inspection result`);
      }
    } catch (e) {
      console.log(`  🔍 ${url} — Error: ${e.message.substring(0, 200)}`);
    }
  }

  // 3. Search Analytics (top 30 pages, 7 days)
  console.log('\n--- Search Analytics (last 7 days) ---');
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const formatDate = (d) => d.toISOString().split('T')[0];

    const saRes = await sc.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: formatDate(sevenDaysAgo),
        endDate: formatDate(now),
        dimensions: ['page', 'query'],
        rowLimit: 30,
        orderBy: [
          { fieldName: 'impressions', sortOrder: 'DESCENDING' }
        ]
      }
    });

    const rows = saRes.data.rows || [];
    if (rows.length === 0) {
      console.log('  ⚠️ No data in Search Analytics (site may be too new or no queries)');
    } else {
      console.log(`  Found ${rows.length} rows`);
      rows.slice(0, 15).forEach((row, i) => {
        console.log(`  ${i+1}. ${row.keys?.[0] || 'N/A'}`);
        console.log(`     Query: "${row.keys?.[1] || 'N/A'}"`);
        console.log(`     Impressions: ${row.impressions}, Clicks: ${row.clicks}`);
        console.log(`     Position: ${row.position?.toFixed(1)}, CTR: ${(row.ctr * 100).toFixed(1)}%`);
      });
      if (rows.length > 15) {
        console.log(`  ... and ${rows.length - 15} more rows`);
      }
    }
  } catch (e) {
    console.log(`  ❌ Error fetching search analytics: ${e.message.substring(0, 200)}`);
  }
}

// ─── GA4 via OAuth (same token) ───
async function queryGA4() {
  console.log('\n\n========== GOOGLE ANALYTICS 4 ==========');
  
  try {
    const auth = getOAuthClient();
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
    
    const now = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];
    const today = formatDate(now);
    const sevenDaysAgo = formatDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const fourteenDaysAgo = formatDate(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
    const twentyEightDaysAgo = formatDate(new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000));

    // 1. Core metrics (last 7 days)
    console.log('\n--- Core Metrics (last 7 days) ---');
    try {
      const metricsRes = await analyticsData.properties.runReport({
        property: GA4_PROPERTY,
        requestBody: {
          dateRanges: [{ startDate: sevenDaysAgo, endDate: today }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'newUsers' },
          ]
        }
      });
      
      const metricRows = metricsRes.data.rows || [];
      if (metricRows.length > 0) {
        const row = metricRows[0];
        const metricValues = row.metricValues || [];
        console.log(`  Active Users: ${metricValues[0]?.value || 0}`);
        console.log(`  Sessions: ${metricValues[1]?.value || 0}`);
        console.log(`  Page Views: ${metricValues[2]?.value || 0}`);
        console.log(`  Bounce Rate: ${metricValues[3]?.value || 'N/A'}%`);
        console.log(`  Avg Session Duration: ${metricValues[4]?.value || 0}s`);
        console.log(`  New Users: ${metricValues[5]?.value || 0}`);
      } else {
        console.log('  ⚠️ No core metrics data');
      }
    } catch (e) {
      console.log(`  ❌ Error: ${e.message.substring(0, 200)}`);
    }

    // 2. Top 10 pages by views
    console.log('\n--- Top 10 Pages (last 7 days) ---');
    try {
      const pagesRes = await analyticsData.properties.runReport({
        property: GA4_PROPERTY,
        requestBody: {
          dateRanges: [{ startDate: sevenDaysAgo, endDate: today }],
          dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
          metrics: [{ name: 'screenPageViews' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: 10
        }
      });
      
      const pageRows = pagesRes.data.rows || [];
      if (pageRows.length === 0) {
        console.log('  ⚠️ No page data');
      } else {
        pageRows.forEach((row, i) => {
          console.log(`  ${i+1}. ${row.dimensionValues?.[0]?.value || 'N/A'}`);
          console.log(`     Title: ${row.dimensionValues?.[1]?.value || 'N/A'}`);
          console.log(`     Views: ${row.metricValues?.[0]?.value || 0}`);
        });
      }
    } catch (e) {
      console.log(`  ❌ Error: ${e.message.substring(0, 200)}`);
    }

    // 3. Traffic by source
    console.log('\n--- Traffic Sources (last 7 days) ---');
    try {
      const sourceRes = await analyticsData.properties.runReport({
        property: GA4_PROPERTY,
        requestBody: {
          dateRanges: [{ startDate: sevenDaysAgo, endDate: today }],
          dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
          metrics: [
            { name: 'sessions' },
            { name: 'activeUsers' },
            { name: 'bounceRate' },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 15
        }
      });
      
      const sourceRows = sourceRes.data.rows || [];
      if (sourceRows.length === 0) {
        console.log('  ⚠️ No traffic source data');
      } else {
        sourceRows.forEach((row, i) => {
          console.log(`  ${i+1}. ${row.dimensionValues?.[0]?.value || 'N/A'} / ${row.dimensionValues?.[1]?.value || 'N/A'}`);
          console.log(`     Sessions: ${row.metricValues?.[0]?.value || 0}, Users: ${row.metricValues?.[1]?.value || 0}, Bounce: ${row.metricValues?.[2]?.value || 'N/A'}%`);
        });
      }
    } catch (e) {
      console.log(`  ❌ Error: ${e.message.substring(0, 200)}`);
    }

    // 4. Trend — compare last 7 days vs previous 7 days
    console.log('\n--- Trend Comparison (last 7 vs prev 7 days) ---');
    try {
      const trendRes = await analyticsData.properties.runReport({
        property: GA4_PROPERTY,
        requestBody: {
          dateRanges: [
            { startDate: sevenDaysAgo, endDate: today },
            { startDate: fourteenDaysAgo, endDate: sevenDaysAgo }
          ],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'newUsers' },
          ]
        }
      });
      
      const trendRows = trendRes.data.rows || [];
      if (trendRows.length > 0) {
        const current = trendRows[0]?.metricValues || [];
        const previous = trendRows[1]?.metricValues || [];
        
        const metrics = ['Active Users', 'Sessions', 'Page Views', 'New Users'];
        metrics.forEach((name, i) => {
          const cur = parseFloat(current[i]?.value || '0');
          const prev = parseFloat(previous[i]?.value || '0');
          const change = prev > 0 ? ((cur - prev) / prev * 100).toFixed(1) : 'N/A';
          const arrow = prev > 0 ? (cur > prev ? '📈' : '📉') : '—';
          console.log(`  ${arrow} ${name}: Current ${cur} vs Previous ${prev} (${change}%)`);
        });
      } else {
        console.log('  ⚠️ No trend data');
      }
    } catch (e) {
      console.log(`  ❌ Error: ${e.message.substring(0, 200)}`);
    }

    // 5. 28-day trend (weekly breakdown)
    console.log('\n--- 28-Day Trend (weekly) ---');
    try {
      const week4End = formatDate(new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000));
      const week4Start = formatDate(new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000));
      const week3End = formatDate(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
      const week3Start = formatDate(new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000));
      
      const trend28Res = await analyticsData.properties.runReport({
        property: GA4_PROPERTY,
        requestBody: {
          dateRanges: [
            { startDate: sevenDaysAgo, endDate: today },                 // Week 1 (current)
            { startDate: fourteenDaysAgo, endDate: sevenDaysAgo },        // Week 2
            { startDate: week3Start, endDate: week3End },                // Week 3
            { startDate: week4Start, endDate: week4End },                // Week 4
          ],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
          ]
        }
      });
      
      const trend28Rows = trend28Res.data.rows || [];
      if (trend28Rows.length > 0) {
        const weekLabels = ['Week 1 (current)', 'Week 2', 'Week 3', 'Week 4'];
        trend28Rows.forEach((row, i) => {
          const vals = row.metricValues || [];
          console.log(`  ${weekLabels[i]}: Users=${vals[0]?.value || 0}, Sessions=${vals[1]?.value || 0}`);
        });
      } else {
        console.log('  ⚠️ No 28-day trend data');
      }
    } catch (e) {
      console.log(`  ❌ Error: ${e.message.substring(0, 200)}`);
    }

  } catch (e) {
    console.log(`  ❌ GA4 Auth Error: ${e.message.substring(0, 200)}`);
  }
}

// ─── Main ───
async function main() {
  console.log('🚀 Google APIs SEO Check — ' + new Date().toISOString());
  
  await queryGSC();
  await queryGA4();
  
  console.log('\n✅ Done');
}

main().catch(e => console.error('Fatal:', e));
