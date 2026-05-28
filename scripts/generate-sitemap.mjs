#!/usr/bin/env node
/**
 * Auto-generate site structural diagram + user flow from Express routes.
 * Run: node scripts/generate-sitemap.mjs
 * Output: docs/sitemap.html  (self-contained, open in browser)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// ── Parser ──────────────────────────────────────────────────────────────────

/** Read file, return lines. */
function readLines(file) {
  const text = fs.readFileSync(file, 'utf-8');
  return text.split('\n');
}

/**
 * Parse routes/index.ts for `app.use('/path', [middleware,] router)` lines.
 * Returns array of { mount, middleware, routerFile }.
 */
function parseMounts() {
  const lines = readLines(path.join(SRC, 'index.ts'));
  const mounts = [];
  const re = /app\.use\(['"]([^'"]+)['"],?\s*(.*?)\);/g;
  let m;
  while ((m = re.exec(lines.join('\n'))) !== null) {
    const mount = m[1];
    const args = m[2];
    // Extract router variable name
    const routerMatch = args.match(/(\w+Router)/);
    if (!routerMatch) continue;
    const varName = routerMatch[1];
    // Extract middlewares (e.g. requireAuth, requireAdmin)
    const middleware = args
      .replace(varName, '')
      .replace(/,\s*$/, '')
      .split(',')
      .map(s => s.trim())
      .filter(s => s && s !== varName && !s.startsWith('//'));
    // Map variable name to file path
    // The import pattern: `import adminRouter from './routes/admin'`
    const importLines = lines.filter(l => l.includes(varName) && l.includes('import'));
    let routerFile = null;
    for (const il of importLines) {
      const im = il.match(/['"]\.\/routes\/([^'"]+)['"]/);
      if (im) routerFile = im[1];
    }
    mounts.push({ mount, middleware, routerFile, varName });
  }
  return mounts;
}

/**
 * Parse a router file for endpoint definitions.
 * Returns array of { method, path, middleware, view }.
 */
