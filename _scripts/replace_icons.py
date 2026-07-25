"""Replace inline SVG icons with Material Symbols in EJS templates."""
import re
from pathlib import Path

TEMPLATE_DIR = Path('/root/kontraktor/src/views')

# SVG path fingerprint -> (Material Symbol name, default size class)
SVG_MAP = {
    'M4 6h16M4 12h16M4 18h16': ('menu', 'w-6 h-6'),
    'M6 18L18 6M6 6l12 12': ('close', 'w-5 h-5'),
    'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z': ('grid_view', 'w-5 h-5'),
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4': ('description', 'w-5 h-5'),
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2': ('description', 'w-5 h-5'),
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857': ('groups', 'w-5 h-5'),
    'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z': ('person', 'w-5 h-5'),
    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1': ('logout', 'w-4 h-4'),
    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6': ('home', 'w-5 h-5'),
    'M9 5l7 7-7 7': ('chevron_right', 'w-4 h-4'),
    'M10 19l-7-7m0 0l7-7m0 0h12': ('arrow_back', 'w-5 h-5'),
    'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1': ('login', 'w-5 h-5'),
    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z': ('search', 'w-5 h-5'),
    'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z': ('check_circle', 'w-5 h-5'),
    'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z': ('check_circle', 'w-5 h-5'),
    'M12 4v16m8-8H4': ('add', 'w-5 h-5'),
    'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z': ('person_add', 'w-5 h-5'),
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.573-1.066z': ('settings', 'w-4 h-4'),
    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16': ('delete', 'w-5 h-5'),
    'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z': ('star', 'w-5 h-5'),
    'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z': ('mail', 'w-5 h-5'),
    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15': ('sync', 'w-5 h-5'),
    'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15': ('sync', 'w-4 h-4'),
    'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z': ('label', 'w-5 h-5'),
    'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z': ('visibility', 'w-5 h-5'),
    'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4': ('code', 'w-5 h-5'),
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z': ('bar_chart', 'w-5 h-5'),
    'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4': ('storage', 'w-5 h-5'),
    'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z': ('image', 'w-5 h-5'),
    'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9': ('notifications', 'w-5 h-5'),
    'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z': ('mail', 'w-5 h-5'),
    'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z': ('info', 'w-8 h-8'),
    'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4': ('fullscreen', 'w-4 h-4'),
    'M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25': ('fullscreen_exit', 'w-4 h-4'),
    'M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z': ('light_mode', 'w-5 h-5'),
    'M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z': ('dark_mode', 'w-5 h-5'),
    'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM15 13a3 3 0 11-6 0 3 3 0 016 0z': ('photo_camera', 'w-6 h-6'),
    'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z': ('people', 'w-5 h-5'),
    'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4': ('download', 'w-3.5 h-3.5'),
    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16': ('delete', 'w-16 h-16'),
    'M15 12a3 3 0 11-6 0 3 3 0 016 0z': ('visibility', 'w-5 h-5'),
    'M12 6v6l4 2': ('schedule', 'w-5 h-5'),
    'M4 16v4h4': ('chevron_right', 'w-5 h-5'),
    'M20 12H4': ('remove', 'w-5 h-5'),
    'M6 18L18 6M6 6l12 12': ('close', 'w-6 h-6'),
    'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z': ('image', 'w-4 h-4'),
}

files = [
    'partials/header.ejs',
    'partials/_account-sidebar.ejs',
    'partials/_page-header.ejs',
    'partials/_sidebar-header.ejs',
    'partials/_controls.ejs',
    'partials/_admin_chart_card.ejs',
    'partials/_admin-user-actions.ejs',
    'partials/_admin-contractor-actions.ejs',
    'partials/_admin-review-actions.ejs',
    'partials/hero.ejs',
    'partials/reviews.ejs',
    'index.ejs',
    'services.ejs',
    'contractor-dashboard.ejs',
    'project-detail.ejs',
    'auth/link-sent.ejs',
    'auth/login.ejs',
    'post.ejs',
    'admin/_sidebar.ejs',
    'admin/_edit-mode.ejs',
    'admin/users.ejs',
    'admin/reviews.ejs',
    'admin/payments.ejs',
    'admin/email.ejs',
    'admin/email-templates.ejs',
    'admin/email-template-editor.ejs',
    'admin/trash.ejs',
    'admin/database.ejs',
    'admin/diagrams.ejs',
    'admin/partials/_back-link.ejs',
    'admin/partials/_list-name-display.ejs',
    'admin/partials/_list-name-display-list.ejs',
    'unsubscribe.ejs',
]

def size_to_text(w_val):
    return {4: 'text-base', 5: 'text-xl', 6: 'text-2xl', 8: 'text-3xl', 10: 'text-4xl', 16: 'text-7xl',
            3: 'text-xs', 3.5: 'text-sm'}.get(w_val, 'text-xl')

processed = 0
replaced = 0
errors = 0

# Sort by path length (longest first) to avoid partial matches
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
            errors += 1
            continue
        
        # Find complete <svg...>...</svg> blocks containing this path
        # Pattern: capture the whole svg tag including its attributes, then the nested path
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
            
            # Extract text-color classes
            color_parts = re.findall(r'(?:^|\s)((?:text|fill)-[a-z0-9-]+(?:/[0-9]+)?(?: dark:(?:text|fill)-[a-z0-9-]+(?:/[0-9]+)?)?)', color_classes)
            color_str = ' '.join(color_parts) if color_parts else ''
            
            # Extract aria-label
            aria_m = re.search(r'aria-label="([^"]*?)"', full_svg)
            aria = f' aria-label="{aria_m.group(1)}"' if aria_m else ''
            
            # Get size from SVG class
            w_m = re.search(r'w-([\d.]+)', attrs)
            w_val = float(w_m.group(1)) if w_m else 5
            text_size = size_to_text(w_val)
            
            # Also get inline size from inner SVGs that might have different sizes
            # Preserve text-orange etc color classes
            replacement = f'<span class="mat-icon {text_size} {color_str}"{aria}>{icon_name}</span>'
            content = content[:m.start()] + replacement + content[m.end():]
            replaced += 1
        
        full.write_text(content)
        processed += 1

print(f'Done: {processed} files touched, {replaced} replacements total')
