import fs from 'fs';

const tokens = JSON.parse(fs.readFileSync('/root/kontraktor/credentials/ga-oauth-tokens.json', 'utf-8'));

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
  console.log(`Status: ${resp.status}`);
  try {
    return JSON.parse(text);
  } catch {
    console.log(`Raw: ${text.substring(0, 1000)}`);
    return null;
  }
}

async function main() {
  // List all sites
  console.log('=== GSC Sites List ===');
  const sites = await gscRequest('sites');
  if (sites && sites.siteEntry) {
    for (const s of sites.siteEntry) {
      console.log(`  Site: ${s.siteUrl}, Level: ${s.permissionLevel}`);
    }
  } else {
    console.log('No sites found or error');
  }
  console.log();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
