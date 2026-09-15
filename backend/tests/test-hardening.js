// End-to-end checks for the hardening pass: security headers, request size limit, password
// rules, validation responses that no longer echo what was submitted, and rate limiting on
// the endpoints reachable without a token (in-memory MongoDB, never the real database)
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const BACKEND = process.env.BACKEND_DIR || path.join(__dirname, '..');
const PROJECT = path.join(BACKEND, '..');
const HERE = __dirname;
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 5089;
const BASE = `http://127.0.0.1:${PORT}/api`;

const out = (...args) => process.stdout.write(args.join(' ') + '\n');
let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  out(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' - ' + JSON.stringify(detail).slice(0, 300)}`);
  ok ? pass++ : fail++;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const request = async (method, route, { body, token, headers = {}, raw } = {}) => {
  const res = await fetch(BASE + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...headers },
    ...(body !== undefined && { body: typeof body === 'string' ? body : JSON.stringify(body) })
  });
  if (raw) return { status: res.status, headers: res.headers };
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json, headers: res.headers };
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('bedmanager_hardeningtest');
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error(`Refusing to use ${uri}`);

  const runScript = (script) => new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(BACKEND, script)], { cwd: HERE, env: { ...process.env, MONGO_URI: uri }, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => (error ? reject(new Error(`${script} failed: ${error.message}\n${stdout}\n${stderr}`)) : resolve(stdout)));
  });
  await runScript('seedBeds.js');
  await runScript('generateSyntheticData.js');

  Object.assign(process.env, { MONGO_URI: uri, JWT_SECRET: 'x'.repeat(64), PORT: String(PORT), NODE_ENV: 'test', ML_SERVICE_URL: 'http://127.0.0.1:1' });

  const serverLogs = [];
  console.log = (...args) => serverLogs.push(args.map(String).join(' '));
  console.warn = () => {};
  console.error = (...args) => serverLogs.push(args.map(String).join(' '));

  require(path.join(BACKEND, 'server.js'));
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) break; } catch {}
    await sleep(200);
  }

  // Tokens are taken first: the rate-limit checks at the end deliberately trip the limiter
  const tokenOf = async (email, password) => (await request('POST', '/auth/login', { body: { email, password } })).json?.data?.token;
  const admin = await tokenOf('sarah.chen@hospital.com', 'admin123');
  check('seeded admin logs in', Boolean(admin));

  // ---- Security headers ----
  out('\n--- Security headers ---');
  let r = await request('GET', '/health', { raw: true });
  check('nosniff is set', r.headers.get('x-content-type-options') === 'nosniff', r.headers.get('x-content-type-options'));
  check('framing is refused', Boolean(r.headers.get('x-frame-options') || r.headers.get('content-security-policy')),
    r.headers.get('x-frame-options'));
  check('the Express fingerprint is gone', !r.headers.get('x-powered-by'), r.headers.get('x-powered-by'));
  check('HSTS is set', Boolean(r.headers.get('strict-transport-security')), r.headers.get('strict-transport-security'));
  check('uploads stay readable across origins (profile pictures)',
    r.headers.get('cross-origin-resource-policy') === 'cross-origin', r.headers.get('cross-origin-resource-policy'));

  const cors = await fetch(`${BASE}/health`, { headers: { Origin: 'http://localhost:5173' } });
  check('the frontend origin is still allowed', cors.headers.get('access-control-allow-origin') === 'http://localhost:5173',
    cors.headers.get('access-control-allow-origin'));

  // ---- Request size ----
  out('\n--- Request size ---');
  const bigBody = JSON.stringify({ email: 'a@b.com', password: 'x'.repeat(200 * 1024) });
  r = await request('POST', '/auth/login', { body: bigBody });
  check('a body over the limit is refused (413)', r.status === 413, r.status);
  const hugeBed = JSON.stringify({ status: 'occupied', patientName: 'x'.repeat(200 * 1024) });
  r = await request('PATCH', '/beds/000000000000000000000000/status', { token: admin, body: hugeBed });
  check('...on authenticated routes too', r.status === 413, r.status);

  // ---- Password rules ----
  out('\n--- Password rules ---');
  const signup = (password, email) => request('POST', '/auth/register', {
    body: { name: 'Test Nurse', email, password, role: 'ward_staff', ward: 'ICU' }
  });

  r = await signup('short12', 'short.pw@hospital.com');
  check('a 7 character password is refused (400)', r.status === 400, r.status);
  check('...and the message names the new minimum', JSON.stringify(r.json).includes('8'), r.json?.errors || r.json?.message);
  check('...and the submitted password is not echoed back', !JSON.stringify(r.json).includes('short12'), r.json);
  check('...and no validation error carries a value field',
    (r.json?.errors || []).every((error) => !('value' in error)), r.json?.errors);
  const loggedPassword = serverLogs.filter((line) => line.includes('short12'));
  check('...and it is not written to the log', loggedPassword.length === 0, loggedPassword.slice(0, 2));

  r = await signup('exactly8', 'exactly8@hospital.com');
  check('an 8 character password is accepted (201)', r.status === 201, [r.status, r.json?.message]);

  // Every seeded account still meets the rule, so nobody is locked out
  const { MIN_PASSWORD_LENGTH } = require(path.join(BACKEND, 'config/passwordPolicy'));
  check('the shared policy is 8', MIN_PASSWORD_LENGTH === 8, MIN_PASSWORD_LENGTH);
  const seedPasswords = ['admin123', 'manager123', 'staff123', 'erstaff123'];
  check('every seeded password still meets it', seedPasswords.every((password) => password.length >= MIN_PASSWORD_LENGTH),
    seedPasswords.filter((password) => password.length < MIN_PASSWORD_LENGTH));

  // ---- ML service binding ----
  out('\n--- ML service ---');
  const mlConfig = fs.readFileSync(path.join(PROJECT, 'ml-service/config.py'), 'utf8');
  check('the ML service defaults to loopback, not every interface',
    /ML_SERVICE_HOST",\s*"127\.0\.0\.1"/.test(mlConfig) && !/"0\.0\.0\.0"/.test(mlConfig));

  // ---- Rate limiting (last: this trips the limiter for the window) ----
  out('\n--- Rate limiting ---');
  let limited = null;
  let failuresBefore429 = 0;
  for (let attempt = 1; attempt <= 15; attempt++) {
    const attemptResult = await request('POST', '/auth/login', { body: { email: 'sarah.chen@hospital.com', password: 'wrong-password' } });
    if (attemptResult.status === 429) { limited = attempt; break; }
    if (attemptResult.status === 401) failuresBefore429++;
  }
  check('repeated failed sign-ins are eventually refused (429)', limited !== null, { limited, failuresBefore429 });
  check('...after about ten attempts, not immediately', failuresBefore429 >= 5 && failuresBefore429 <= 12, failuresBefore429);

  r = await request('POST', '/auth/login', { body: { email: 'sarah.chen@hospital.com', password: 'admin123' } });
  check('once tripped, the window blocks further attempts from that address', r.status === 429, r.status);
  check('the refusal explains itself', /too many/i.test(r.json?.message || ''), r.json?.message);

  r = await request('GET', '/health', { raw: true });
  check('other endpoints keep working while login is limited', r.status === 200, r.status);

  out(`\n${pass} passed, ${fail} failed`);
  await mongod.stop();
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  process.stdout.write(String(error.stack || error) + '\n');
  process.exit(1);
});
