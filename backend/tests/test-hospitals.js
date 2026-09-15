// End-to-end checks for the admin-managed nearby hospital directory (in-memory MongoDB, never the real database)
const path = require('path');
const { execFile } = require('child_process');

const BACKEND = process.env.BACKEND_DIR || path.join(__dirname, '..');
const HERE = __dirname;
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 5097;
const BASE = `http://127.0.0.1:${PORT}/api`;

const out = (...args) => process.stdout.write(args.join(' ') + '\n');
let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  out(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' - ' + JSON.stringify(detail).slice(0, 900)}`);
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
const namesOf = (r, key = 'hospitals') => (r.json?.data?.[key] || []).map((hospital) => hospital.name);

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('bedmanager_hospitaltest');
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error(`Refusing to use ${uri}`);

  // Seed accounts (asynchronous, so mongod's output keeps being read)
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

  const login = async (email, password) => (await api('POST', '/auth/login', { body: { email, password } })).json?.data?.token;
  const admin = await login('sarah.chen@hospital.com', 'admin123');
  const manager = await login('anuradha@hospital.com', 'manager123');
  const staff = await login('staff.icu1@hospital.com', 'staff123');
  const tech = await login('admin@hospital.com', 'admin123'); // technical_team
  check('seeded admin, manager, ward staff and technical team can log in', Boolean(admin && manager && staff && tech));

  const base = {
    name: 'City General',
    address: '1 Main Road',
    distance: 4.2,
    contactNumber: '+91-11-1111-1111',
    wards: [{ wardType: 'ICU', totalBeds: 10, availableBeds: 3 }, { wardType: 'General', totalBeds: 50, availableBeds: 12 }]
  };

  // ---- Access control ----
  let r = await api('GET', '/referrals/hospitals', { token: manager });
  check('manager cannot open the admin directory (403)', r.status === 403, r);
  r = await api('POST', '/referrals/hospitals', { token: manager, body: base });
  check('manager cannot add hospitals (403)', r.status === 403, r);
  r = await api('GET', '/referrals/hospitals', { token: admin });
  check('hospital admin cannot open the directory management list (403)', r.status === 403, r);
  r = await api('POST', '/referrals/hospitals', { token: admin, body: base });
  check('hospital admin cannot add hospitals (403)', r.status === 403, r);
  r = await api('GET', '/referrals/nearby-hospitals', { token: tech });
  check('technical team does not use referral lookups (403)', r.status === 403, r);
  r = await api('GET', '/referrals/nearby-hospitals', { token: staff });
  check('ward staff cannot use referrals (403)', r.status === 403, r);
  r = await api('GET', '/referrals/hospitals', { token: tech });
  check('directory starts empty (no seeded sample hospitals)', r.status === 200 && r.json.data.hospitals.length === 0, r.json);

  // ---- Validation ----
  const invalid = [
    ['a missing name', { ...base, name: '' }, /name is required/i],
    ['more available than total beds', { ...base, wards: [{ wardType: 'ICU', totalBeds: 2, availableBeds: 5 }] }, /cannot exceed total/i],
    ['a repeated ward type', { ...base, wards: [{ wardType: 'ICU', totalBeds: 2, availableBeds: 1 }, { wardType: 'ICU', totalBeds: 3, availableBeds: 1 }] }, /only be listed once/i],
    ['an unknown ward type', { ...base, wards: [{ wardType: 'Cardiology', totalBeds: 2, availableBeds: 1 }] }, /ward type must be one of/i],
    ['no wards', { ...base, wards: [] }, /at least one ward/i],
    ['a negative distance', { ...base, distance: -1 }, /distance/i],
    ['an invalid phone number', { ...base, contactNumber: 'call me' }, /valid contact number/i]
  ];
  for (const [label, body, pattern] of invalid) {
    r = await api('POST', '/referrals/hospitals', { token: tech, body });
    const messages = `${(r.json?.errors || []).map((e) => e.message).join(' | ')} ${r.json?.message || ''}`;
    check(`adding a hospital with ${label} -> 400`, r.status === 400 && pattern.test(messages), { status: r.status, messages });
  }

  // ---- Create ----
  const before = Date.now();
  r = await api('POST', '/referrals/hospitals', { token: tech, body: base });
  const city = r.json?.data?.hospital;
  check('admin adds a hospital; occupied beds derived and the update is stamped with who and when',
    r.status === 201 && city.wards.ICU.total === 10 && city.wards.ICU.available === 3 && city.wards.ICU.occupied === 7 &&
    city.wards.ICU.occupancyRate === 70 && new Date(city.lastUpdated).getTime() >= before - 1000 &&
    city.lastUpdatedBy === 'Admin User' && city.location === null && city.emergencyContact === null,
    r.json);
  check('entries carry no invented fields (rating, acceptsReferrals, cleaning)',
    Boolean(city) && !('rating' in city) && !('acceptsReferrals' in city) && !('cleaning' in city.wards.ICU), city);

  r = await api('POST', '/referrals/hospitals', {
    token: tech,
    body: { ...base, name: 'Full ICU Hospital', distance: 2, wards: [{ wardType: 'ICU', totalBeds: 8, availableBeds: 0 }, { wardType: 'General', totalBeds: 40, availableBeds: 9 }] }
  });
  const fullIcu = r.json?.data?.hospital;
  check('hospital with a full ICU but free General beds added', r.status === 201, r);
  r = await api('POST', '/referrals/hospitals', {
    token: tech,
    body: { ...base, name: 'Far Hospital', distance: 15, location: { latitude: 28.5, longitude: 77.2 }, emergencyContact: '+91 11 2222 2222', wards: [{ wardType: 'ICU', totalBeds: 20, availableBeds: 9 }] }
  });
  const far = r.json?.data?.hospital;
  check('hospital with location and emergency contact added', r.status === 201 && far.location?.latitude === 28.5 && far.emergencyContact === '+91 11 2222 2222', r.json);

  // ---- Referral lookups ----
  r = await api('GET', '/referrals/nearby-hospitals?ward=ICU&maxDistance=10', { token: manager });
  check('ICU search within 10 km only returns hospitals with free ICU beds (not free beds in another ward)',
    r.status === 200 && JSON.stringify(namesOf(r)) === JSON.stringify(['City General']), namesOf(r));
  check('search summary totals the free ICU beds', r.json?.summary?.totalAvailableBeds === 3 && r.json?.summary?.averageDistance === 4.2, r.json?.summary);
  r = await api('GET', '/referrals/nearby-hospitals?maxDistance=20', { token: admin });
  check('nearby hospitals sorted nearest first', JSON.stringify(namesOf(r)) === JSON.stringify(['Full ICU Hospital', 'City General', 'Far Hospital']), namesOf(r));
  r = await api('GET', '/referrals/nearby-hospitals?maxDistance=abc', { token: manager });
  check('invalid maxDistance -> 400', r.status === 400, r);
  r = await api('GET', '/referrals/available-capacity?ward=ICU', { token: manager });
  check('available ICU capacity lists hospitals with free ICU beds, most first (previously always empty)',
    r.status === 200 && JSON.stringify(namesOf(r)) === JSON.stringify(['Far Hospital', 'City General']), namesOf(r));
  r = await api('GET', '/referrals/available-capacity?ward=Cardiology', { token: manager });
  check('available capacity for an unknown ward -> 400', r.status === 400, r);
  r = await api('GET', '/referrals/recommendations?ward=ICU&urgency=low', { token: manager });
  const recommendations = r.json?.data?.recommendations || [];
  check('low-urgency recommendations: 3+ free beds, most first, no rating-based reasons',
    r.status === 200 && recommendations.map((h) => h.name).join() === 'Far Hospital,City General' &&
    recommendations.every((h) => !/rating/i.test(h.recommendationReason)),
    recommendations.map((h) => [h.name, h.recommendationReason]));

  // ---- Update details ----
  const stampBefore = city.lastUpdated;
  r = await api('PUT', `/referrals/hospitals/${city.id}`, { token: tech, body: { name: 'City General Hospital', contactNumber: '+91-11-3333-3333' } });
  check('editing details keeps the bed-count update time', r.status === 200 && r.json.data.hospital.name === 'City General Hospital' && r.json.data.hospital.lastUpdated === stampBefore, r.json);
  r = await api('PUT', `/referrals/hospitals/${city.id}`, { token: tech, body: { wards: [] } });
  check('editing details cannot change bed counts (400)', r.status === 400, r);
  r = await api('PUT', `/referrals/hospitals/${city.id}`, { token: tech, body: { contactNumber: 'not a phone' } });
  check('edited details are validated (400)', r.status === 400, r);

  // ---- Update bed counts ----
  await sleep(20);
  r = await api('PUT', `/referrals/hospitals/${city.id}/beds`, { token: tech, body: { wards: [{ wardType: 'ICU', totalBeds: 12, availableBeds: 0 }] } });
  const updated = r.json?.data?.hospital;
  check('bed counts replaced and the update time and admin recorded',
    r.status === 200 && updated.wards.ICU.available === 0 && updated.wards.ICU.total === 12 && !updated.wards.General &&
    new Date(updated.lastUpdated) > new Date(stampBefore) && updated.lastUpdatedBy === 'Admin User', updated);
  r = await api('PUT', `/referrals/hospitals/${city.id}/beds`, { token: tech, body: { wards: [{ wardType: 'ICU', totalBeds: 1, availableBeds: 4 }] } });
  check('bed counts are validated (400)', r.status === 400, r);
  r = await api('PUT', `/referrals/hospitals/${city.id}/beds`, { token: manager, body: { wards: [{ wardType: 'ICU', totalBeds: 1, availableBeds: 1 }] } });
  check('managers cannot change bed counts (403)', r.status === 403, r);

  // ---- Deactivate ----
  r = await api('PUT', `/referrals/hospitals/${far.id}`, { token: tech, body: { isActive: false } });
  check('hospital deactivated', r.status === 200 && r.json.data.hospital.isActive === false, r.json);
  r = await api('GET', '/referrals/nearby-hospitals?maxDistance=20', { token: manager });
  check('inactive hospitals are hidden from referrals', r.status === 200 && !namesOf(r).includes('Far Hospital'), namesOf(r));
  r = await api('GET', '/referrals/hospitals', { token: tech });
  check('inactive hospitals stay in the admin directory', (r.json?.data?.hospitals || []).some((h) => h.name === 'Far Hospital' && h.isActive === false));

  // ---- Documents created by the old seed script ----
  const Hospital = require(path.join(BACKEND, 'models/Hospital'));
  const legacy = await Hospital.collection.insertOne({
    name: 'Legacy Sample', address: 'Old Road', location: { latitude: 28.6, longitude: 77.3 }, distance: 3,
    contactNumber: '+91-120-000-0000', emergencyContact: '+91-120-000-0001', rating: 4.5,
    wards: [{ wardType: 'ICU', totalBeds: 30, availableBeds: 5, occupiedBeds: 25 }],
    isActive: true, lastUpdated: new Date(Date.now() - 20 * 24 * 3600 * 1000), createdAt: new Date(), updatedAt: new Date()
  });
  r = await api('GET', `/referrals/hospitals/${legacy.insertedId}`, { token: manager });
  check('old sample documents are read without their rating', r.status === 200 && !('rating' in r.json.data.hospital) && r.json.data.hospital.wards.ICU.occupied === 25 && r.json.data.hospital.lastUpdatedBy === null, r.json);
  r = await api('PUT', `/referrals/hospitals/${legacy.insertedId}/beds`, { token: tech, body: { wards: [{ wardType: 'ICU', totalBeds: 30, availableBeds: 7 }] } });
  check('old sample documents can have their bed counts updated', r.status === 200 && r.json.data.hospital.wards.ICU.available === 7, r.json);

  // ---- Delete ----
  r = await api('DELETE', `/referrals/hospitals/${fullIcu.id}`, { token: manager });
  check('managers cannot remove hospitals (403)', r.status === 403, r);
  r = await api('DELETE', `/referrals/hospitals/${fullIcu.id}`, { token: tech });
  check('admin removes a hospital', r.status === 200, r);
  r = await api('GET', `/referrals/hospitals/${fullIcu.id}`, { token: tech });
  check('removed hospital is gone (404)', r.status === 404, r);
  r = await api('DELETE', `/referrals/hospitals/${fullIcu.id}`, { token: tech });
  check('removing it again -> 404', r.status === 404, r);
  r = await api('GET', '/referrals/hospitals/not-an-id', { token: tech });
  check('invalid hospital ID -> 400', r.status === 400, r);

  out(`\n${pass} passed, ${fail} failed`);
  if (fail > 0 && serverErrors.length > 0) out('Server errors:\n' + serverErrors.slice(-10).join('\n'));
  await mongod.stop();
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  process.stdout.write(String(error.stack || error) + '\n');
  process.exit(1);
});
