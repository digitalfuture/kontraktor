import fs from 'fs';

const tokens = JSON.parse(fs.readFileSync('/root/kontraktor/credentials/ga-oauth-tokens.json', 'utf-8'));
const SITE_URL = encodeURIComponent('sc-domain:kontraktor.app');

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
  const text = await resp.text();
  console.log(`Status: ${resp.status}, Content-Type: ${resp.headers.get('content-type')}`);
  console.log(text.substring(0, 500));
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function main() {
  console.log('=== 1. GSC Sitemaps ===');
  const sitemaps = await gscRequest(`sites/${SITE_URL}/sitemaps`);
  console.log();
  
  console.log('=== 2. GSC Search Analytics (7 days) ===');
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sa = await gscRequest(
    `sites/${SITE_URL}/searchAnalytics/query`,
    'POST',
    {
      startDate: sevenDaysAgo.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
      dimensions: ['page'],
      rowLimit: 30,
    }
  );
  console.log();
  
  console.log('=== 3. URL Inspection for homepage ===');
  const inspect = await gscRequest(
    `urlInspection/index:inspect`,
    'POST',
    {
      inspectionUrl: 'https://kontraktor.app/',
      siteUrl: 'sc-domain:kontraktor.app',
    }
  );
  console.log();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
