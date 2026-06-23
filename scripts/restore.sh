#!/bin/bash
# Kontraktor — Database Restore Script (Litestream + Classic)
# Restores DB from Litestream WAL archive (PITR) or classic backups.
# Enables maintenance mode to prevent writes during restore.
#
# Usage:
#   ./restore.sh list                  — Show all available restore points
#   ./restore.sh latest                — Restore to latest state (PITR via Litestream)
#   ./restore.sh -t "2026-06-23 12:00" — Restore to specific time (PITR)
#   ./restore.sh --from-archive TS     — Restore from 6-hourly archive backup

set -e

APP_DIR="/root/kontraktor"
BACKUP_DIR="$APP_DIR/backups"
ARCHIVE_DIR="$BACKUP_DIR"
LITESTREAM_DIR="$BACKUP_DIR/litestream"
DB_PATH="$APP_DIR/data/kontraktor.prod.db"
RESTORE_LOG="$BACKUP_DIR/restore.log"
MAINTENANCE_SCRIPT="$APP_DIR/scripts/maintenance.sh"
LITESTREAM_CONFIG="$APP_DIR/litestream.yml"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$RESTORE_LOG"; }

# ── Maintenance: stop everything, show maintenance page ──
enable_maintenance() {
    log "🟡 Enabling maintenance mode..."

    # 1. Nginx-level maintenance page
    bash "$MAINTENANCE_SCRIPT" on "Database restore in progress" || true

    # 2. Stop Litestream first (it reads DB)
    if pm2 pid kontraktor-litestream >/dev/null 2>&1; then
        log "🟡 Stopping kontraktor-litestream..."
        pm2 stop kontraktor-litestream 2>/dev/null || true
        sleep 1
    fi

    # 3. Stop app (no more DB writes)
    if pm2 pid kontraktor-prod >/dev/null 2>&1; then
        log "🟡 Stopping kontraktor-prod..."
        pm2 stop kontraktor-prod 2>/dev/null || true
        sleep 2
    fi

    log "🟡 All processes stopped. Maintenance page active."
}

# ── Post-restore: restart everything ──
disable_maintenance() {
    log "🟢 Starting Litestream..."
    pm2 start kontraktor-litestream 2>/dev/null || true
    sleep 1

    log "🟢 Starting kontraktor-prod..."
    pm2 start kontraktor-prod 2>/dev/null || pm2 restart kontraktor-prod 2>/dev/null || true
    sleep 2

    bash "$MAINTENANCE_SCRIPT" off || true
    log "🟢 All services restored. Maintenance mode OFF."
}

# ── Validate a SQLite backup file ──
validate_db() {
    local file="$1"
    if [ ! -f "$file" ]; then
        log "❌ File not found: $file"
        return 1
    fi
    local result
    result=$(sqlite3 "$file" "PRAGMA integrity_check;" 2>&1)
    if [ "$result" = "ok" ]; then
        log "✅ Integrity check: PASS"
        return 0
    else
        log "❌ Integrity check FAILED: $result"
        return 1
    fi
}

# ── Litestream restore (PITR, latest or specific time) ──
do_litestream_restore() {
    local timestamp="${1:-}"  # empty = latest

    log "═══ Litestream restore${timestamp:+ to: $timestamp} ═══"

    # Check litestream archive exists
    if [ ! -d "$LITESTREAM_DIR" ] || [ -z "$(ls -A "$LITESTREAM_DIR" 2>/dev/null)" ]; then
        log "❌ No Litestream archive found at $LITESTREAM_DIR"
        log "   Litestream may not have replicated yet."
        return 1
    fi

    # Show what's available
    log "📦 Litestream archive: $(du -sh "$LITESTREAM_DIR" 2>/dev/null | cut -f1)"
    litestream generations "$LITESTREAM_DIR" 2>/dev/null | while read -r line; do
        log "   $line"
    done || true

    # Enable maintenance
    enable_maintenance

    # Backup current DB just in case
    local pre_dump="$BACKUP_DIR/pre_restore_$(date +%Y%m%d_%H%M%S).db"
    if [ -f "$DB_PATH" ]; then
        log "📦 Saving current DB → $pre_dump"
        sqlite3 "$DB_PATH" ".backup '$pre_dump'" 2>/dev/null && \
            gzip "$pre_dump" 2>/dev/null || true
    fi

    # Build restore args
    local restore_args=""
    if [ -n "$timestamp" ]; then
        restore_args="-t \"$timestamp\""
    fi

    # Restore via Litestream
    log "⏳ Restoring... (this may take a moment if WAL needs replay)"
    local restore_cmd="litestream restore --config \"$LITESTREAM_CONFIG\" -force -o \"$DB_PATH\" $restore_args \"$DB_PATH\""
    log "   Running: litestream restore --config $LITESTREAM_CONFIG -force -o $DB_PATH ${timestamp:+-t \"$timestamp\"} $DB_PATH"

    if eval "$restore_cmd" 2>&1; then
        chmod 600 "$DB_PATH"
        log "✅ Litestream restore completed"

        if validate_db "$DB_PATH"; then
            local db_size
            db_size=$(du -h "$DB_PATH" | cut -f1)
            log "✅✅ Restore SUCCESSFUL. DB: $db_size"
            disable_maintenance
            return 0
        else
            log "❌ Restored DB failed integrity check!"
            log "   ⚠️  Trying to revert to pre-restore backup..."
            if [ -f "${pre_dump}.gz" ]; then
                gunzip -c "${pre_dump}.gz" > "$DB_PATH" 2>/dev/null || true
            fi
            disable_maintenance
            return 1
        fi
    else
        log "❌ Litestream restore command failed"
        disable_maintenance
        return 1
    fi
}

