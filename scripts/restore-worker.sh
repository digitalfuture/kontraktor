#!/bin/bash
# Kontraktor — Restore Worker (async restore daemon)
# Polls for restore-request.json, executes restore, writes status.
# Launched by Express API on-demand, or runs as PM2 daemon.
#
# Modes:
#   Direct:  bash restore-worker.sh
#   PM2:     pm2 start scripts/restore-worker.sh --name kontraktor-restore-worker

set -e

APP_DIR="/root/kontraktor"
BACKUP_DIR="$APP_DIR/backups"
DB_PATH="$APP_DIR/data/kontraktor.prod.db"
RESTORE_REQUEST="$BACKUP_DIR/restore-request.json"
RESTORE_STATUS="$BACKUP_DIR/restore-status.json"
RESTORE_HISTORY="$BACKUP_DIR/restore-history.json"
RESTORE_LOCK="$BACKUP_DIR/restore.lock"
MAINTENANCE_SCRIPT="$APP_DIR/scripts/maintenance.sh"
LITESTREAM_CONFIG="$APP_DIR/litestream.yml"
LITESTREAM_DIR="$BACKUP_DIR/litestream"
RESTORE_LOG="$BACKUP_DIR/restore-worker.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$RESTORE_LOG"; }

write_status() {
  local pending="$1"
  local msg="$2"
  echo "{\"pending\":$pending,\"message\":\"$msg\",\"updated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$RESTORE_STATUS"
}

# ── Enable maintenance + stop services ──
enable_maintenance() {
  log "🟡 Enabling maintenance mode..."
  bash "$MAINTENANCE_SCRIPT" on "Database restore — site under maintenance" || true

  if pm2 pid kontraktor-litestream >/dev/null 2>&1; then
    log "🟡 Stopping kontraktor-litestream..."
    pm2 stop kontraktor-litestream 2>/dev/null || true; sleep 1
  fi

  if pm2 pid kontraktor-prod >/dev/null 2>&1; then
    log "🟡 Stopping kontraktor-prod..."
    pm2 stop kontraktor-prod 2>/dev/null || true; sleep 2
  fi
  log "🟡 All processes stopped."
}

# ── Restart services ──
disable_maintenance() {
  log "🟢 Starting Litestream..."
  pm2 start kontraktor-litestream 2>/dev/null || true; sleep 1
  log "🟢 Starting kontraktor-prod..."
  pm2 start kontraktor-prod 2>/dev/null || pm2 restart kontraktor-prod 2>/dev/null || true; sleep 2
  bash "$MAINTENANCE_SCRIPT" off || true
  log "🟢 All services restored."
}

# ── Validate DB ──
validate_db() {
  local file="$1"
  if [ ! -f "$file" ]; then echo "❌ File not found: $file"; return 1; fi
  local result
  result=$(sqlite3 "$file" "PRAGMA integrity_check;" 2>&1)
  if [ "$result" = "ok" ]; then log "✅ Integrity: PASS"; return 0
  else log "❌ Integrity FAILED: $result"; return 1; fi
}

# ── Restore from archive backup ──
do_archive_restore() {
  local ts="$1"
  local src="$BACKUP_DIR/kontraktor_prod_${ts}.db.gz"
  log "═══ Archive restore: $ts ═══"

  if [ ! -f "$src" ]; then
    log "❌ Archive not found: $src"
    return 1
  fi

  local tmp_db="/tmp/kontraktor_worker_restore_$$.db"
  gunzip -c "$src" > "$tmp_db"
  if ! validate_db "$tmp_db"; then rm -f "$tmp_db"; return 1; fi

  local pre_dump="$BACKUP_DIR/pre_restore_$(date +%Y%m%d_%H%M%S).db"
  if [ -f "$DB_PATH" ]; then
    sqlite3 "$DB_PATH" ".backup '$pre_dump'" 2>/dev/null && gzip "$pre_dump" 2>/dev/null || true
  fi

  cp "$tmp_db" "$DB_PATH"; chmod 600 "$DB_PATH"; rm -f "$tmp_db"
  validate_db "$DB_PATH"
}

# ── Restore from Litestream (PITR) ──
do_litestream_restore() {
  log "═══ Litestream restore ═══"

  if [ ! -d "$LITESTREAM_DIR" ] || [ -z "$(ls -A "$LITESTREAM_DIR" 2>/dev/null)" ]; then
    log "❌ Litestream archive empty"
    return 1
  fi

  local pre_dump="$BACKUP_DIR/pre_restore_$(date +%Y%m%d_%H%M%S).db"
  if [ -f "$DB_PATH" ]; then
    sqlite3 "$DB_PATH" ".backup '$pre_dump'" 2>/dev/null && gzip "$pre_dump" 2>/dev/null || true
  fi

  log "⏳ Running: litestream restore --config \"$LITESTREAM_CONFIG\" -force -o \"$DB_PATH\" \"$DB_PATH\""
  if litestream restore --config "$LITESTREAM_CONFIG" -force -o "$DB_PATH" "$DB_PATH" 2>&1; then
    chmod 600 "$DB_PATH"
    log "✅ Litestream restore completed"
    validate_db "$DB_PATH"
  else
    log "❌ Litestream restore failed"
    return 1
  fi
}

