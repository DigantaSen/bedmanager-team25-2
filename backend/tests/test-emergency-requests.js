// End-to-end checks for emergency request permissions: who may raise, read, decide on
// and delete requests (in-memory MongoDB, never the real database)
const path = require('path');
const { execFile } = require('child_process');

const BACKEND = process.env.BACKEND_DIR || path.join(__dirname, '..');
const HERE = __dirname;
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 5091;
const BASE = `http://127.0.0.1:${PORT}/api`;

const out = (...args) => process.stdout.write(args.join(' ') + '\n');
let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  out(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' - ' + JSON.stringify(detail).slice(0, 400)}`);
  ok ? pass++ : fail++;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const api = async (method, route, { token, body } = {}) => {
  const res = await fetch(BASE + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    ...(body && { body: JSON.stringify(body) })
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('bedmanager_emergencytest');
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
  const EmergencyRequest = require(path.join(BACKEND, 'models/EmergencyRequest'));

  const tokenOf = async (email, password) => (await api('POST', '/auth/login', { body: { email, password } })).json?.data?.token;
  const admin = await tokenOf('sarah.chen@hospital.com', 'admin123');
  const manager = await tokenOf('anuradha@hospital.com', 'manager123'); // ICU
  const wardStaff = await tokenOf('staff.icu1@hospital.com', 'staff123');
  const er1 = await tokenOf('er.staff1@hospital.com', 'erstaff123');
  const er2 = await tokenOf('er.staff2@hospital.com', 'erstaff123');
  const tech = await tokenOf('admin@hospital.com', 'admin123');
  check('seeded roles log in', Boolean(admin && manager && wardStaff && er1 && er2 && tech));

  const er1User = await User.findOne({ email: 'er.staff1@hospital.com' });
  const er2User = await User.findOne({ email: 'er.staff2@hospital.com' });

  const newRequest = (overrides = {}) => ({
    patientName: 'Test Patient',
    location: 'ER Bay 9',
    ward: 'ICU',
    priority: 'high',
    ...overrides
  });

  // ---- Creating ----
  out('\n--- Raising a request ---');
  let r = await api('POST', '/emergency-requests', { body: newRequest() });
  check('creating needs a login (401)', r.status === 401, r.status);
  r = await api('POST', '/emergency-requests', { token: wardStaff, body: newRequest() });
  check('ward staff cannot raise a request (403)', r.status === 403, r.status);
  r = await api('POST', '/emergency-requests', { token: tech, body: newRequest() });
  check('technical team cannot raise a request (403)', r.status === 403, r.status);

  r = await api('POST', '/emergency-requests', { token: er1, body: newRequest({ patientName: 'ER1 ICU Patient' }) });
  check('ER staff can raise a request (201)', r.status === 201, r.json?.message);
  const er1IcuId = r.json?.data?.emergencyRequest?._id;
  check('the request records who raised it', String(r.json?.data?.emergencyRequest?.requestedBy) === String(er1User._id), r.json?.data?.emergencyRequest?.requestedBy);

  r = await api('POST', '/emergency-requests', { token: er1, body: newRequest({ patientName: 'ER1 General Patient', ward: 'General' }) });
  const er1GeneralId = r.json?.data?.emergencyRequest?._id;
  check('ER staff can raise a request for another ward (201)', r.status === 201, r.json?.message);

  // requestedBy must come from the token, not the body
  r = await api('POST', '/emergency-requests', { token: er2, body: newRequest({ patientName: 'ER2 Patient', requestedBy: String(er1User._id) }) });
  const er2IcuId = r.json?.data?.emergencyRequest?._id;
  check('requestedBy cannot be forged through the body', String(r.json?.data?.emergencyRequest?.requestedBy) === String(er2User._id), r.json?.data?.emergencyRequest?.requestedBy);

  r = await api('POST', '/emergency-requests', { token: manager, body: newRequest({ patientName: 'Manager Raised' }) });
  check('a manager can raise a request (201)', r.status === 201, r.json?.message);
  const managerRaisedId = r.json?.data?.emergencyRequest?._id;

  // ---- Listing ----
  out('\n--- Reading the list ---');
  r = await api('GET', '/emergency-requests');
  check('the list needs a login (401)', r.status === 401, r.status);
  r = await api('GET', '/emergency-requests', { token: wardStaff });
  check('ward staff cannot read the list (403)', r.status === 403, r.status);
  r = await api('GET', '/emergency-requests', { token: tech });
  check('technical team cannot read the list (403)', r.status === 403, r.status);

  r = await api('GET', '/emergency-requests', { token: er1 });
  const er1List = r.json?.data?.emergencyRequests || [];
  check('ER staff read their own list (200)', r.status === 200, r.json?.message);
  check('every request ER staff see is one they raised', er1List.length > 0 && er1List.every((req) => String(req.requestedBy) === String(er1User._id)),
    er1List.map((req) => req.requestedBy).slice(0, 5));
  check('ER staff see both of their own requests', er1List.some((req) => req._id === er1IcuId) && er1List.some((req) => req._id === er1GeneralId));
  check("ER staff do not see another ER user's request", !er1List.some((req) => req._id === er2IcuId));
  check('ER staff no longer see the seeded requests of other staff', !er1List.some((req) => req.patientName === 'ER2 Patient'));

  r = await api('GET', '/emergency-requests', { token: manager });
  const managerList = r.json?.data?.emergencyRequests || [];
  check('a manager reads the list (200)', r.status === 200, r.json?.message);
  check('a manager only sees their own ward', managerList.length > 0 && managerList.every((req) => req.ward === 'ICU'),
    managerList.map((req) => req.ward).slice(0, 5));
  check('a manager sees requests raised by ER staff in their ward', managerList.some((req) => req._id === er1IcuId));

  r = await api('GET', '/emergency-requests', { token: admin });
  const adminList = r.json?.data?.emergencyRequests || [];
  check('a hospital admin reads every ward', r.status === 200 && new Set(adminList.map((req) => req.ward)).size > 1,
    [...new Set(adminList.map((req) => req.ward))]);
  const totalRequests = await EmergencyRequest.countDocuments();
  check('a hospital admin sees every request', adminList.length === totalRequests, [adminList.length, totalRequests]);

  // ---- Reading one ----
  out('\n--- Reading one request ---');
  r = await api('GET', `/emergency-requests/${er1IcuId}`);
  check('reading one needs a login (401)', r.status === 401, r.status);
  r = await api('GET', `/emergency-requests/${er1IcuId}`, { token: wardStaff });
  check('ward staff cannot read one (403)', r.status === 403, r.status);
  r = await api('GET', `/emergency-requests/${er1IcuId}`, { token: er1 });
  check('ER staff can read their own request (200)', r.status === 200, r.json?.message);
  r = await api('GET', `/emergency-requests/${er2IcuId}`, { token: er1 });
  check("ER staff cannot read another user's request (403)", r.status === 403, r.status);
  check('...and the patient name is not in the refusal', !JSON.stringify(r.json || {}).includes('ER2 Patient'));
  r = await api('GET', `/emergency-requests/${er1GeneralId}`, { token: manager });
  check('a manager cannot read a request from another ward (403)', r.status === 403, r.status);
  r = await api('GET', `/emergency-requests/${er1IcuId}`, { token: manager });
  check('a manager can read a request from their own ward (200)', r.status === 200, r.json?.message);
  r = await api('GET', `/emergency-requests/${er1GeneralId}`, { token: admin });
  check('a hospital admin can read any request (200)', r.status === 200, r.json?.message);

  // ---- Approving and rejecting ----
  out('\n--- Deciding on a request ---');
  r = await api('PATCH', `/emergency-requests/${er1IcuId}/approve`, { body: {} });
  check('approving needs a login (401)', r.status === 401, r.status);
  r = await api('PATCH', `/emergency-requests/${er1IcuId}/approve`, { token: er1, body: {} });
  check('ER staff cannot approve their own request (403)', r.status === 403, r.status);
  r = await api('PATCH', `/emergency-requests/${er1IcuId}/reject`, { token: er1, body: {} });
  check('ER staff cannot reject a request (403)', r.status === 403, r.status);
  r = await api('PATCH', `/emergency-requests/${er1IcuId}/approve`, { token: wardStaff, body: {} });
  check('ward staff cannot approve a request (403)', r.status === 403, r.status);
  r = await api('PATCH', `/emergency-requests/${er1IcuId}/approve`, { token: tech, body: {} });
  check('technical team cannot approve a request (403)', r.status === 403, r.status);

  r = await api('PATCH', `/emergency-requests/${er1GeneralId}/approve`, { token: manager, body: {} });
  check('a manager cannot approve another ward (403)', r.status === 403, r.json?.message);
  r = await api('PATCH', `/emergency-requests/${er1GeneralId}/reject`, { token: manager, body: {} });
  check('a manager cannot reject another ward (403)', r.status === 403, r.json?.message);

  r = await api('PATCH', `/emergency-requests/${er1IcuId}/approve`, { token: manager, body: {} });
  check('a manager approves a request in their own ward (200)', r.status === 200 && r.json?.data?.emergencyRequest?.status === 'approved', r.json?.message);
  r = await api('PATCH', `/emergency-requests/${er2IcuId}/reject`, { token: manager, body: { rejectionReason: 'No ICU bed' } });
  check('a manager rejects a request in their own ward (200)', r.status === 200 && r.json?.data?.emergencyRequest?.status === 'rejected', r.json?.message);
  r = await api('PATCH', `/emergency-requests/${er1GeneralId}/approve`, { token: admin, body: {} });
  check('a hospital admin approves any ward (200)', r.status === 200, r.json?.message);

  // ---- Editing ----
  out('\n--- Editing a request ---');
  r = await api('PUT', `/emergency-requests/${managerRaisedId}`, { body: { status: 'approved' } });
  check('editing needs a login (401)', r.status === 401, r.status);
  r = await api('PUT', `/emergency-requests/${managerRaisedId}`, { token: er1, body: { status: 'approved' } });
  check('ER staff cannot edit a request (403)', r.status === 403, r.status);
  r = await api('PUT', `/emergency-requests/${managerRaisedId}`, { token: wardStaff, body: { status: 'approved' } });
  check('ward staff cannot edit a request (403)', r.status === 403, r.status);

  // Raised here rather than looked up in the seed, whose request statuses are random
  const freshGeneral = await api('POST', '/emergency-requests', { token: er1, body: newRequest({ patientName: 'General Ward Patient', ward: 'General' }) });
  check('a pending General request exists to test with (201)', freshGeneral.status === 201, freshGeneral.json?.message);
  r = await api('PUT', `/emergency-requests/${freshGeneral.json?.data?.emergencyRequest?._id}`, { token: manager, body: { status: 'approved' } });
  check('a manager cannot edit a request from another ward (403)', r.status === 403, r.json?.message);
  r = await api('PUT', `/emergency-requests/${managerRaisedId}`, { token: manager, body: { location: 'ER Bay 3' } });
  check('a manager edits a request in their own ward (200)', r.status === 200 && r.json?.data?.emergencyRequest?.location === 'ER Bay 3', r.json?.message);
  r = await api('PUT', `/emergency-requests/${managerRaisedId}`, { token: admin, body: { description: 'Reviewed by admin' } });
  check('a hospital admin edits any request (200)', r.status === 200, r.json?.message);

  // ---- Deleting ----
  out('\n--- Deleting a request ---');
  r = await api('DELETE', `/emergency-requests/${managerRaisedId}`);
  check('deleting needs a login (401)', r.status === 401, r.status);
  r = await api('DELETE', `/emergency-requests/${managerRaisedId}`, { token: er1 });
  check('ER staff cannot delete a request (403)', r.status === 403, r.status);
  r = await api('DELETE', `/emergency-requests/${managerRaisedId}`, { token: wardStaff });
  check('ward staff cannot delete a request (403)', r.status === 403, r.status);
  r = await api('DELETE', `/emergency-requests/${managerRaisedId}`, { token: manager });
  check('a manager cannot delete a request (403)', r.status === 403, r.status);
  check('the request survived every refused delete', Boolean(await EmergencyRequest.findById(managerRaisedId)));
  r = await api('DELETE', `/emergency-requests/${managerRaisedId}`, { token: admin });
  check('a hospital admin can delete a request (200)', r.status === 200, r.json?.message);
  check('...and it is gone', (await EmergencyRequest.findById(managerRaisedId)) === null);

  // ---- Seeded data keeps working ----
  out('\n--- Seeded data ---');
  const seededWithRequester = await EmergencyRequest.countDocuments({ requestedBy: { $ne: null } });
  check('seeded requests are attributed to real ER staff', seededWithRequester >= totalRequests - 4, [seededWithRequester, totalRequests]);
  const staffIds = new Set((await User.find().select('_id').lean()).map((u) => String(u._id)));
  const attributed = await EmergencyRequest.find({ requestedBy: { $ne: null } }).select('requestedBy').lean();
  check('every requester is an account that exists', attributed.length > 0 && attributed.every((req) => staffIds.has(String(req.requestedBy))));

  out(`\n${pass} passed, ${fail} failed`);
  if (fail > 0 && serverErrors.length > 0) out('Server errors:\n' + serverErrors.slice(-10).join('\n'));
  await mongod.stop();
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  process.stdout.write(String(error.stack || error) + '\n');
  process.exit(1);
});
