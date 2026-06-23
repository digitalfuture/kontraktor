import fs from 'fs';

const pm2Content = fs.readFileSync('/root/kontraktor/pm2.config.cjs', 'utf-8');
const match = pm2Content.match(/CF_API_TOKEN:\s*'([^']+)'/);
if (!match) { console.log('No token found'); process.exit(1); }

const CF_TOKEN=***  
async function tryEndpoint(url) {
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${CF_TOKEN}` }
    });
    const text = await resp.text();
    console.log(`GET ${url}`);
    console.log(`Status: ${resp.status}`);
    console.log(`Body: ${text.substring(0, 500)}`);
    console.log();
  } catch(e) {
    console.log(`Error: ${e.message}`);
  }
}

async function main() {
  console.log('=== Testing Cloudflare API with token ===');
  console.log('Token prefix:', CF_TOKEN.substring(0, 8) + '...');
  
  // Try zones list
  await tryEndpoint('https://api.cloudflare.com/client/v4/zones');
  
  // Try user (might not have permission)
  await tryEndpoint('https://api.cloudflare.com/client/v4/user');
}

main().catch(e => console.error(e));
