// End-to-end checks for sign-up approval by the technical team (in-memory MongoDB, never the real database)
const path = require('path');
const { execFile } = require('child_process');

const BACKEND = process.env.BACKEND_DIR || path.join(__dirname, '..');
const HERE = __dirname;
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 5095;
const BASE = `http://127.0.0.1:${PORT}/api`;

const out = (...args) => process.stdout.write(args.join(' ') + '\n');
let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  out(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' - ' + JSON.stringify(detail).slice(0, 700)}`);
  ok ? pass++ : fail++;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const api = async (method, route, { body, token } = {}) => {
  const res = await fetch(BASE + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('bedmanager_roletest');
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error(`Refusing to use ${uri}`);

  // Scripts run from this folder so dotenv finds no .env file; returns the exit code and output
  const runScript = (script, args = []) => new Promise((resolve) => {
    execFile(process.execPath, [path.join(BACKEND, script), ...args], { cwd: HERE, env: { ...process.env, MONGO_URI: uri }, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => resolve({ code: error ? error.code ?? 1 : 0, output: `${stdout}${stderr}` }));
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
  const login = async (email, password) => api('POST', '/auth/login', { body: { email, password } });
  const tokenOf = async (email, password) => (await login(email, password)).json?.data?.token;
  const admin = await tokenOf('sarah.chen@hospital.com', 'admin123');
  const manager = await tokenOf('anuradha@hospital.com', 'manager123');
  const tech = await tokenOf('admin@hospital.com', 'admin123');
  check('seeded admin, manager and technical team log in', Boolean(admin && manager && tech));

  // ---- Sign-up ----
  let r = await api('POST', '/auth/register', { body: { name: 'Would Be Tech', email: 'wouldbe.tech@test.com', password: 'secret123', role: 'technical_team' } });
  check('signing up as technical team is refused (400)', r.status === 400, r.json);
  r = await api('POST', '/auth/register', { body: { name: 'Would Be Admin', email: 'wouldbe.admin@test.com', password: 'secret123', role: 'hospital_admin' } });
  check('signing up as hospital admin is refused (400)', r.status === 400, r.json);
  r = await api('POST', '/auth/register', { body: { name: 'New Nurse', email: 'nurse@test.com', password: 'secret123', role: 'ward_staff', ward: 'ICU' } });
  const nurseId = r.json?.data?.user?.id;
  check('ward staff sign-up is pending', r.status === 201 && r.json.data.user.status === 'pending', r.json);

  // A technical team request made before sign-up stopped offering the role
  const legacyTech = await User.create({ name: 'Old Tech Request', email: 'old.tech@test.com', password: 'secret123', role: 'technical_team', status: 'pending' });

  // ---- Who reviews ----
  r = await api('GET', '/users?status=pending', { token: admin });
  check('hospital admins no longer review accounts (403)', r.status === 403, r);
  r = await api('GET', '/users?status=pending', { token: manager });
  check('managers cannot review accounts (403)', r.status === 403, r);
  r = await api('GET', '/users?status=pending', { token: tech });
  const pendingEmails = (r.json?.data?.users || []).map((user) => user.email);
  check('technical team lists pending sign-ups', r.status === 200 && pendingEmails.includes('nurse@test.com') && pendingEmails.includes('old.tech@test.com'), pendingEmails);

  // ---- Roles a reviewer can give ----
  r = await api('PATCH', `/users/${nurseId}/approve`, { token: tech, body: { role: 'hospital_admin' } });
  check('cannot approve someone as hospital admin (400)', r.status === 400, r.json);
  r = await api('PATCH', `/users/${nurseId}/approve`, { token: tech, body: { role: 'technical_team' } });
  check('cannot approve someone as technical team (400)', r.status === 400, r.json);
  r = await api('PATCH', `/users/${legacyTech._id}/approve`, { token: tech });
  check('an old technical team request cannot be approved as requested (400)', r.status === 400 && /can only be approved as/i.test(r.json?.message), r.json);
  r = await api('PATCH', `/users/${legacyTech._id}/reject`, { token: tech });
  check('...but it can be rejected', r.status === 200, r.json);
  r = await api('PATCH', `/users/${nurseId}/approve`, { token: tech, body: { role: 'ward_staff', ward: 'ICU' } });
  check('technical team approves a ward staff sign-up', r.status === 200 && r.json.data.user.status === 'approved', r.json);
  r = await login('nurse@test.com', 'secret123');
  check('approved nurse can log in', r.status === 200 && r.json.data.user.role === 'ward_staff', r.json);

  // ---- Existing privileged accounts ----
  const sarah = await User.findOne({ email: 'sarah.chen@hospital.com' });
  r = await api('PATCH', `/users/${sarah._id}/reject`, { token: tech });
  check('technical team cannot revoke a hospital admin (403)', r.status === 403, r.json);
  r = await api('PATCH', `/users/${sarah._id}/approve`, { token: tech, body: { role: 'manager', ward: 'ICU' } });
  check('technical team cannot change a hospital admin\'s role (403)', r.status === 403, r.json);
  const self = await User.findOne({ email: 'admin@hospital.com' });
  r = await api('PATCH', `/users/${self._id}/reject`, { token: tech });
  check('reviewers cannot change their own account (400)', r.status === 400, r.json);
  r = await api('PATCH', `/users/${nurseId}/reject`, { token: tech });
  check('technical team can revoke an approved ward staff account', r.status === 200, r.json);

  // ---- Command-line account creation ----
  let script = await runScript('createAdmin.js', ['--role', 'technical_team', '--email', 'second.tech@test.com', '--password', 'TechPass123', '--name', 'Second Tech']);
  r = await login('second.tech@test.com', 'TechPass123');
  check('createAdmin.js --role technical_team creates an approved technical team account', script.code === 0 && r.status === 200 && r.json.data.user.role === 'technical_team', { script, login: r.json });
  const secondTech = await User.findOne({ email: 'second.tech@test.com' });
  r = await api('PATCH', `/users/${secondTech._id}/reject`, { token: tech });
  check('one technical team member cannot revoke another (403)', r.status === 403, r.json);
  script = await runScript('createAdmin.js', ['--role', 'manager', '--email', 'nope@test.com', '--password', 'NopePass123']);
  check('createAdmin.js refuses other roles', script.code !== 0 && !(await User.exists({ email: 'nope@test.com' })), script);
  script = await runScript('createAdmin.js', ['--email', 'new.admin@test.com', '--password', 'AdminPass123']);
  r = await login('new.admin@test.com', 'AdminPass123');
  check('createAdmin.js still creates hospital admins by default', script.code === 0 && r.status === 200 && r.json.data.user.role === 'hospital_admin', { script, login: r.json });

  out(`\n${pass} passed, ${fail} failed`);
  if (fail > 0 && serverErrors.length > 0) out('Server errors:\n' + serverErrors.slice(-10).join('\n'));
  await mongod.stop();
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  process.stdout.write(String(error.stack || error) + '\n');
  process.exit(1);
});
