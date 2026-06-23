import fs from 'fs';
const tokens = JSON.parse(fs.readFileSync('/root/kontraktor/credentials/ga-oauth-tokens.json', 'utf-8'));
const creds = JSON.parse(fs.readFileSync('/root/kontraktor/credentials/ga-oauth.json', 'utf-8'));

console.log('Token expiry:', new Date(tokens.expiry_date).toISOString());
console.log('Now:', new Date().toISOString());
console.log('Expired:', tokens.expiry_date < Date.now());
console.log('Has refresh_token:', !!tokens.refresh_token);

// Try to refresh
async function refresh() {
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
  console.log('Refresh response:', JSON.stringify(data, null, 2));
  if (data.access_token) {
    tokens.access_token = data.access_token;
    fs.writeFileSync('/root/kontraktor/credentials/ga-oauth-tokens.json', JSON.stringify(tokens, null, 2));
    console.log('Token refreshed and saved');
  }
}
refresh().catch(e => console.error('Error:', e));
