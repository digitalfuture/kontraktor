"""Batch 2: Replace remaining inline SVGs with Material Symbols."""
import re
from pathlib import Path

TEMPLATE_DIR = Path('/root/kontraktor/src/views')

SVG_MAP = {
    # Checkmark simple
    'M5 13l4 4L19 7': ('check', 'w-5 h-5'),
    # Lock
    'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z': ('lock', 'w-4 h-4'),
    # Link
    'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1': ('link', 'w-4 h-4'),
    # Payments / money
    'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z': ('payments', 'w-6 h-6'),
    # Location on (map pin)
    'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z': ('location_on', 'w-6 h-6'),
    # Dashboard / layout panel
    'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z': ('dashboard', 'w-5 h-5'),
    # Ratings / star
    'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z': ('star', 'w-5 h-5'),
    # List / menu
    'M4 6h16M4 12h16M4 18h16': ('menu', 'w-4 h-4'),
    # Notification bell
    'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9': ('notifications', 'w-5 h-5'),
    # Info/i icon for notifications
    'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z': ('info', 'w-5 h-5'),
    # Alert triangle
    'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z': ('warning', 'w-5 h-5'),
    # Success check circle (for notification)
    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z': ('check_circle', 'w-5 h-5'),
    # Delete (for admin notification close)
    'M6 18L18 6M6 6l12 12': ('close', 'w-4 h-4'),
    # History / refresh
    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15': ('sync', 'w-4 h-4'),
}

# Additional files to process
files = [
    'partials/_sitemap.ejs',
    'partials/_admin-user-actions.ejs',
    'partials/_admin-contractor-actions.ejs',
    'partials/_admin-review-actions.ejs',
    'partials/_admin_chart_card.ejs',
    'admin/contractors.ejs',
    'admin/_notification.ejs',
    'admin/backup.ejs',
    'admin/email-settings.ejs',
    'admin/orders.ejs',
    'admin/dashboard.ejs',
    'admin/database.ejs',
    'admin/diagrams.ejs',
    'admin/email.ejs',
    'admin/reviews.ejs',
    'admin/payments.ejs',
    'admin/users.ejs',
    'admin/_sidebar.ejs',
    'admin/email-templates.ejs',
    'admin/email-template-editor.ejs',
    'post-success.ejs',
    'specialist.ejs',
]

def size_to_text(w_val):
    return {4: 'text-base', 5: 'text-xl', 6: 'text-2xl', 8: 'text-3xl', 10: 'text-4xl', 16: 'text-7xl',
            3: 'text-xs', 3.5: 'text-sm'}.get(w_val, 'text-xl')

processed = 0
replaced = 0

for svg_path in sorted(SVG_MAP.keys(), key=len, reverse=True):
    icon_name, size_class = SVG_MAP[svg_path]
    escaped = re.escape(svg_path)
    
    for rel_path in files:
        full = TEMPLATE_DIR / rel_path
        if not full.exists():
            continue
        
        try:
            content = full.read_text()
        except Exception:
            continue
        
        pattern = r'(<svg\s+([^>]*?)>.*?' + escaped + r'.*?</svg>)'
        matches = list(re.finditer(pattern, content, re.DOTALL))
        
        if not matches:
            continue
        
        for m in reversed(matches):
            full_svg = m.group(1)
            attrs = m.group(2) or ''
            
            # Extract color classes
            cfg = re.findall(r'class="([^"]*?)"', full_svg)
            color_classes = ' '.join(cfg) if cfg else ''
            
            color_parts = re.findall(r'(?:^|\s)((?:text|fill)-[a-z0-9-]+(?:/[0-9]+)?(?: dark:(?:text|fill)-[a-z0-9-]+(?:/[0-9]+)?)?)', color_classes)
            color_str = ' '.join(color_parts) if color_parts else ''
            
            aria_m = re.search(r'aria-label="([^"]*?)"', full_svg)
            aria = f' aria-label="{aria_m.group(1)}"' if aria_m else ''
            
            w_m = re.search(r'w-([\d.]+)', attrs)
            w_val = float(w_m.group(1)) if w_m else 5
            text_size = size_to_text(w_val)
            
            replacement = f'<span class="mat-icon {text_size} {color_str}"{aria}>{icon_name}</span>'
            content = content[:m.start()] + replacement + content[m.end():]
            replaced += 1
        
        full.write_text(content)
        processed += 1

print(f'Batch 2: {processed} files touched, {replaced} replacements')
