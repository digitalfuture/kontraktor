#!/bin/bash
# Kontraktor — Production Deploy Script
# Usage: ./deploy.sh

set -e

APP_DIR="/root/kontraktor"
LOG_DIR="/var/log/kontraktor"

echo "🚀 Deploying Kontraktor..."

# 1. Install production dependencies only
cd "$APP_DIR"
echo "📦 Installing dependencies..."
npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# 2. Build TypeScript + copy assets
echo "🔨 Building..."
npm run build

# 3. Create log directory
sudo mkdir -p "$LOG_DIR"
sudo chown www-data:www-data "$LOG_DIR" 2>/dev/null || true

# 4. Stop existing PM2 process
pm2 delete kontraktor 2>/dev/null || true

# 5. Start with PM2
echo "🟢 Starting with PM2..."
pm2 start pm2.config.cjs
pm2 save

# 6. Verify
sleep 2
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/)
if [ "$HEALTH" = "200" ]; then
  echo "✅ Deploy successful! Health check: $HEALTH"
  pm2 status
else
  echo "❌ Health check failed: $HEALTH"
  pm2 logs kontraktor --lines 20 --nostream
  exit 1
fi
