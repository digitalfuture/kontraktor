#!/usr/bin/env node
/**
 * Auto-generate interactive site structure treemap from Express routes.
 * Run: node scripts/generate-sitemap.mjs
 * Output: docs/sitemap.html  (self-contained D3 compact tree)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// ── Parser ──────────────────────────────────────────────────────────────────

function readLines(file) {
  const text = fs.readFileSync(file, 'utf-8');
  return text.split('\n');
}

function parseMounts() {
  const lines = readLines(path.join(SRC, 'index.ts'));
  const mounts = [];
  const re = /app\.use\(['"]([^'"]+)['"],?\s*(.*?)\);/g;
  let m;
  while ((m = re.exec(lines.join('\n'))) !== null) {
    const mount = m[1];
    const args = m[2];
    const routerMatch = args.match(/([\w]+(?:Router|Pages|Api))/);
    if (!routerMatch) continue;
    const varName = routerMatch[1];
    const middleware = args
      .replace(varName, '')
      .replace(/,\s*$/, '')
      .split(',')
      .map(s => s.trim())
      .filter(s => s && s !== varName && !s.startsWith('//'));

    let routerFile = null;
    let routerType = 'router';
    for (const line of lines) {
      if (!line.includes(varName) || !line.includes('import')) continue;
      const aliasMatch = line.match(/\{([^}]+)\}/);
      if (aliasMatch) {
        const namedImports = aliasMatch[1].split(',').map(s => s.trim());
        for (const imp of namedImports) {
          const parts = imp.split(/\s+as\s+/i);
          const localName = parts[1] || parts[0];
          const sourceName = parts[0];
          if (localName.trim() === varName) {
            routerType = sourceName.trim();
            break;
          }
        }
      }
      const fileMatch = line.match(/['"]\.\/routes\/([^'"]+)['"]/);
      if (fileMatch) {
        routerFile = fileMatch[1];
        break;
      }
    }
    // Resolve router file path — prefer routes/<name>/index.ts (directory barrel)
    // over routes/<name>.ts (legacy re-export or flat file)
    let routerFilePath = null;
    if (routerFile) {
      const candidate1 = path.join(SRC, 'routes', routerFile + '.ts');
      const candidate2 = path.join(SRC, 'routes', routerFile, 'index.ts');
      if (fs.existsSync(candidate2) && fs.statSync(candidate2).size > 100) {
        // Directory barrel with substantial content → prefer it
        routerFilePath = candidate2;
      } else if (fs.existsSync(candidate1)) {
        routerFilePath = candidate1;
      } else if (fs.existsSync(candidate2)) {
        routerFilePath = candidate2;
      }
    }
    mounts.push({ mount, middleware, routerFile, routerFilePath, varName, routerType });
  }
  return mounts;
}

function parseRouter(filePath, routerType) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf-8');
  const endpoints = [];

  // Match both `router.get(` and `pageRouter.post(` patterns
  const routeRe = /(\w+Router|\brouter\b)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]\s*,/g;
  let rm;
  while ((rm = routeRe.exec(text)) !== null) {
    const foundType = rm[1] === 'router' ? 'router' : rm[1];
    const method = rm[2].toUpperCase();
    const route = rm[3];
    endpoints.push({ routerType: foundType, method, path: route });
  }

  // Follow `register*Routes(router, apiRouter)` pattern (admin barrel)
  // Exclude function definitions (e.g., `function registerContentRoutes(...)` in content.ts)
  const registerRe = /register(\w+)Routes\s*\(\s*([^)]+)\s*\)/g;
  let regMatch;
  while ((regMatch = registerRe.exec(text)) !== null) {
    // Skip if this is a function definition, not a call
    const lineStart = text.lastIndexOf('\n', regMatch.index) + 1;
    const linePrefix = text.slice(lineStart, regMatch.index).trim();
    if (linePrefix.startsWith('function') || linePrefix.startsWith('export function')) continue;
    const moduleName = regMatch[1].toLowerCase();
    const args = regMatch[2].split(',').map(s => s.trim());
    const dir = path.dirname(filePath);
    // Try singular first, then plural (registerPaymentRoutes -> payment.ts / payments.ts)
    let modulePath = path.join(dir, moduleName + '.ts');
    if (!fs.existsSync(modulePath)) modulePath = path.join(dir, moduleName + 's.ts');
    if (fs.existsSync(modulePath)) {
      const subEndpoints = parseRouter(modulePath, routerType);
      endpoints.push(...subEndpoints);
    }
  }

  return endpoints;
}

// ── Category ────────────────────────────────────────────────────────────────

function categoryFor(mount) {
  if (mount.startsWith('/admin')) return 'admin';
  if (mount.startsWith('/api')) return 'api';
  if (mount.startsWith('/auth')) return 'auth';
  if (mount.startsWith('/account')) return 'account';
  if (mount.startsWith('/payments')) return 'payments';
  return 'public';
}

// ── Hierarchy builder ───────────────────────────────────────────────────────

function buildHierarchy(mounts) {
  const root = {
    name: '🏠 Kontraktor',
    category: 'root',
    children: [],
  };

  for (const mount of mounts) {
    // Skip API-only mounts — diagram shows only pages
    if (mount.mount.startsWith('/api')) continue;

    const routerFilePath = mount.routerFilePath;
    const allEndpoints = parseRouter(routerFilePath, mount.routerType);
    const endpoints = allEndpoints.filter(ep => {
      // For admin: the sub-files register routes on pageRouter, not apiRouter
      // We filter based on whether the route is on a "page" router vs "api" router
      const isApi = ep.routerType === 'apiRouter' || ep.routerType.includes('Api');
      return !isApi && (ep.routerType === mount.routerType || ep.routerType === 'router' || mount.routerType === 'router');
    });

    // Skip mounts with no page endpoints
    if (endpoints.length === 0) continue;

    const mwTag = mount.middleware.length
      ? mount.middleware.map(m => m.replace('require', '🛡️')).join(' ')
      : '';

    // Clean group name from mount path
    const groupName = mount.mount.replace(/^\//, '').replace(/\/$/, '');
    const displayName = groupName.charAt(0).toUpperCase() + groupName.slice(1);

    const mountChildren = Array.from(
      new Map(endpoints.map(ep => {
        const epPath = ep.path === '/' ? '' : ep.path;
        const fullPath = mount.mount + epPath;
        return [fullPath, { name: fullPath, value: 1, category: categoryFor(mount.mount), leaf: true }];
      })).values()
    );

    const mountNode = {
      name: displayName,
      category: categoryFor(mount.mount),
      middleware: mwTag,
      children: mountChildren.length > 0 ? mountChildren : undefined,
      value: mountChildren.length || 1,
    };
    root.children.push(mountNode);
  }

  // Add static pages manually (they're inline handlers, not app.use)
  root.children.push({
    name: 'Home',
    category: 'public',
    children: [
      { name: '/', value: 1, category: 'public', leaf: true },
    ],
    value: 1,
  });
  root.children.push({
    name: 'Legal & Settings',
    category: 'public',
    children: [
      { name: '/terms', value: 1, category: 'public', leaf: true },
      { name: '/privacy', value: 1, category: 'public', leaf: true },
      { name: '/_ga-opt-out', value: 1, category: 'public', leaf: true },
      { name: '/_ga-opt-in', value: 1, category: 'public', leaf: true },
    ],
    value: 4,
  });

  // Sort children alphabetically
  root.children.sort((a, b) => a.name.localeCompare(b.name));

  return root;
}

// ── HTML Generator (D3 tree, 2-level drill-down) ────────────────────────

function generateHtml(rootData) {
  const jsonStr = JSON.stringify(rootData);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kontraktor — Pages</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { min-height: 100%; background: #f8fafc; color: #111827; font-family: system-ui, -apple-system, sans-serif; }
  body { padding-top: 52px; }
  #header {
    position: fixed; top: 0; left: 0; right: 0; z-index: 10;
    padding: 0.75rem 1.25rem; background: #ffffff; border-bottom: 1px solid #e5e7eb;
    display: flex; align-items: center; gap: 0.75rem; height: 52px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  #header h1 { font-size: 1rem; font-weight: 700; white-space: nowrap; color: #ea580c; letter-spacing: -0.01em; }
  #breadcrumb { display: flex; align-items: center; gap: 0.2rem; font-size: 0.8125rem; color: #6b7280; flex-wrap: wrap; }
  #breadcrumb .crumb { cursor: pointer; padding: 0.15rem 0.4rem; border-radius: 4px; transition: all 0.15s; }
  #breadcrumb .crumb:hover { background: #fff7ed; color: #ea580c; }
  #breadcrumb .sep { color: #d1d5db; cursor: default; }
  #breadcrumb .here { color: #ea580c; font-weight: 600; }
  #viz { min-height: 350px; display: flex; align-items: center; justify-content: center; }
  #viz svg { display: block; width: 100%; max-width: 1200px; height: auto; }
  .link { fill: none; stroke: #d1d5db; stroke-width: 1.5; stroke-opacity: 0.5; }
  .node-group circle { transition: r 0.15s, stroke-width 0.15s; }
  .node-group:hover circle { stroke-width: 3; }
  .node-group.nodrill:hover circle { stroke-width: 1.5; }
  .node-count { pointer-events: none; }
  .hint {
    position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%); z-index: 10;
    background: #ffffff; color: #6b7280; font-size: 0.75rem;
    padding: 0.5rem 1rem; border-radius: 8px; pointer-events: none;
    border: 1px solid #e5e7eb; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  @media (prefers-color-scheme: dark) {
    body { background: #0f172a; color: #e2e8f0; }
    #header { background: #1e293b; border-bottom-color: #334155; }
    #header h1 { color: #fb923c; }
    #breadcrumb { color: #94a3b8; }
    #breadcrumb .crumb:hover { background: rgba(251,146,60,0.08); color: #fb923c; }
    #breadcrumb .sep { color: #475569; }
    #breadcrumb .here { color: #fb923c; }
    .link { stroke: #475569; stroke-opacity: 0.6; }
    .node-label { fill: #e2e8f0; }
    .node-count { fill: #64748b; }
    .hint { background: #1e293b; color: #94a3b8; border-color: #334155; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
  }
</style>
</head>
<body>

<div id="header">
  <h1>🧭 Kontraktor</h1>
  <div id="breadcrumb"></div>
</div>
<div id="viz">
  <svg viewBox="0 0 1000 400"></svg>
  <div class="hint">клик на 📁 → провалиться • клик на фон → назад</div>
</div>

<script src="https://d3js.org/d3.v7.min.js"></script>
<script>
const data = ${jsonStr};

const color = d3.scaleOrdinal()
  .domain(['root','admin','auth','account','payments','public'])
  .range(['#ea580c','#2563eb','#7c3aed','#059669','#d97706','#6b7280']);

const svg = d3.select('svg');
const g = svg.append('g');

const nodeSepY = 22;
const nodeSepX = 140;

let zoomStack = [];
let isLoading = false;

function isEmpty(node) { return !node.children || node.children.length === 0; }

function breadcrumb() {
  const bc = d3.select('#breadcrumb');
  bc.html('');
  zoomStack.forEach((d, i) => {
    if (i > 0) bc.append('span').attr('class','sep').text(' › ');
    const label = d.data.name.length > 28 ? d.data.name.slice(0,25)+'…' : d.data.name;
    const span = bc.append('span').attr('class','crumb').text(label);
    span.attr('class', i === zoomStack.length - 1 ? 'crumb here' : 'crumb');
    if (i < zoomStack.length - 1) span.on('click', () => { zoomToCrumb(i); });
  });
}

function zoomToCrumb(idx) {
  if (isLoading) return;
  zoomStack.splice(idx + 1);
  draw(zoomStack[idx]);
}

function draw(node) {
  isLoading = true;
  g.selectAll('*').remove();

  const root = d3.hierarchy(node.data);
  if (!root.children) { isLoading = false; return; }

  const treeLayout = d3.tree()
    .nodeSize([nodeSepY, nodeSepX])
    .separation(() => 1);
  treeLayout(root);

  // Only 2 levels
  const visibleNodes = root.descendants().filter(d => d.depth <= 1);
  const visibleLinks = root.links().filter(l => l.target.depth <= 1);

  // Compute bounds with room for labels
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  visibleNodes.forEach(d => {
    // Left side for parent label (depth 0)
    const leftW = d.depth === 0 ? d.data.name.length * 10 + 20 : 0;
    // Right side for child label (depth 1)
    const rightW = d.depth > 0 ? d.data.name.length * 8 + 30 : 0;
    if (d.y - leftW - 16 < x0) x0 = d.y - leftW - 16;
    if (d.y + rightW + 16 > x1) x1 = d.y + rightW + 16;
    if (d.x < y0) y0 = d.x;
    if (d.x > y1) y1 = d.x;
  });

  const padY = 30;
  const vw = Math.max(x1 - x0, 500);
  const vh = Math.max(y1 - y0 + padY * 2, 250);
  svg.attr('viewBox', [x0, y0 - padY, vw, vh]);

  // ── LINKS ──
  const linkGen = d3.linkHorizontal().x(d => d[0]).y(d => d[1]);
  g.selectAll('path')
    .data(visibleLinks)
    .join('path')
    .attr('class', 'link')
    .attr('d', d => linkGen({ source: [d.source.y, d.source.x], target: [d.target.y, d.target.x] }));

  // ── NODES ──
  const nodeG = g.selectAll('g.node-group')
    .data(visibleNodes)
    .join('g')
    .attr('class', d => 'node-group' + (isEmpty(d.data) ? ' nodrill' : ''));

  // Circle
  nodeG.append('circle')
    .attr('cx', d => d.y)
    .attr('cy', d => d.x)
    .attr('r', d => d.data.leaf ? 4 : 6)
    .attr('fill', d => color(d.data.category || 'public'))
    .attr('stroke', d => d3.color(color(d.data.category || 'public')).darker(0.4))
    .attr('stroke-width', 1.5);

  // Label — parent on LEFT, children on RIGHT
  nodeG.append('text')
    .attr('class', 'node-label')
    .attr('text-anchor', d => d.depth === 0 ? 'end' : 'start')
    .attr('x', d => d.depth === 0 ? d.y - 14 : d.y + 14)
    .attr('y', d => d.x + 5)
    .attr('font-size', d => d.depth === 0 ? '17px' : (d.data.leaf ? '12px' : '14px'))
    .attr('font-weight', d => d.depth === 0 ? '700' : '500')
    .attr('fill', d => {
      if (d.depth === 0) return '#ea580c';
      if (d.data.leaf) return '#9ca3af';
      try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? '#e2e8f0' : '#1f2937'; }
      catch(e) { return '#1f2937'; }
    })
    .text(d => {
      if (d.depth === 0) return d.data.name;
      let icon = d.data.leaf ? '📄' : '📁';
      return icon + ' ' + d.data.name;
    });

  // Child count badge
  nodeG.filter(d => !isEmpty(d.data) && d.depth > 0).append('text')
    .attr('class', 'node-count')
    .attr('text-anchor', 'start')
    .attr('x', d => d.y + 14)
    .attr('y', d => d.x + 19)
    .attr('font-size', '10px')
    .attr('fill', '#9ca3af')
    .text(d => {
      const count = d.data.children ? d.data.children.length : 0;
      return count > 0 ? count + ' page' + (count > 1 ? 's' : '') : '';
    });

  // Click handler
  nodeG.filter(d => !isEmpty(d.data))
    .style('cursor', 'pointer')
    .on('click', function(event, d) {
      if (isLoading) return;
      event.stopPropagation();
      zoomTo(d);
    });

  nodeG.filter(d => isEmpty(d.data))
    .style('cursor', 'default');

  breadcrumb();
  isLoading = false;
}

function zoomTo(node) {
  zoomStack.push(node);
  draw(node);
}

// Click on SVG background → zoom out
svg.on('click', (event) => {
  if (event.target === svg.node() && zoomStack.length > 1) {
    zoomStack.pop();
    draw(zoomStack[zoomStack.length - 1]);
  }
});

// ── Init ──
zoomStack = [d3.hierarchy(data)];
draw(zoomStack[0]);
</script>

<!-- JSON data for admin page sitemap loader -->
<script id="sitemap-data" type="application/json">${jsonStr}</script>
</body>
</html>`;
}

// Count total leaves (pages) in the tree
function countLeaves(node) {
  if (!node.children || node.children.length === 0) return node.value || 1;
  return node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  const mounts = parseMounts();

  console.log(`📦 Found ${mounts.length} route mounts:`);
  for (const m of mounts) {
    const endpoints = m.routerFilePath && fs.existsSync(m.routerFilePath)
      ? parseRouter(m.routerFilePath, m.routerType).filter(ep => !ep.routerType.includes('Api'))
      : [];
    console.log(`   ${m.mount.padEnd(22)} → ${m.routerFile}.ts (${m.routerType}) (${endpoints.length} page endpoints)`);
  }

  const hierarchy = buildHierarchy(mounts);
  const json = JSON.stringify(hierarchy, null, 2);
  const html = generateHtml(hierarchy);

  const outDir = path.join(ROOT, 'docs');
  fs.mkdirSync(outDir, { recursive: true });

  // Write JSON data file → used by _sitemap.ejs partial
  const jsonPath = path.join(outDir, 'sitemap-map.json');
  fs.writeFileSync(jsonPath, json, 'utf-8');

  // Write HTML (standalone browser view, also serves as data container)
  const outPath = path.join(outDir, 'sitemap.html');
  const htmlWithData = html.replace('</head>', `<script>window.__SITEMAP_DATA__ = ${json}</script>\n</head>`);
  fs.writeFileSync(outPath, htmlWithData, 'utf-8');

  console.log(`\n✅ Generated: ${outPath}`);
  console.log(`   Data: ${jsonPath}`);
  console.log(`   ${hierarchy.children.length} sections, ${countLeaves(hierarchy)} pages total`);
}

main();
