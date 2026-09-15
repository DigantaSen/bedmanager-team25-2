// End-to-end checks that analytics and log endpoints need a login and the right role,
// and that the test broadcast endpoint is gone (in-memory MongoDB, never the real database)
const path = require('path');
const { execFile } = require('child_process');

const BACKEND = process.env.BACKEND_DIR || path.join(__dirname, '..');
const HERE = __dirname;
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 5092;
const BASE = `http://127.0.0.1:${PORT}/api`;

const out = (...args) => process.stdout.write(args.join(' ') + '\n');
let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  out(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' - ' + JSON.stringify(detail).slice(0, 400)}`);
  ok ? pass++ : fail++;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const api = async (method, route, { token } = {}) => {
  const res = await fetch(BASE + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('bedmanager_authtest');
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error(`Refusing to use ${uri}`);

  const runScript = (script) => new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(BACKEND, script)], { cwd: HERE, env: { ...process.env, MONGO_URI: uri }, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => (error ? reject(new Error(`${script} failed: ${error.message}\n${stdout}\n${stderr}`)) : resolve(stdout)));
  });
  await runScript('seedBeds.js');
  await runScript('generateSyntheticData.js');

  Object.assign(process.env, { MONGO_URI: uri, JWT_SECRET: 'x'.repeat(64), PORT: String(PORT), NODE_ENV: 'test', ML_SERVICE_URL: 'http://127.0.0.1:1' });
  const serverErrors = [];
  console.log = () => {};
  console.warn = () => {};
  console.error = (...args) => serverErrors.push(args.map(String).join(' ').slice(0, 300));

  require(path.join(BACKEND, 'server.js'));
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) break; } catch {}
    await sleep(200);
  }

  const User = require(path.join(BACKEND, 'models/User'));
  const login = async (email, password) => (await api('POST', '/auth/login', { body: { email, password } })).json?.data?.token;
  const post = async (route, body) => {
    const res = await fetch(BASE + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, json: await res.json() };
  };
  const tokenOf = async (email, password) => (await post('/auth/login', { email, password })).json?.data?.token;
  const admin = await tokenOf('sarah.chen@hospital.com', 'admin123');
  const manager = await tokenOf('anuradha@hospital.com', 'manager123');
  const wardStaff = await tokenOf('staff.icu1@hospital.com', 'staff123');
  const erStaff = await tokenOf('er.staff1@hospital.com', 'erstaff123');
  const tech = await tokenOf('admin@hospital.com', 'admin123');
  check('seeded roles log in', Boolean(admin && manager && wardStaff && erStaff && tech));

  const bed = await require(path.join(BACKEND, 'models/Bed')).findOne().lean();

  // ---- Analytics ----
  out('\n--- Analytics endpoints ---');
  const analyticsRoutes = [
    '/analytics/occupancy-summary',
    '/analytics/occupancy-by-ward',
    `/analytics/bed-history/${bed._id}`,
    '/analytics/occupancy-trends',
    '/analytics/forecasting',
    '/analytics/cleaning-performance',
    '/analytics/occupancy-history',
    '/analytics/occupancy-timeline?range=7days',
    '/analytics/ward-utilization',
    '/analytics/peak-demand-analysis'
  ];

  const noToken = [];
  const wardStaffBlocked = [];
  const erBlocked = [];
  const techBlocked = [];
  const adminAllowed = [];
  const managerAllowed = [];
  for (const route of analyticsRoutes) {
    const anonymous = await api('GET', route);
    if (anonymous.status !== 401) noToken.push([route, anonymous.status]);
    const staffTry = await api('GET', route, { token: wardStaff });
    if (staffTry.status !== 403) wardStaffBlocked.push([route, staffTry.status]);
    const erTry = await api('GET', route, { token: erStaff });
    if (erTry.status !== 403) erBlocked.push([route, erTry.status]);
    const techTry = await api('GET', route, { token: tech });
    if (techTry.status !== 403) techBlocked.push([route, techTry.status]);
    const adminTry = await api('GET', route, { token: admin });
    if (adminTry.status !== 200) adminAllowed.push([route, adminTry.status, adminTry.json?.message]);
    const managerTry = await api('GET', route, { token: manager });
    if (managerTry.status !== 200) managerAllowed.push([route, managerTry.status, managerTry.json?.message]);
  }
  check(`all ${analyticsRoutes.length} analytics endpoints need a login (401 without one)`, noToken.length === 0, noToken);
  check('ward staff cannot read analytics (403)', wardStaffBlocked.length === 0, wardStaffBlocked);
  check('ER staff cannot read analytics (403)', erBlocked.length === 0, erBlocked);
  check('technical team cannot read analytics (403)', techBlocked.length === 0, techBlocked);
  check('hospital admin still reads every analytics endpoint (200)', adminAllowed.length === 0, adminAllowed);
  check('manager still reads every analytics endpoint (200)', managerAllowed.length === 0, managerAllowed);

  // Forecasting leaked patient names to any logged-in user before this fix
  let r = await api('GET', '/analytics/forecasting', { token: erStaff });
  check('forecasting no longer exposes patient names to ER staff', r.status === 403 && !JSON.stringify(r.json || {}).includes('patientName'), r.status);

  // ---- Logs ----
  out('\n--- Log endpoints ---');
  const logRoutes = ['/logs', `/logs/bed/${bed._id}`];
  const logsAnonymous = [];
  const logsStaff = [];
  const logsAdmin = [];
  for (const route of logRoutes) {
    const anonymous = await api('GET', route);
    if (anonymous.status !== 401) logsAnonymous.push([route, anonymous.status]);
    const staffTry = await api('GET', route, { token: wardStaff });
    if (staffTry.status !== 403) logsStaff.push([route, staffTry.status]);
    const adminTry = await api('GET', route, { token: admin });
    if (adminTry.status !== 200) logsAdmin.push([route, adminTry.status, adminTry.json?.message]);
  }
  check('log endpoints need a login (401 without one)', logsAnonymous.length === 0, logsAnonymous);
  check('ward staff cannot read all logs (403)', logsStaff.length === 0, logsStaff);
  check('hospital admin can read logs (200)', logsAdmin.length === 0, logsAdmin);

  const staffUser = await User.findOne({ email: 'staff.icu1@hospital.com' });
  const otherUser = await User.findOne({ email: 'staff.icu2@hospital.com' });
  r = await api('GET', `/logs/user/${staffUser._id}`);
  check('user logs need a login (401)', r.status === 401, r.status);
  r = await api('GET', `/logs/user/${staffUser._id}`, { token: wardStaff });
  check('a user can read their own logs', r.status === 200, r.json?.message);
  r = await api('GET', `/logs/user/${otherUser._id}`, { token: wardStaff });
  check('a user cannot read someone else\'s logs (403)', r.status === 403, r.status);
  r = await api('GET', `/logs/user/${staffUser._id}`, { token: admin });
  check('hospital admin can read any user\'s logs', r.status === 200, r.json?.message);
  r = await api('GET', `/logs/user/${staffUser._id}`, { token: manager });
  check('managers can read a user\'s logs', r.status === 200, r.json?.message);
  r = await api('GET', `/logs/user/${staffUser._id}`, { token: erStaff });
  check('ER staff cannot read another user\'s logs (403)', r.status === 403, r.status);

  // ---- Test broadcast endpoint ----
  out('\n--- Test endpoint ---');
  r = await api('GET', '/test/broadcast');
  check('the dummy broadcast endpoint is gone (404)', r.status === 404, r.status);
  r = await api('GET', '/test/broadcast', { token: admin });
  check('...for logged-in users too (404)', r.status === 404, r.status);

  out(`\n${pass} passed, ${fail} failed`);
  if (fail > 0 && serverErrors.length > 0) out('Server errors:\n' + serverErrors.slice(-10).join('\n'));
  await mongod.stop();
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  process.stdout.write(String(error.stack || error) + '\n');
  process.exit(1);
});