function parseRouter(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split('\n');
  const endpoints = [];

  // Collect all middleware names defined in this file
  const localMiddles = new Set();
  const constRe = /(?:const|let|var)\s+(\w+)\s*=\s*(?:require\(['"])?/g;
  let cm;
  while ((cm = constRe.exec(text)) !== null) {
    // Heuristic: variable names ending in Middleware, Limiter, Auth, Check
    if (/Middleware|Limiter|Auth|Check|Guard|Validate/i.test(cm[1])) {
      localMiddles.add(cm[1]);
    }
  }

  // Route patterns
  const routeRe = /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]\s*,/g;
  let rm;
  while ((rm = routeRe.exec(text)) !== null) {
    const method = rm[1].toUpperCase();
    const route = rm[2];
    const startIdx = rm.index;
    // Extract middleware between the route string and the handler function
    const remainder = text.slice(rm.index + rm[0].length);
    const handlerRe = /(?:\(?\s*(?:req|_req)\s*,?\s*(?:res|_res)\s*\)?\s*(?::[^=]+)?\s*(?:=>|{))/;
    const handlerMatch = remainder.match(handlerRe);
    const handlerStart = handlerMatch ? handlerMatch.index : -1;
    const handlerEnd = handlerStart >= 0 ? handlerStart + handlerMatch[0].length : -1;

    // Extract middleware arguments (strings or identifiers between route path and first callback)
    const middlewareStr = handlerStart > 0 ? remainder.slice(0, handlerStart) : '';
    const middleware = [];
    // Match identifiers (function names) that are not strings
    const mwRe = /([a-zA-Z_$][\w$.]+\s*(?=\s*,|\s*\)))/g;
    let mw;
    while ((mw = mwRe.exec(middlewareStr)) !== null) {
      const name = mw[1].trim();
      if (name && !name.startsWith("'") && !name.startsWith('"') && name.length > 1) {
        middleware.push(name);
      }
    }

    // Find view template via res.render
    const afterHandler = handlerEnd >= 0 ? text.slice(rm.index + rm[0].length + handlerEnd) : '';
    const renderMatch = afterHandler.match(/res\.render\s*\(\s*['"]([^'"]+)['"]/);
    const view = renderMatch ? renderMatch[1] : null;

    // Find redirect
    const redirectMatch = afterHandler.match(/res\.redirect\s*\(\s*['"]([^'"]+)['"]/);
    const redirect = redirectMatch ? redirectMatch[1] : null;

    endpoints.push({
      method,
      path: route,
      middleware: middleware.filter(m => m !== route && !m.includes("'") && !m.includes('"')),
      view,
      redirect,
    });
  }

  return endpoints;
}

/** Get a human-friendly label for a view path */
function viewLabel(view) {
  if (!view) return null;
  return view.replace(/^admin\//, '📊 ').replace(/^auth\//, '🔐 ').replace(/^account\//, '👤 ');
}

/** Get icon for HTTP method */
function methodIcon(m) {
  const icons = { GET: '📄', POST: '➕', PUT: '📝', DELETE: '🗑️', PATCH: '🔧' };
  return icons[m] || '➡️';
}

/** Determine category for color groups */
function categoryFor(mount) {
  if (mount === '/admin') return 'admin';
  if (mount === '/auth') return 'auth';
  if (mount === '/account') return 'account';
  if (mount === '/payments') return 'payments';
  return 'public';
}

// ── Generation ──────────────────────────────────────────────────────────────

function generateMermaid(mounts) {
  const lines = [];
  lines.push('graph TB');
  lines.push('');

  // Root node
  lines.push('  root["🏠 Kontraktor"]');
  lines.push('  style root fill:#ea580c,color:#fff,font-weight:bold');
  lines.push('');

  const colors = {
    admin: '#1e40af',
    auth: '#7c3aed',
    account: '#059669',
    payments: '#d97706',
    public: '#4b5563',
  };

  const groups = {};
  let nodeId = 0;

  for (const mount of mounts) {
    const cat = categoryFor(mount.mount);
    const routerFile = path.join(SRC, 'routes', mount.routerFile + '.ts');
    const endpoints = parseRouter(routerFile);
    const displayPath = mount.mount === '/' ? 'Home' : mount.mount;

    // Mount node
    const mountId = `m${nodeId++}`;
    const mwLabel = mount.middleware.length
      ? mount.middleware.map(m => m.replace('require', '🛡️')).join('<br/>')
      : '';
    const label = mwLabel ? `${displayPath}<br/><small>${mwLabel}</small>` : displayPath;
    lines.push(`  ${mountId}["${label}"]`);
    lines.push(`  style ${mountId} fill:${colors[cat] || colors.public},color:#fff`);
    lines.push(`  root --> ${mountId}`);
    lines.push('');

    // Group admin sub-routes
    if (cat === 'admin' && mount.routerFile) {
      const subGroups = [];
      for (const ep of endpoints) {
        const subCat = ep.path.replace(/^\//, '').split('/')[0] || 'dashboard';
        if (!subGroups.includes(subCat)) subGroups.push(subCat);
      }
    }

    // Endpoint nodes
    for (const ep of endpoints) {
      const epId = `e${nodeId++}`;
      const icon = methodIcon(ep.method);
      const view = viewLabel(ep.view);
      const viewText = view ? `<br/><small>🎨 ${view}</small>` : '';
      const redirectText = ep.redirect ? `<br/><small>↪️ ${ep.redirect}</small>` : '';
      const epPath = ep.path === '/' ? '' : ep.path;
      const epShow = epPath || '/';
      const mwText = ep.middleware.length
        ? `<br/><small>🛡️ ${ep.middleware.join(', ')}</small>`
        : '';
      
      lines.push(`  ${epId}["${icon} ${ep.method} ${epShow}${viewText}${redirectText}${mwText}"]`);
      lines.push(`  style ${epId} fill:${colors[cat] || colors.public},color:#fff`);
      lines.push(`  ${mountId} --> ${epId}`);

      // Add redirect as arrow
      if (ep.redirect && ep.redirect.startsWith('/')) {
        const targetRoute = ep.redirect;
        lines.push(`  ${epId} -.->|redirect| ${targetRoute.replace(/\//g, '_')}[${targetRoute}]`);
        lines.push(`  style ${targetRoute.replace(/\//g, '_')} fill:#888,color:#fff`);
      }
    }

    // Add special routing for root endpoints on the index router
    if (mount.mount === '/' && mount.routerFile) {
      for (const ep of endpoints) {
        // These are on the root router — show them directly
        if (ep.path === '/' || ep.path === '' || ep.path === '/contact' || ep.path.startsWith('/sitemap')) {
          // Already added under root
        }
      }
    }
  }

  return lines.join('\n');
}

// ── HTML Output ─────────────────────────────────────────────────────────────

function generateHtml(mermaidDef) {
  // Escape { and } for HTML
  const encoded = mermaidDef.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kontraktor — Site Structure & User Flow</title>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0f172a;
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 2rem;
    min-height: 100vh;
  }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.75rem; }
  h1 small { font-size: 0.8rem; color: #64748b; font-weight: normal; }
  .meta { font-size: 0.85rem; color: #64748b; margin-bottom: 2rem; }
  .legend {
    display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.5rem;
    padding: 1rem; background: #1e293b; border-radius: 0.5rem; border: 1px solid #334155;
  }
  .legend-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; }
  .legend-dot { width: 12px; height: 12px; border-radius: 2px; display: inline-block; }
  #diagram {
    background: #1e293b;
    border-radius: 0.75rem;
    padding: 2rem;
    border: 1px solid #334155;
    overflow-x: auto;
  }
  #diagram svg { max-width: 100%; height: auto; }
  .controls { margin-bottom: 1rem; display: flex; gap: 1rem; align-items: center; }
  .controls button {
    background: #334155; color: #e2e8f0; border: none;
    padding: 0.4rem 1rem; border-radius: 0.3rem; cursor: pointer; font-size: 0.85rem;
  }
  .controls button:hover { background: #475569; }
  .footer { margin-top: 2rem; font-size: 0.75rem; color: #475569; text-align: center; }
</style>
</head>
<body>

<h1>🧭 Kontraktor — Site Structure & User Flow <small>auto-generated from routes</small></h1>

<div class="legend">
  <span class="legend-item"><span class="legend-dot" style="background:#ea580c"></span> Entry</span>
  <span class="legend-item"><span class="legend-dot" style="background:#1e40af"></span> Admin</span>
  <span class="legend-item"><span class="legend-dot" style="background:#7c3aed"></span> Auth</span>
  <span class="legend-item"><span class="legend-dot" style="background:#059669"></span> Account</span>
  <span class="legend-item"><span class="legend-dot" style="background:#d97706"></span> Payments</span>
  <span class="legend-item"><span class="legend-dot" style="background:#4b5563"></span> Public</span>
  <span class="legend-item">📄 GET &nbsp; ➕ POST &nbsp; 📝 PUT &nbsp; 🗑️ DELETE</span>
  <span class="legend-item">🛡️ middleware &nbsp; 🎨 view template &nbsp; ↪️ redirect</span>
</div>

<div class="controls">
  <button onclick="location.reload()">🔄 Regenerate</button>
</div>

<div id="diagram">
  <pre class="mermaid" style="background:transparent;text-align:center;">
${mermaidDef}
  </pre>
</div>

<div class="footer">
  Generated ${new Date().toISOString().slice(0, 10)} at ${new Date().toISOString().slice(11, 16)} ·
  Run <code>npm run generate-sitemap</code> to refresh
</div>

<script>
  mermaid.initialize({
    startOnLoad: true,
    theme: 'dark',
    themeVariables: {
      fontFamily: 'system-ui',
      fontSize: '13px',
      primaryColor: '#334155',
      primaryTextColor: '#e2e8f0',
      primaryBorderColor: '#475569',
      lineColor: '#64748b',
      secondaryColor: '#1e293b',
      tertiaryColor: '#0f172a',
      clusterBkg: '#1e293b',
      clusterBorder: '#334155',
    },
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis',
      padding: 12,
    }
  });
</script>

</body>
</html>`;
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  const mounts = parseMounts();
  
  console.log(`📦 Found ${mounts.length} route mounts:`);
  for (const m of mounts) {
    const endpoints = parseRouter(path.join(SRC, 'routes', m.routerFile + '.ts'));
    console.log(`   ${m.mount.padEnd(20)} → ${m.routerFile}.ts (${endpoints.length} endpoints)`);
  }

  const mermaid = generateMermaid(mounts);
  
  const outDir = path.join(ROOT, 'docs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'sitemap.html');
  fs.writeFileSync(outPath, generateHtml(mermaid), 'utf-8');
  
  console.log(`\n✅ Generated: ${outPath}`);
  console.log(`   Open in browser to view interactive diagram`);
}

main();
