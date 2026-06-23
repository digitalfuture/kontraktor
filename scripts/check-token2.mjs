import fs from 'fs';

const pm2Content = fs.readFileSync('/root/kontraktor/pm2.config.cjs', 'utf-8');
const match = pm2Content.match(/CF_API_TOKEN:\s*'([^']+)'/);
if (match) {
  const CF_TOKEN=match[1];
  console.log('Token from pm2, length:', CF_TOKEN.length);
  console.log('First 10 chars:', CF_TOKEN.substring(0, 10));
  console.log('Last 4 chars:', CF_TOKEN.substring(CF_TOKEN.length - 4));
  
  // Test API
  async function test() {
    const resp = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: { Authorization: `Bearer ${CF_TOKEN}` }
    });
    const data = await resp.json();
    console.log('Verify result:', JSON.stringify(data));
  }
  test().catch(e => console.error(e));
} else {
  console.log('No token found in pm2 config');
  console.log('pm2 config content:');
  console.log(pm2Content);
}
