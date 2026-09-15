// Cross-checks the codebase after the security fixes:
//   1. every backend file still parses, and every module still loads
//   2. every route's guards, read with a balanced-parenthesis scanner so multi-line
//      definitions and guards containing commas are handled correctly
//   3. every frontend API call matches a real backend route
//   4. package.json scripts point at files that exist
// Reads only - nothing is started, no database is touched.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.env.PROJECT_DIR || path.join(__dirname, '../..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend', 'src');

const out = (...args) => process.stdout.write(args.join(' ') + '\n');
let problems = 0;
const problem = (message) => { problems++; out(`  ❌ ${message}`); };
const note = (message) => out(`  •  ${message}`);

const walk = (dir, extensions) => {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'venv', 'reports', 'dist', 'build'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full, extensions));
    else if (extensions.some((ext) => entry.name.endsWith(ext))) found.push(full);
  }
  return found;
};

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

// Read the arguments of a call starting at the '(' that follows `index`
const readCallArgs = (source, index) => {
  let depth = 0;
  let start = -1;
  for (let i = index; i < source.length; i++) {
    const char = source[i];
    if (char === '(') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (char === ')') {
      depth--;
      if (depth === 0) return { args: source.slice(start, i), end: i };
    }
  }
  return null;
};

const splitTopLevel = (text) => {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(' || char === '[' || char === '{') depth++;
    if (char === ')' || char === ']' || char === '}') depth--;
    if (char === ',' && depth === 0) { parts.push(current.trim()); current = ''; continue; }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

// ---------------------------------------------------------------- 1. parse + load
out('--- 1. Every backend file parses ---');
const backendFiles = walk(BACKEND, ['.js']);
for (const file of backendFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    problem(`${path.relative(ROOT, file)} does not parse: ${String(error.stderr).split('\n')[0]}`);
  }
}
out(`  ✅ ${backendFiles.length} files parse`);

out('\n--- 2. Every module loads ---');
const LOADABLE = ['routes', 'controllers', 'services', 'models', 'middleware', 'config'];
const loadable = backendFiles.filter((file) => LOADABLE.includes(path.basename(path.dirname(file))));
for (const file of loadable) {
  try {
    require(file);
  } catch (error) {
    problem(`${path.relative(ROOT, file)} fails to load: ${error.message.split('\n')[0]}`);
  }
}
out(`  ✅ ${loadable.length} modules load (entry-point scripts skipped: they would hit the database)`);

// ---------------------------------------------------------------- 3. routes
out('\n--- 3. Backend routes and their guards ---');

const serverSource = stripComments(fs.readFileSync(path.join(BACKEND, 'server.js'), 'utf8'));
const prefixes = new Map();
const importedAs = new Map();
for (const match of serverSource.matchAll(/const\s+(\w+)\s*=\s*require\(['"]\.\/routes\/(\w+)['"]\)/g)) {
  importedAs.set(match[1], match[2]);
}
for (const match of serverSource.matchAll(/app\.use\(\s*['"](\/api\/[^'"]*)['"]\s*,\s*(?:require\(['"]\.\/routes\/(\w+)['"]\)|(\w+))/g)) {
  const file = match[2] || importedAs.get(match[3]);
  if (file) prefixes.set(file, match[1]);
}

// Public by design - these must NOT require a login
const PUBLIC = new Set(['POST /api/auth/login', 'POST /api/auth/register', 'GET /api/health']);

const routes = [];
for (const [file, prefix] of prefixes) {
  const full = path.join(BACKEND, 'routes', `${file}.js`);
  if (!fs.existsSync(full)) { problem(`server.js mounts ${prefix} -> routes/${file}.js which is missing`); continue; }
  const source = stripComments(fs.readFileSync(full, 'utf8'));

  const routerWide = [];
  for (const match of source.matchAll(/router\.use\(/g)) {
    const call = readCallArgs(source, match.index + 'router.use'.length);
    if (call) routerWide.push(...splitTopLevel(call.args));
  }

  const named = new Map();
  for (const match of source.matchAll(/(?:const|let)\s+(\w+)\s*=\s*/g)) {
    const rest = source.slice(match.index + match[0].length);
    if (/^authorize\(/.test(rest)) {
      const call = readCallArgs(rest, 'authorize'.length);
      if (call) named.set(match[1], `authorize(${call.args.replace(/\s+/g, ' ')})`);
    }
  }

  for (const match of source.matchAll(/router\.(get|post|put|patch|delete)\s*\(/g)) {
    const call = readCallArgs(source, match.index + `router.${match[1]}`.length);
    if (!call) continue;
    const parts = splitTopLevel(call.args);
    const routePath = (parts[0] || '').replace(/['"`]/g, '');
    const guards = [...routerWide, ...parts.slice(1, -1)].map((guard) => named.get(guard) || guard.replace(/\s+/g, ' '));
    const urlPath = (prefix + routePath).replace(/\/$/, '') || prefix;
    routes.push({ method: match[1].toUpperCase(), urlPath, guards, file: `routes/${file}.js` });
  }
}

const normalise = (urlPath) => urlPath.replace(/\/$/, '');
const segments = (urlPath) => normalise(urlPath).split('/').filter(Boolean);

for (const route of routes.sort((a, b) => a.urlPath.localeCompare(b.urlPath) || a.method.localeCompare(b.method))) {
  const key = `${route.method} ${route.urlPath}`;
  const hasLogin = route.guards.some((guard) => guard.includes('protect'));
  const roleGuards = route.guards.filter((guard) => guard !== 'protect');
  const label = roleGuards.length ? roleGuards.join(' + ') : (hasLogin ? 'any logged-in role' : 'PUBLIC');

  out(`  ${route.method.padEnd(6)} ${route.urlPath.padEnd(44)} ${label}`);

  if (!hasLogin && !PUBLIC.has(key)) problem(`${key} has no protect middleware`);
  if (hasLogin && PUBLIC.has(key)) problem(`${key} is meant to be public but requires a login`);
}
out(`  (${routes.length} routes)`);

// ---------------------------------------------------------------- 4. frontend calls
out('\n--- 4. Frontend API calls resolve to a real route ---');
const frontendFiles = walk(FRONTEND, ['.js', '.jsx']);
const calls = [];
for (const file of frontendFiles) {
  const source = stripComments(fs.readFileSync(file, 'utf8'));
  for (const match of source.matchAll(/\bapi\.(get|post|put|patch|delete)\(\s*[`'"]([^`'"]+)[`'"]/g)) {
    calls.push({
      method: match[1].toUpperCase(),
      route: '/api' + match[2].replace(/\$\{[^}]*\}/g, ':dynamic').split('?')[0],
      file: path.relative(ROOT, file).replace(/\\/g, '/')
    });
  }
}

// A call matches a route when the methods agree and each segment agrees, treating a
// backend :param or a frontend ${...} as matching anything
const matches = (call, route) => {
  if (call.method !== route.method) return false;
  const callSegments = segments(call.route);
  const routeSegments = segments(route.urlPath);
  if (callSegments.length !== routeSegments.length) return false;
  return routeSegments.every((segment, i) =>
    segment.startsWith(':') || callSegments[i] === ':dynamic' || segment === callSegments[i]);
};

const unmatched = [];
const seen = new Set();
for (const call of calls) {
  const key = `${call.method} ${call.route} ${call.file}`;
  if (seen.has(key)) continue;
  seen.add(key);
  if (!routes.some((route) => matches(call, route))) unmatched.push(call);
}
for (const call of unmatched) problem(`${call.method} ${call.route} (${call.file}) has no matching backend route`);
out(`  ${unmatched.length === 0 ? '✅ ' : ''}checked ${seen.size} distinct call sites across ${frontendFiles.length} files`);

// Routes nothing in the frontend calls - not wrong, but worth knowing
const uncalled = routes.filter((route) => !calls.some((call) => matches(call, route)));
if (uncalled.length) {
  out('\n  Routes the frontend never calls:');
  for (const route of uncalled) note(`${route.method} ${route.urlPath}  (${route.file})`);
}

// ---------------------------------------------------------------- 5. npm scripts
out('\n--- 5. package.json scripts point at files that exist ---');
let scriptCount = 0;
for (const location of [BACKEND, path.join(ROOT, 'frontend'), ROOT]) {
  const pkgPath = path.join(location, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  for (const [name, script] of Object.entries(pkg.scripts || {})) {
    for (const match of script.matchAll(/node\s+([\w./-]+\.js)/g)) {
      scriptCount++;
      if (!fs.existsSync(path.join(location, match[1]))) {
        problem(`${path.relative(ROOT, pkgPath)} script "${name}" runs ${match[1]} which does not exist`);
      }
    }
  }
}
out(`  ✅ ${scriptCount} script targets exist`);

out(`\n${problems === 0 ? '✅ No inconsistencies found' : `❌ ${problems} problem(s) found`}`);
process.exit(problems ? 1 : 0);
