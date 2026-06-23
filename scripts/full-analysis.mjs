import fs from 'fs';

const tokens = JSON.parse(fs.readFileSync('/root/kontraktor/credentials/ga-oauth-tokens.json', 'utf-8'));
const SERVICE_ACCOUNT = JSON.parse(fs.readFileSync('/root/kontraktor/credentials/google-analytics.json', 'utf-8'));

const GA_PROPERTY = 'properties/538731523';

async function webmastersRequest(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    console.log(`Status ${resp.status}: ${text.substring(0, 300)}`);
    return null;
  }
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
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    console.log(`GA4 Status ${resp.status}: ${text.substring(0, 300)}`);
    return null;
  }
}

async function main() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const prev7Start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const prev7End = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const siteUrl = encodeURIComponent('sc-domain:kontraktor.app');
  
  console.log('=== 1. GSC: Search Analytics (all data, 7 days) ===');
  const sa = await webmastersRequest(
    `https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`,
    'POST',
    {
      startDate: sevenDaysAgo,
      endDate: today,
      dimensions: ['page', 'query'],
      rowLimit: 30,
    }
  );
  if (sa && sa.rows) {
    for (const r of sa.rows) {
      console.log(`  ${r.keys[0]} | query: "${r.keys[1]}" | imp: ${r.impressions} | clicks: ${r.clicks} | pos: ${r.position}`);
    }
  } else {
    console.log('  No data or error:', JSON.stringify(sa));
  }
  console.log();
  
  console.log('=== 2. GSC: Sitemap full info ===');
  const sm = await webmastersRequest(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/sitemaps`);
  if (sm && sm.sitemap) {
    for (const s of sm.sitemap) {
      console.log(`  Path: ${s.path}`);
      console.log(`  Submitted: ${s.contents?.[0]?.submitted}`);
      console.log(`  Indexed: ${s.contents?.[0]?.indexed}`);
      console.log(`  Errors: ${s.errors}, Warnings: ${s.warnings}`);
      console.log(`  Last submitted: ${s.lastSubmitted}`);
      console.log(`  Last downloaded: ${s.lastDownloaded}`);
      console.log(`  Is pending: ${s.isPending}`);
    }
  }
  console.log();
  
  console.log('=== 3. URL Inspection: homepage ===');
  const inspect = await webmastersRequest(
    `https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`,
    'POST',
    {
      inspectionUrl: 'https://kontraktor.app/',
      siteUrl: 'sc-domain:kontraktor.app',
    }
  );
  if (inspect && inspect.inspectionResult) {
    const r = inspect.inspectionResult;
    const idx = r.indexStatusResult || {};
    console.log(`  Verdict: ${idx.verdict}`);
    console.log(`  Coverage: ${idx.coverageState}`);
    console.log(`  Robots: ${idx.robotsTxtState}`);
    console.log(`  Fetch: ${idx.pageFetchState}`);
    console.log(`  Indexing: ${idx.indexingState}`);
    console.log(`  Canonical: ${r.canonical}`);
    if (idx.robotsTxtFetchResult) console.log(`  Robots resp code: ${idx.robotsTxtFetchResult.httpStatusCode}`);
    if (r.mobileUsabilityResult) console.log(`  Mobile: ${r.mobileUsabilityResult.verdict}`);
    if (r.richResult) console.log(`  Rich results: ${JSON.stringify(r.richResult)}`);
  } else {
    console.log(JSON.stringify(inspect, null, 2));
  }
  console.log();
  
  // 4. GA4 - Basic metrics
  console.log('=== 4. GA4: Basic metrics (7 days) ===');
  const gaBasic = await ga4Request(`${GA_PROPERTY}:runReport`, 'POST', {
    dateRanges: [{ startDate: sevenDaysAgo, endDate: today }],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'newUsers' },
    ],
  });
  if (gaBasic && gaBasic.rows) {
    const r = gaBasic.rows[0];
    console.log(`  Active users: ${r.metricValues[0].value}`);
    console.log(`  Sessions: ${r.metricValues[1].value}`);
    console.log(`  Page views: ${r.metricValues[2].value}`);
    console.log(`  Bounce rate: ${r.metricValues[3].value}`);
    console.log(`  Avg session dur: ${r.metricValues[4].value}`);
    console.log(`  New users: ${r.metricValues[5].value}`);
  } else {
    console.log(`  Error: ${JSON.stringify(gaBasic)}`);
  }
  console.log();
  
  // 5. GA4 - Top 10 pages
  console.log('=== 5. GA4: Top 10 pages (7 days) ===');
  const gaPages = await ga4Request(`${GA_PROPERTY}:runReport`, 'POST', {
    dateRanges: [{ startDate: sevenDaysAgo, endDate: today }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 10,
  });
  if (gaPages && gaPages.rows) {
    for (const r of gaPages.rows) {
      console.log(`  ${r.dimensionValues[0].value}: ${r.metricValues[0].value} views`);
    }
  } else {
    console.log(`  Error: ${JSON.stringify(gaPages)}`);
  }
  console.log();
  
  // 6. GA4 - Traffic sources
  console.log('=== 6. GA4: Traffic sources (7 days) ===');
  const gaSources = await ga4Request(`${GA_PROPERTY}:runReport`, 'POST', {
    dateRanges: [{ startDate: sevenDaysAgo, endDate: today }],
    dimensions: [{ name: 'sessionSource' }],
    metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });
  if (gaSources && gaSources.rows) {
    for (const r of gaSources.rows) {
      console.log(`  ${r.dimensionValues[0].value}: ${r.metricValues[0].value} sessions, ${r.metricValues[1].value} users`);
    }
  } else {
    console.log(`  Error: ${JSON.stringify(gaSources)}`);
  }
  console.log();
  
  // 7. GA4 - Trend (last 7 vs prev 7)
  console.log('=== 7. GA4: Trend (last 7 vs prev 7 days) ===');
  const gaTrend = await ga4Request(`${GA_PROPERTY}:runReport`, 'POST', {
    dateRanges: [
      { startDate: sevenDaysAgo, endDate: today },
      { startDate: prev7Start, endDate: prev7End },
    ],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'screenPageViews' },
      { name: 'newUsers' },
    ],
  });
  if (gaTrend && gaTrend.rows) {
    for (const r of gaTrend.rows) {
      const period = r.dimensionValues?.[0]?.value || 'all';
      console.log(`  Period: recent=0, prev=1`);
      console.log(`    Active users: ${r.metricValues[0].value} (recent) vs pending`);
    }
    // Print both rows
    if (gaTrend.rows.length >= 2) {
      for (let i = 0; i < gaTrend.rows.length; i++) {
        const label = i === 0 ? 'Last 7 days' : 'Previous 7 days';
        const vals = gaTrend.rows[i].metricValues;
        console.log(`  ${label}:`);
        console.log(`    Active users: ${vals[0].value}`);
        console.log(`    Sessions: ${vals[1].value}`);
        console.log(`    Page views: ${vals[2].value}`);
        console.log(`    New users: ${vals[3].value}`);
      }
    }
  } else {
    console.log(`  Error: ${JSON.stringify(gaTrend)}`);
  }
  console.log();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
