import { spawn } from 'child_process';

// Start the server
const server = spawn('node', ['-e', "require('ts-node').register({transpileOnly: true}); require('./src/index.ts')"], {
  cwd: '/root/kontraktor',
  env: { ...process.env, PORT: '3003', NODE_ENV: 'development' },
  stdio: ['ignore', 'pipe', 'pipe']
});

server.stdout.on('data', (data) => {
  console.log('[STDOUT]', data.toString());
});

server.stderr.on('data', (data) => {
  console.error('[STDERR]', data.toString());
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

server.on('exit', (code) => {
  console.log('Server exited with code:', code);
});

// Wait for server to start - wait for ready message
await new Promise((resolve) => {
  server.stdout.on('data', (data) => {
    const str = data.toString();
    console.log('[STDOUT]', str);
    if (str.includes('server running') || str.includes('running on')) {
      resolve();
    }
  });
  // Timeout after 10 seconds
  setTimeout(() => resolve(), 10000);
});

// Make request
try {
  const response = await fetch('http://localhost:3003/admin/email/lists?lang=en', {
    headers: { 'Cookie': 'session_token=2d85204e-4d84-4302-ac2d-4eeb64473074' }
  });
  const text = await response.text();
  console.log('Response status:', response.status);
  console.log('Response (first 500 chars):', text.substring(0, 500));
} catch (err) {
  console.error('Fetch error:', err);
}

// Give time for any error logs
await new Promise(resolve => setTimeout(resolve, 1000));

server.kill();