# ── Classic archive restore (backward compat) ──
do_archive_restore() {
    local ts="$1"
    local src="$ARCHIVE_DIR/kontraktor_prod_${ts}.db.gz"

    log "═══ Archive restore: $ts ═══"

    if [ ! -f "$src" ]; then
        log "❌ Archive not found: $src"
        return 1
    fi

    enable_maintenance

    # Decompress to temp
    local tmp_db="/tmp/kontraktor_restore_$$.db"
    gunzip -c "$src" > "$tmp_db"

    if ! validate_db "$tmp_db"; then
        log "❌ Archive backup failed validation"
        rm -f "$tmp_db"
        disable_maintenance
        return 1
    fi

    # Save current DB
    local pre_dump="$BACKUP_DIR/pre_restore_$(date +%Y%m%d_%H%M%S).db"
    if [ -f "$DB_PATH" ]; then
        sqlite3 "$DB_PATH" ".backup '$pre_dump'" 2>/dev/null && \
            gzip "$pre_dump" 2>/dev/null || true
    fi

    # Copy restore
    cp "$tmp_db" "$DB_PATH"
    chmod 600 "$DB_PATH"
    rm -f "$tmp_db"

    if validate_db "$DB_PATH"; then
        log "✅✅ Archive restore successful"
        disable_maintenance
        return 0
    else
        log "❌ Restore failed integrity check"
        disable_maintenance
        return 1
    fi
}

# ── List all restore points ──
do_list() {
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo "  Kontraktor DB — Restore Points"
    echo "═══════════════════════════════════════════════════"
    echo ""

    # Litestream (PITR)
    echo "── Litestream WAL Archive (PITR, ~RPO=0) ──"
    if [ -d "$LITESTREAM_DIR" ] && [ -n "$(ls -A "$LITESTREAM_DIR" 2>/dev/null)" ]; then
        local gen_count
        gen_count=$(litestream generations "$LITESTREAM_DIR" 2>/dev/null | wc -l)
        local archive_size
        archive_size=$(du -sh "$LITESTREAM_DIR" 2>/dev/null | cut -f1)
        echo "   Archive size: $archive_size"
        echo "   Generations:  $gen_count"
        echo "   Latest:       litestream restore -o kontraktor.prod.db backups/litestream/"
        echo "   At time:      litestream restore -o kontraktor.prod.db -t \"YYYY-MM-DD HH:MM\" backups/litestream/"
        echo ""
        echo "   Restore via script:"
        echo "     ./restore.sh latest              # Latest state"
        echo "     ./restore.sh -t \"2026-06-23 12:00\"  # At specific time"
    else
        echo "   (no Litestream archive yet — run PM2: kontraktor-litestream)"
    fi
    echo ""

    # Classic archive (6-hourly)
    echo "── Classic Archive Backups (6h) ──"
    if ls "$ARCHIVE_DIR"/kontraktor_prod_*.db.gz 1>/dev/null 2>&1; then
        ls -lt "$ARCHIVE_DIR"/kontraktor_prod_*.db.gz | \
            awk '{print "  " $6, $7, $8, " — " $NF}' | \
            sed 's|.*/kontraktor_prod_||;s|\.db\.gz$||'
        echo ""
        echo "   Restore: ./restore.sh --from-archive YYYYMMDD_HHMMSS"
    else
        echo "   (none)"
    fi
    echo ""
}

# ═══════════════════════╗
#          MAIN          ║
# ═══════════════════════╝

mkdir -p "$BACKUP_DIR"
CMD="${1:-list}"

case "$CMD" in
    list|-l|--list)
        do_list
        ;;
    latest|restore)
        do_litestream_restore
        ;;
    -t|--time|--at)
        TIMESTAMP="${2:-}"
        if [ -z "$TIMESTAMP" ]; then
            echo "Usage: $0 -t \"YYYY-MM-DD HH:MM\""
            exit 1
        fi
        do_litestream_restore "$TIMESTAMP"
        ;;
    --from-archive)
        TS="${2:-}"
        if [ -z "$TS" ]; then
            echo "Usage: $0 --from-archive YYYYMMDD_HHMMSS"
            exit 1
        fi
        do_archive_restore "$TS"
        ;;
    *)
        echo "Usage: $0 {list|latest|-t \"YYYY-MM-DD HH:MM\"|--from-archive TS}"
        echo ""
        echo "  $0 list                     — Show restore points"
        echo "  $0 latest                   — Restore to latest (PITR)"
        echo "  $0 -t \"2026-06-23 12:00\"    — Restore to specific time"
        echo "  $0 --from-archive 20260623_000001 — From archive"
        exit 1
        ;;
esac

