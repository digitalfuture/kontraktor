#!/bin/bash
# Kontraktor — Maintenance Mode Control
# Usage:
#   ./maintenance.sh on     — Enable maintenance mode (503 + static page)
#   ./maintenance.sh off    — Disable maintenance mode
#   ./maintenance.sh status — Check current status
#   ./maintenance.sh on "Custom message" — Enable with custom reason

set -e

FLAG_FILE="/root/kontraktor/.maintenance"
NGINX_AVAILABLE="/etc/nginx/sites-available/kontraktor.app"
NGINX_ENABLED="/etc/nginx/sites-enabled/kontraktor.app"

case "${1:-status}" in
    on)
        MSG="${2:-Scheduled maintenance in progress}"
        echo "$MSG" > "$FLAG_FILE"
        echo "$(date +%s)" >> "$FLAG_FILE"
        chmod 644 "$FLAG_FILE"

        # Reload nginx if config updated (will serve static maintenance page)
        if [ -f "$NGINX_ENABLED" ]; then
            nginx -t 2>/dev/null && nginx -s reload 2>/dev/null && \
                echo "✅ nginx reloaded" || echo "⚠️  nginx reload skipped"
        fi

        echo "🟡 Maintenance mode ON"
        echo "   Flag: $FLAG_FILE"
        ;;
    off)
        if [ -f "$FLAG_FILE" ]; then
            rm -f "$FLAG_FILE"
            # Reload nginx to restore normal routing
            if [ -f "$NGINX_ENABLED" ]; then
                nginx -t 2>/dev/null && nginx -s reload 2>/dev/null && \
                    echo "✅ nginx reloaded" || echo "⚠️  nginx reload skipped"
            fi
            echo "🟢 Maintenance mode OFF"
        else
            echo "ℹ️  Maintenance mode was not active"
        fi
        ;;
    status)
        if [ -f "$FLAG_FILE" ]; then
            MSG=$(head -1 "$FLAG_FILE")
            STARTED=$(tail -1 "$FLAG_FILE" 2>/dev/null)
            if [ -n "$STARTED" ] && [ "$STARTED" -gt 1000000000 ] 2>/dev/null; then
                ELAPSED=$(( $(date +%s) - STARTED ))
                echo "🟡 Maintenance mode ACTIVE ($((ELAPSED / 60))m ${ELAPSED}s)"
            else
                echo "🟡 Maintenance mode ACTIVE"
            fi
            echo "   Message: $MSG"
        else
            echo "🟢 Maintenance mode OFF"
        fi
        ;;
    *)
        echo "Usage: $0 {on|off|status} [message]"
        exit 1
        ;;
esac