# ── Undo: restore from pre_restore backup ──
do_undo() {
  local pre_file="$1"
  local pre_path="$BACKUP_DIR/$pre_file"
  log "═══ Undo: revert to $pre_file ═══"

  if [ ! -f "$pre_path" ]; then
    log "❌ Pre-restore backup not found: $pre_path"
    return 1
  fi

  local tmp_db="/tmp/kontraktor_undo_$$.db"
  gunzip -c "$pre_path" > "$tmp_db"
  if ! validate_db "$tmp_db"; then rm -f "$tmp_db"; return 1; fi

  # Save current (might be needed for redo)
  local crash_backup="$BACKUP_DIR/post_undo_$(date +%Y%m%d_%H%M%S).db"
  if [ -f "$DB_PATH" ]; then
    sqlite3 "$DB_PATH" ".backup '$crash_backup'" 2>/dev/null && gzip "$crash_backup" 2>/dev/null || true
  fi

  cp "$tmp_db" "$DB_PATH"; chmod 600 "$DB_PATH"; rm -f "$tmp_db"
  validate_db "$DB_PATH"
}

# ═══════════════════════════╗
#         MAIN LOOP          ║
# ═══════════════════════════╝

mkdir -p "$BACKUP_DIR"

# If called directly (single execution), process one request
if [ "${1:-}" != "--daemon" ]; then
  if [ ! -f "$RESTORE_REQUEST" ]; then
    write_status false "No pending requests."
    exit 0
  fi

  # Lock
  if [ -f "$RESTORE_LOCK" ]; then
    log "⚠️ Lock exists (another worker is running)"
    exit 1
  fi
  touch "$RESTORE_LOCK"
  trap "rm -f '$RESTORE_LOCK'" EXIT

  # Read request
  REQUEST=$(cat "$RESTORE_REQUEST")
  TARGET=$(echo "$REQUEST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('target',''))" 2>/dev/null || echo "")
  LABEL=$(echo "$REQUEST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('label',''))" 2>/dev/null || echo "")

  log "📋 Processing restore request: target=$TARGET label=$LABEL"
  write_status true "Processing restore: $LABEL"

  # Enable maintenance
  enable_maintenance

  # Execute restore
  STATUS="failed"
  PRE_RESTORE_FILE=""

  if echo "$TARGET" | grep -q "^undo:"; then
    PRE_FILE=$(echo "$TARGET" | sed 's/^undo://')
    if do_undo "$PRE_FILE"; then
      STATUS="completed"
      PRE_RESTORE_FILE=""
    fi
  elif echo "$TARGET" | grep -q "^archive:"; then
    TS=$(echo "$TARGET" | sed 's/^archive://')
    if do_archive_restore "$TS"; then
      STATUS="completed"
      # Find pre_restore file created during this operation
      PRE_RESTORE_FILE=$(ls -t "$BACKUP_DIR"/pre_restore_*.db.gz 2>/dev/null | head -1 | xargs -r basename)
    fi
  elif [ "$TARGET" = "latest" ]; then
    if do_litestream_restore; then
      STATUS="completed"
      PRE_RESTORE_FILE=$(ls -t "$BACKUP_DIR"/pre_restore_*.db.gz 2>/dev/null | head -1 | xargs -r basename)
    fi
  else
    log "❌ Unknown target type: $TARGET"
  fi

  # Restart services
  disable_maintenance

  # Record history
  ENTRY="{\"time\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"target\":\"$TARGET\",\"target_label\":\"$LABEL\",\"status\":\"$STATUS\",\"pre_restore_file\":\"$PRE_RESTORE_FILE\",\"requestedBy\":$(echo "$REQUEST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('requestedBy','')))" 2>/dev/null || echo "\"\""),\"requestedAt\":$(echo "$REQUEST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('requestedAt','')))" 2>/dev/null || echo "\"\"")}"

  # Append to history
  python3 -c "
import json, os
hfile = '$RESTORE_HISTORY'
entry = json.loads('''$ENTRY'''.replace(chr(92)+chr(39), chr(39)))
try:
    with open(hfile) as f:
        h = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    h = {'history': []}
h['last_restore'] = entry
h['history'].insert(0, entry)
if len(h['history']) > 50:
    h['history'] = h['history'][:50]
with open(hfile, 'w') as f:
    json.dump(h, f, indent=2)
print('ok')
"

  # Clean up
  rm -f "$RESTORE_REQUEST"
  write_status false "Completed: $STATUS — $LABEL"
  log "✅ Done. Status: $STATUS"
  exit 0
fi

# ── Daemon mode: poll every 30s ──
log "🟢 Restore worker daemon started (polling every 30s)"
while true; do
  if [ -f "$RESTORE_REQUEST" ]; then
    log "📬 New restore request detected"
    # Fork child to process, continue polling
    bash "$0" &
  fi
  # Clean stale locks (>5 min)
  if [ -f "$RESTORE_LOCK" ]; then
    LOCK_AGE=$(($(date +%s) - $(stat -c%Y "$RESTORE_LOCK" 2>/dev/null || echo 0)))
    if [ "$LOCK_AGE" -gt 300 ]; then
      log "⚠️ Removing stale lock ($LOCK_AGE seconds old)"
      rm -f "$RESTORE_LOCK"
    fi
  fi
  sleep 30
done
