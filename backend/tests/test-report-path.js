// End-to-end checks for report download/delete path-traversal protection (in-memory MongoDB)
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const BACKEND = process.env.BACKEND_DIR || path.join(__dirname, '..');
const HERE = __dirname;
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 5093;
const BASE = `http://127.0.0.1:${PORT}/api`;
const out = (...a) => process.stdout.write(a.join(' ') + '\n');
let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  out(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' - ' + JSON.stringify(detail).slice(0, 400)}`);
  ok ? pass++ : fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const req = async (method, route, { token, raw = false } = {}) => {
  const res = await fetch(BASE + route, { method, headers: { ...(token && { Authorization: `Bearer ${token}` }) } });
  if (raw) return { status: res.status, buffer: Buffer.from(await res.arrayBuffer()) };
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('bedmanager_reportpath');
  const runScript = (s) => new Promise((res, rej) => execFile(process.execPath, [path.join(BACKEND, s)], { cwd: HERE, env: { ...process.env, MONGO_URI: uri }, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }, (e, so, se) => (e ? rej(new Error(`${s}: ${e.message}\n${so}\n${se}`)) : res(so))));
  await runScript('seedBeds.js');
  await runScript('generateSyntheticData.js');

  Object.assign(process.env, { MONGO_URI: uri, JWT_SECRET: 'x'.repeat(64), PORT: String(PORT), NODE_ENV: 'test', ML_SERVICE_URL: 'http://127.0.0.1:1' });
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  require(path.join(BACKEND, 'server.js'));
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${BASE}/health`)).ok) break; } catch {} await sleep(200); }

  const login = async (e, p) => (await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: p }) })).json()).data.token;
  const admin = await login('sarah.chen@hospital.com', 'admin123');

  // Put a secret next to the reports dir to prove it cannot be read/deleted through the endpoint
  const backendDir = path.resolve(BACKEND);
  const secretPath = path.join(backendDir, 'traversal-secret.txt');
  fs.writeFileSync(secretPath, 'JWT_SECRET=super-secret');

  // Generate a real CSV report (the endpoint streams the file and writes it to the reports dir)
  let r = await fetch(`${BASE}/reports/generate/csv`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` }, body: JSON.stringify({ reportType: 'occupancy', dateRange: 'last7days' }) });
  const disposition = r.headers.get('content-disposition') || '';
  const fileName = (disposition.match(/filename="([^"]+)"/) || [])[1];
  check('generated a report with a report_<ts>.csv name', r.status === 200 && /^report_\d+\.csv$/.test(fileName || ''), fileName);

  r = await req('GET', `/reports/download/${fileName}`, { token: admin, raw: true });
  check('valid report downloads (200)', r.status === 200 && r.buffer.length > 0, r.status);

  // Traversal payloads that resolve to the secret file (in the reports dir and above it) or to other files
  const payloads = [
    '..%2Ftraversal-secret.txt',
    '..%2f..%2ftraversal-secret.txt',
    '..%5Ctraversal-secret.txt',
    '..%2F..%2F.env',
    '..%2F..%2Fpackage.json',
    'report_1.txt',
    'not_a_report.csv'
  ];
  let leaked = false;
  for (const p of payloads) {
    r = await req('GET', `/reports/download/${p}`, { token: admin, raw: true });
    const body = r.buffer.toString();
    const ok = (r.status === 400 || r.status === 404) && !body.includes('super-secret') && !body.includes('JWT_SECRET');
    if (!ok) leaked = true;
    check(`download rejects "${p}" without leaking a file`, ok, { status: r.status, body: body.slice(0, 80) });
  }
  check('no traversal download returned a secret', !leaked);

  // Delete must not remove files outside the reports dir
  r = await req('DELETE', '/reports/..%2Ftraversal-secret.txt', { token: admin });
  check('delete rejects traversal (400/404)', r.status === 400 || r.status === 404, r.status);
  check('the secret file still exists after the delete attempt', fs.existsSync(secretPath));

  // A valid delete still works
  r = await req('DELETE', `/reports/${fileName}`, { token: admin });
  check('valid report can still be deleted (200)', r.status === 200, r.json);
  r = await req('GET', `/reports/download/${fileName}`, { token: admin });
  check('deleted report is gone (404)', r.status === 404, r.status);

  fs.unlinkSync(secretPath);
  out(`\n${pass} passed, ${fail} failed`);
  await mongod.stop();
  process.exit(fail ? 1 : 0);
})().catch((e) => { process.stdout.write(String(e.stack || e) + '\n'); process.exit(1); });
