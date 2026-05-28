#!/bin/bash
# Kontraktor — Database Backup Script
# Usage: ./backup.sh [backup_dir]
# Run via cron: 0 */6 * * * /root/kontraktor/scripts/backup.sh

set -e

BACKUP_DIR="${1:-/root/kontraktor/backups}"
DB_PATH="/root/kontraktor/data/kontraktor.prod.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/kontraktor_prod_$TIMESTAMP.db"
MAX_BACKUPS=30  # Keep last 30 backups

# Create backup dir
mkdir -p "$BACKUP_DIR"

# Backup SQLite database (using .backup for safe online backup)
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

# Compress backup
gzip "$BACKUP_FILE"
echo "✅ Backup created: ${BACKUP_FILE}.gz ($(du -h "${BACKUP_FILE}.gz" | cut -f1))"

# Rotate old backups (keep last MAX_BACKUPS)
cd "$BACKUP_DIR"
ls -t kontraktor_*.db.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm
echo "📦 Kept last $MAX_BACKUPS backups"

# Log
echo "[$(date)] Backup: ${BACKUP_FILE}.gz" >> "$BACKUP_DIR/backup.log"
