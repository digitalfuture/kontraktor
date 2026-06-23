import fs from 'fs';

const tokens = JSON.parse(fs.readFileSync('/root/kontraktor/credentials/ga-oauth-tokens.json', 'utf-8'));

async function gscRequest(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  console.log(`Fetching: ${url}`);
  const resp = await fetch(url, opts);
  const text = await resp.text();
  console.log(`Status: ${resp.status}`);
  try {
    return JSON.parse(text);
  } catch {
    console.log(`Raw: ${text.substring(0, 500)}`);
    return null;
  }
}

async function main() {
  // Try webmasters v3 API
  console.log('=== Sites (webmasters v3) ===');
  const sites1 = await gscRequest('https://www.googleapis.com/webmasters/v3/sites');
  if (sites1 && sites1.siteEntry) {
    for (const s of sites1.siteEntry) {
      console.log(`  Site: ${s.siteUrl}, Level: ${s.permissionLevel}`);
    }
  }
  console.log();
  
  // Try with encoded site URL
  console.log('=== Sitemaps via webmasters v3 ===');
  const siteUrl = encodeURIComponent('sc-domain:kontraktor.app');
  const sitemaps = await gscRequest(`https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/sitemaps`);
  if (sitemaps) console.log(JSON.stringify(sitemaps, null, 2));
  console.log();
  
  // Try searchanalytics via webmasters v3
  console.log('=== Search Analytics via webmasters v3 ===');
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sa = await gscRequest(
    `https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`,
    'POST',
    {
      startDate: sevenDaysAgo.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
      dimensions: ['page'],
      rowLimit: 30,
    }
  );
  if (sa) console.log(JSON.stringify(sa, null, 2));
  console.log();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
