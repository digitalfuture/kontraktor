import fs from 'fs';

// Read .env.production directly and parse it
const envContent = fs.readFileSync('/root/kontraktor/.env.production', 'utf-8');
const lines = envContent.split('\n');
let CF_TOKEN = '';
for (const line of lines) {
  if (line.startsWith('CF_API_TOKEN=')) {
    CF_TOKEN = line.substring('CF_API_TOKEN='.length).trim();
    break;
  }
}

if (!CF_TOKEN) {
  // Try pm2 config
  const pm2Content = fs.readFileSync('/root/kontraktor/pm2.config.cjs', 'utf-8');
  const match = pm2Content.match(/CF_API_TOKEN:\s*'([^']+)'/);
  if (match) CF_TOKEN = match[1];
}

console.log('Token found, length:', CF_TOKEN.length);

const CF_API = 'https://api.cloudflare.com/client/v4';

async function cfRequest(endpoint, method = 'GET', body = null) {
  const url = `${CF_API}${endpoint}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  return resp.json();
}

async function main() {
  console.log('=== 1. Token Verification ===');
  const verify = await cfRequest('/user/tokens/verify');
  console.log(`  Status: ${verify.success ? '✅ Valid' : '❌ Invalid'}`);
  if (!verify.success) { console.log(`  Errors: ${JSON.stringify(verify.errors)}`); return; }
  
  console.log('\n=== 2. Zones ===');
  const zones = await cfRequest('/zones?name=kontraktor.app');
  let ZONE_ID = null;
  if (zones.success && zones.result.length > 0) {
    ZONE_ID = zones.result[0].id;
    console.log(`  Zone: ${zones.result[0].name} (${ZONE_ID})`);
    console.log(`  Plan: ${zones.result[0].plan?.nickname || 'N/A'}`);
  } else {
    const allZones = await cfRequest('/zones');
    for (const z of allZones.result || []) {
      if (z.name.includes('kontraktor')) { ZONE_ID = z.id; console.log(`  Found: ${z.name} (${ZONE_ID})`); }
    }
  }
  if (!ZONE_ID) { console.log('  No zone found'); return; }

  const checks = [
    ['Security Level', '/zones/' + ZONE_ID + '/settings/security_level'],
    ['Challenge TTL', '/zones/' + ZONE_ID + '/settings/challenge_ttl'],
    ['Browser Check', '/zones/' + ZONE_ID + '/settings/browser_check'],
    ['Bot Fight Mode', '/zones/' + ZONE_ID + '/settings/bot_fight_mode'],
    ['SSL', '/zones/' + ZONE_ID + '/settings/ssl'],
    ['Always Use HTTPS', '/zones/' + ZONE_ID + '/settings/always_use_https'],
    ['Rocket Loader', '/zones/' + ZONE_ID + '/settings/rocket_loader'],
    ['Email Obfuscation', '/zones/' + ZONE_ID + '/settings/email_obfuscation'],
    ['Auto HTTPS Rewrites', '/zones/' + ZONE_ID + '/settings/automatic_https_rewrites'],
    ['Min TLS Version', '/zones/' + ZONE_ID + '/settings/min_tls_version'],
  ];
  console.log('\n=== Settings ===');
  for (const [name, endpoint] of checks) {
    const res = await cfRequest(endpoint);
    if (res.success) console.log(`  ${name}: ${JSON.stringify(res.result.value)}`);
    else console.log(`  ${name}: ${res.errors?.[0]?.message || 'N/A'}`);
  }

  console.log('\n=== Page Rules ===');
  const prs = await cfRequest('/zones/' + ZONE_ID + '/pagerules');
  if (prs.success && prs.result) {
    for (const pr of prs.result) {
      const t = pr.targets?.[0]?.constraint?.value || '?';
      const a = pr.actions?.map(x => x.id + '=' + JSON.stringify(x.value)).join(', ') || '';
      console.log(`  ${t}: [${a}]`);
    }
  }

  console.log('\n=== Firewall Rules ===');
  const fw = await cfRequest('/zones/' + ZONE_ID + '/firewall/rules');
  if (fw.success && fw.result) {
    for (const r of fw.result) {
      console.log(`  ${r.description || '?'}: action=${r.action}, paused=${r.paused}`);
    }
  }
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
