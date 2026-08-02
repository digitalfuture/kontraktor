#!/bin/bash
# Kontraktor — Full Backup Script (DB + user uploads)
# Usage: ./backup.sh [backup_dir]
# Scheduled via cron: 0 0 * * * /root/kontraktor/scripts/backup.sh

set -e

BACKUP_DIR="${1:-/root/kontraktor/backups}"
DB_PATH="/root/kontraktor/data/kontraktor.prod.db"
UPLOADS_DIR="/root/kontraktor/public/uploads"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BASE_NAME="kontraktor_prod_$TIMESTAMP"
BACKUP_FILE="$BACKUP_DIR/$BASE_NAME.db"
MANIFEST_FILE="$BACKUP_DIR/$BASE_NAME.manifest.txt"
SCHEMA_FILE="$BACKUP_DIR/$BASE_NAME.schema.sql"
UPLOADS_FILE="$BACKUP_DIR/$BASE_NAME.uploads.tar.gz"
MAX_BACKUPS=30

mkdir -p "$BACKUP_DIR"

echo "=== Kontraktor DB Backup: $TIMESTAMP ==="

# ── 1. WAL checkpoint (flush uncheckpointed data to main DB) ──
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" 2>&1 || true

# ── 2. Full backup via .backup (safe online backup, WAL-aware) ──
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
echo "✅ Full backup created: $BACKUP_FILE"

# ── 3. Verify backup integrity ──
RESULT=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>&1)
if [ "$RESULT" = "ok" ]; then
    echo "✅ Integrity check: PASS"
else
    echo "❌ Integrity check FAILED: $RESULT"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# ── 4. Dump schema for reference ──
sqlite3 "$BACKUP_FILE" ".schema" > "$SCHEMA_FILE"
echo "✅ Schema saved: $SCHEMA_FILE ($(wc -l < "$SCHEMA_FILE") lines)"

# ── 5. Create manifest ──
{
    echo "backup_timestamp: $TIMESTAMP"
    echo "source_db: $DB_PATH"
    echo "file: $BACKUP_FILE"
    echo "file_size_bytes: $(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null)"
    echo "schema_file: $SCHEMA_FILE"
    echo "integrity: pass"
    echo "tables: $(sqlite3 "$BACKUP_FILE" ".tables" | wc -w)"
    sqlite3 "$BACKUP_FILE" "SELECT 'row_count:' || COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || true
    echo "schema_version: $(sqlite3 "$BACKUP_FILE" "PRAGMA schema_version;" 2>/dev/null)"
    echo "page_count: $(sqlite3 "$BACKUP_FILE" "PRAGMA page_count;" 2>/dev/null)"
    echo "uploads_file: ${UPLOADS_FILE##*/}"
} > "$MANIFEST_FILE"
echo "✅ Manifest saved: $MANIFEST_FILE"

# ── 6. Compress backup ──
gzip "$BACKUP_FILE"
echo "✅ Compressed: ${BACKUP_FILE}.gz ($(du -h "${BACKUP_FILE}.gz" | cut -f1))"

# ── 6b. Backup user uploads (avatars, portfolio photos, docs) ──
if [ -d "$UPLOADS_DIR" ] && [ -n "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
    tar czf "$UPLOADS_FILE" -C "$UPLOADS_DIR" .
    echo "✅ Uploads backed up: $UPLOADS_FILE ($(du -h "$UPLOADS_FILE" | cut -f1))"
    echo "uploads_file_size_bytes: $(stat -c%s "$UPLOADS_FILE" 2>/dev/null || echo 0)" >> "$MANIFEST_FILE"
else
    echo "ℹ️  No uploads to back up (empty or missing $UPLOADS_DIR)"
    echo "uploads_file_size_bytes: 0" >> "$MANIFEST_FILE"
fi

# ── 7. Rotate old backups — keep last MAX_BACKUPS ──
cd "$BACKUP_DIR"
ls -t kontraktor_prod_*.db.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r -I{} sh -c '
    base=$(echo "{}" | sed "s/\.db\.gz$//")
    rm -f "{}" "${base}.manifest.txt" "${base}.schema.sql" "${base}.uploads.tar.gz" 2>/dev/null
    echo "🗑  Removed old backup: {}"
'
echo "📦 Kept last $MAX_BACKUPS backups"

# ── 8. Log ──
echo "[$(date)] Backup: ${BACKUP_FILE}.gz | Integrity: $RESULT | Size: $(du -h "${BACKUP_FILE}.gz" | cut -f1)" >> "$BACKUP_DIR/backup.log"

echo "=== Backup complete ==="
