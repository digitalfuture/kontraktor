#!/bin/bash
# Check all admin pages for 500 errors
# Usage: TOKEN=... bash check-admin.sh
set -euo pipefail

TOKEN="${TOKEN:-}"
BASE="http://localhost:3003"
FAIL=0
TOTAL=0

if [ -z "$TOKEN" ]; then
  echo "❌ Usage: TOKEN=<session_token> bash $0"
  exit 1
fi

check() {
  TOTAL=$((TOTAL + 1))
  local url="$1"
  local label="${2:-$url}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -b "session_token=$TOKEN" "$BASE$url" 2>&1)
  case "$code" in
    500) echo "  🔴 500 $label ($url)"; FAIL=$((FAIL + 1)) ;;
    200) echo "  ✅ 200 $label" ;;
    302) echo "  ⚠️  302 (redirect) $label" ;;
    *)   echo "  ⚠️  $code $label ($url)" ;;
  esac
}

echo "=== ADMIN PAGES ==="
check "/admin" "Dashboard"
check "/admin/projects" "Projects list"
check "/admin/contractors" "Contractors list"
check "/admin/categories" "Categories"
check "/admin/reviews" "Reviews"
check "/admin/trash" "Trash"
check "/admin/users" "Users"
check "/admin/email" "Email"
check "/admin/email/inbox" "Email Inbox"
check "/admin/email/campaigns" "Email Campaigns"
check "/admin/email/templates" "Email Templates"
check "/admin/email/lists" "Email Lists"
check "/admin/payments" "Payments"
check "/admin/payments/settings" "Payments Settings"
check "/admin/diagrams" "Diagrams"
check "/admin/analytics" "Analytics"

echo ""
echo "=== ADMIN API ==="
check "/api/admin/map" "API Map"
check "/api/admin/sankey" "API Sankey"
check "/api/admin/sankey-category-status" "API Sankey Categ-Status"
check "/api/admin/network-graph" "API Network Graph"
check "/api/admin/diagrams/sitemap-content" "API Sitemap Content"
check "/api/admin/email/queue-stats" "API Email Queue Stats"

echo ""
echo "=== PUBLIC PAGES ==="
check "/" "Home"
check "/services" "Services"
check "/contractors" "Contractors"
check "/post" "Post Project"
check "/auth/login" "Login"
check "/sitemap.xml" "Sitemap XML"

echo ""
echo "───────────"
if [ $FAIL -gt 0 ]; then
  echo "🔴 FAIL: $FAIL of $TOTAL returned 500"
  exit 1
else
  echo "✅ ALL $TOTAL OK — no 500 errors"
fi
