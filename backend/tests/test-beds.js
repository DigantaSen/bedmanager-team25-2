// End-to-end checks for role-scoped bed access and the technical team's bed inventory (in-memory MongoDB)
const path = require('path');
const { execFile } = require('child_process');

const BACKEND = process.env.BACKEND_DIR || path.join(__dirname, '..');
const HERE = __dirname;
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 5096;
const BASE = `http://127.0.0.1:${PORT}/api`;
const PATIENT_FIELDS = ['patientName', 'patientId', 'notes', 'dischargeNotes'];

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
const hasPatientFields = (bed) => PATIENT_FIELDS.some((field) => field in bed);

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('bedmanager_bedtest');
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

  const Bed = require(path.join(BACKEND, 'models/Bed'));
  const login = async (email, password) => (await api('POST', '/auth/login', { body: { email, password } })).json?.data?.token;
  const admin = await login('sarah.chen@hospital.com', 'admin123');
  const manager = await login('anuradha@hospital.com', 'manager123'); // ICU manager
  const icuStaff = await login('staff.icu1@hospital.com', 'staff123');
  const generalStaff = await login('staff.general1@hospital.com', 'staff123');
  const erStaff = await login('er.staff1@hospital.com', 'erstaff123');
  const tech = await login('admin@hospital.com', 'admin123'); // technical_team
  check('all seeded roles can log in', Boolean(admin && manager && icuStaff && generalStaff && erStaff && tech));

  let beds = await Bed.find().lean();
  const pickBed = (ward, status, skip = []) => beds.find((bed) => bed.ward === ward && bed.status === status && !skip.includes(bed.bedId));
  const icuCount = beds.filter((bed) => bed.ward === 'ICU').length;

  // ================= Reads =================
  out('\n--- Reading beds by role ---');
  let r = await api('GET', '/beds', { token: icuStaff });
  let list = r.json?.data?.beds || [];
  check('ward staff only get their own ward (scope is applied now)', r.status === 200 && list.length === icuCount && list.every((bed) => bed.ward === 'ICU'), { count: list.length, wards: [...new Set(list.map((b) => b.ward))] });
  check('ward staff see patient details in their ward', list.filter((b) => b.status === 'occupied').every((b) => b.patientName));
  r = await api('GET', '/beds?ward=General&status=available', { token: icuStaff });
  check('ward staff cannot widen their scope with ?ward=', r.status === 200 && r.json.data.beds.every((bed) => bed.ward === 'ICU' && bed.status === 'available'), r.json?.data?.beds?.map((b) => b.ward));

  r = await api('GET', '/beds', { token: erStaff });
  list = r.json?.data?.beds || [];
  check('ER staff get every bed (for ward capacity) without patient details', r.status === 200 && list.length === beds.length && list.some((b) => b.status === 'occupied') && !list.some(hasPatientFields), { count: list.length, withPatient: list.filter(hasPatientFields).length });

  r = await api('GET', '/beds', { token: tech });
  list = r.json?.data?.beds || [];
  check('technical team get every bed without patient details', r.status === 200 && list.length === beds.length && !list.some(hasPatientFields), { count: list.length, withPatient: list.filter(hasPatientFields).length });

  r = await api('GET', '/beds', { token: manager });
  list = r.json?.data?.beds || [];
  const managerIcuOccupied = list.filter((b) => b.ward === 'ICU' && b.status === 'occupied');
  const managerOtherOccupied = list.filter((b) => b.ward !== 'ICU' && b.status === 'occupied');
  check('ICU manager sees patient details only for ICU beds', r.status === 200 && managerIcuOccupied.every((b) => b.patientName) && managerOtherOccupied.length > 0 && !managerOtherOccupied.some(hasPatientFields));

  r = await api('GET', '/beds', { token: admin });
  check('hospital admin sees patient details for all wards', r.status === 200 && r.json.data.beds.filter((b) => b.status === 'occupied').every((b) => b.patientName));

  const generalOccupied = pickBed('General', 'occupied');
  const icuOccupied = pickBed('ICU', 'occupied');
  r = await api('GET', `/beds/${generalOccupied._id}`, { token: erStaff });
  check('single bed for ER staff: no patient details', r.status === 200 && !hasPatientFields(r.json.data.bed), r.json);
  r = await api('GET', `/beds/${generalOccupied._id}`, { token: icuStaff });
  check('ward staff cannot open another ward\'s bed (403)', r.status === 403, r);

  r = await api('GET', '/beds/occupied', { token: erStaff });
  check('occupied-beds list is not available to ER staff (403)', r.status === 403, r);
  r = await api('GET', '/beds/occupied', { token: tech });
  check('occupied-beds list is not available to the technical team (403)', r.status === 403, r);
  r = await api('GET', '/beds/occupied', { token: manager });
  check('manager\'s occupied-beds list is limited to their ward', r.status === 200 && r.json.data.beds.every((b) => b.ward === 'ICU'), r.json?.data?.beds?.map((b) => b.ward));

  r = await api('GET', `/beds/${generalOccupied._id}/occupant-history`, { token: manager });
  check('manager cannot read another ward\'s occupant history (403)', r.status === 403, r);
  r = await api('GET', `/beds/${icuOccupied._id}/occupant-history`, { token: manager });
  check('manager reads occupant history for their ward', r.status === 200, r.status);
  r = await api('GET', `/beds/${icuOccupied._id}/occupant-history`, { token: icuStaff });
  check('occupant history is not available to ward staff (403)', r.status === 403, r);

  // ================= Actions =================
  out('\n--- Acting on beds is limited to the user\'s ward ---');
  r = await api('PATCH', `/beds/${generalOccupied._id}/status`, { token: manager, body: { status: 'available' } });
  check('ICU manager cannot change a General bed\'s status (403, was allowed)', r.status === 403, r);
  const icuAvailable = pickBed('ICU', 'available');
  r = await api('PATCH', `/beds/${icuAvailable._id}/status`, { token: manager, body: { status: 'occupied', patientName: 'Scoped Patient' } });
  check('ICU manager can assign a patient in ICU', r.status === 200, r);
  r = await api('PATCH', `/beds/${generalOccupied._id}/status`, { token: icuStaff, body: { status: 'available' } });
  check('ICU ward staff cannot change a General bed (403)', r.status === 403, r);
  r = await api('PATCH', `/beds/${icuAvailable._id}/status`, { token: tech, body: { status: 'available' } });
  check('technical team cannot change bed status (403)', r.status === 403, r);

  r = await api('PATCH', `/beds/${generalOccupied._id}/status`, { token: generalStaff, body: { status: 'available' } });
  check('General ward staff release a General patient (bed goes to cleaning)', r.status === 200 && r.json.data.bed.status === 'cleaning', r);
  r = await api('PUT', `/beds/${generalOccupied._id}/cleaning/mark-complete`, { token: icuStaff });
  check('ICU ward staff cannot finish a General cleaning (403, was allowed)', r.status === 403, r);
  r = await api('POST', `/beds/${generalOccupied._id}/predict-cleaning`, { token: icuStaff });
  check('ICU ward staff cannot request predictions for a General bed (403)', r.status === 403, r);
  r = await api('PUT', `/beds/${generalOccupied._id}/cleaning/mark-complete`, { token: generalStaff });
  check('General ward staff finish their cleaning', r.status === 200, r);

  const generalOccupied2 = pickBed('General', 'occupied', [generalOccupied.bedId]);
  const inAWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  r = await api('PATCH', `/beds/${generalOccupied2._id}/discharge-time`, { token: manager, body: { estimatedDischargeTime: inAWeek } });
  check('ICU manager cannot set a General discharge time (403, was allowed)', r.status === 403, r);
  const icuOccupied2 = pickBed('ICU', 'occupied');
  r = await api('PATCH', `/beds/${icuOccupied2._id}/discharge-time`, { token: manager, body: { estimatedDischargeTime: inAWeek } });
  check('ICU manager sets an ICU discharge time', r.status === 200, r);
  r = await api('PATCH', `/beds/${generalOccupied2._id}/discharge-time`, { token: admin, body: { estimatedDischargeTime: inAWeek } });
  check('hospital admin sets discharge times in any ward', r.status === 200, r);

  // Baseline history before any inventory change
  const timeline = async () => (await api('GET', '/analytics/occupancy-timeline?range=7days', { token: admin })).json.data;
  const summaryNow = async () => (await api('GET', '/analytics/occupancy-summary', { token: admin })).json;
  const baseline = await timeline();
  const baselineSummary = await summaryNow();
  const samePast = (a, b) => {
    const diffs = a.periods.slice(0, -1).map((p, i) => Math.abs(p.averageOccupancy - b.periods[i].averageOccupancy));
    return { ok: diffs.every((d) => d <= 0.1), diffs };
  };

  // ================= Inventory =================
  out('\n--- Bed inventory ---');
  r = await api('POST', '/beds', { token: erStaff, body: { bedId: 'iA13', ward: 'ICU' } });
  check('ER staff cannot add beds (403)', r.status === 403, r);
  r = await api('POST', '/beds', { token: manager, body: { bedId: 'iA13', ward: 'ICU' } });
  check('managers cannot add beds (403)', r.status === 403, r);
  r = await api('POST', '/beds', { token: admin, body: { bedId: 'iA13', ward: 'ICU' } });
  check('hospital admins cannot add beds (403)', r.status === 403, r);
  r = await api('POST', '/beds', { token: tech, body: { bedId: 'iA13', ward: 'Cardiology' } });
  check('adding a bed to an unknown ward -> 400', r.status === 400, r.json);
  r = await api('POST', '/beds', { token: tech, body: { bedId: 'bad id!', ward: 'ICU' } });
  check('adding a bed with an invalid ID -> 400', r.status === 400, r.json);
  r = await api('POST', '/beds', { token: tech, body: { bedId: 'iA1', ward: 'ICU' } });
  check('adding an existing bed ID -> 409', r.status === 409, r.json);
  r = await api('POST', '/beds', { token: tech, body: { bedId: 'iA13', ward: 'ICU', status: 'occupied', patientName: 'Injected' } });
  const newBed = r.json?.data?.bed;
  check('technical team adds a bed (always available, no patient fields accepted)', r.status === 201 && newBed.status === 'available' && !newBed.patientName, r.json);

  const afterAdd = await timeline();
  let past = samePast(afterAdd, baseline);
  check('adding a bed does not change past occupancy (it counts from when it was added)', past.ok, past.diffs);
  const addSummary = await summaryNow();
  check('total beds +1 and week-over-week bed change reflects the new bed', addSummary.totalBeds === baselineSummary.totalBeds + 1 && addSummary.weekOverWeek.totalBedsChange === 1, { before: baselineSummary.totalBeds, after: addSummary.totalBeds, change: addSummary.weekOverWeek.totalBedsChange });
  r = await api('GET', '/analytics/occupancy-by-ward?ward=ICU', { token: admin });
  check('ward counts include the new bed', r.json?.totalBeds === icuCount + 1, r.json);

  r = await api('PATCH', `/beds/${newBed._id}`, { token: tech, body: { ward: 'General' } });
  check('technical team moves an available bed to another ward', r.status === 200 && r.json.data.bed.ward === 'General', r.json);
  r = await api('PATCH', `/beds/${newBed._id}`, { token: tech, body: { bedId: 'iA1' } });
  check('renaming to an existing bed ID -> 409', r.status === 409, r.json);
  r = await api('PATCH', `/beds/${newBed._id}`, { token: tech, body: {} });
  check('editing with nothing to change -> 400', r.status === 400, r.json);
  r = await api('PATCH', `/beds/${newBed._id}`, { token: tech, body: { bedId: 'G22' } });
  check('technical team renames the bed', r.status === 200 && r.json.data.bed.bedId === 'G22', r.json);
  const occupiedForEdit = pickBed('Emergency', 'occupied');
  r = await api('PATCH', `/beds/${occupiedForEdit._id}`, { token: tech, body: { ward: 'General' } });
  check('an occupied bed cannot be edited (409)', r.status === 409, r.json);
  r = await api('PATCH', `/beds/${occupiedForEdit._id}/retire`, { token: tech });
  check('an occupied bed cannot be retired (409)', r.status === 409, r.json);

  // Retire a bed that has history
  beds = await Bed.find().lean();
  const withHistory = pickBed('Emergency', 'available');
  r = await api('PATCH', `/beds/${withHistory._id}/retire`, { token: tech });
  check('technical team retires an available bed', r.status === 200 && r.json.data.bed.retiredAt, r.json);
  r = await api('GET', '/beds', { token: tech });
  check('retired beds are left out of the bed list', !r.json.data.beds.some((b) => b.bedId === withHistory.bedId));
  r = await api('GET', '/beds?includeRetired=true', { token: tech });
  check('technical team can list retired beds', r.json.data.beds.some((b) => b.bedId === withHistory.bedId && b.retiredAt));
  r = await api('GET', '/beds?includeRetired=true', { token: manager });
  check('other roles never see retired beds', !r.json.data.beds.some((b) => b.bedId === withHistory.bedId));
  r = await api('GET', '/beds?includeRetired=true', { token: admin });
  check('hospital admins do not see retired beds either', !r.json.data.beds.some((b) => b.bedId === withHistory.bedId));
  r = await api('GET', `/beds/${withHistory._id}`, { token: erStaff });
  check('retired bed is not found for other roles (404)', r.status === 404, r);
  const emergencyManagerLike = generalStaff; // any non-inventory user
  r = await api('PATCH', `/beds/${withHistory._id}/status`, { token: emergencyManagerLike, body: { status: 'occupied', patientName: 'X' } });
  check('retired bed cannot be used for patients', r.status === 404 || r.status === 403, r);
  r = await api('PATCH', `/beds/${withHistory._id}/retire`, { token: tech });
  check('retiring it again -> 409', r.status === 409, r.json);

  const afterRetire = await timeline();
  past = samePast(afterRetire, baseline);
  check('retiring a bed keeps it in past occupancy (reports unchanged for earlier periods)', past.ok, past.diffs);
  const retireSummary = await summaryNow();
  check('current total drops back and the week-over-week change nets to 0 (one added, one retired)', retireSummary.totalBeds === baselineSummary.totalBeds && retireSummary.weekOverWeek.totalBedsChange === 0, { total: retireSummary.totalBeds, change: retireSummary.weekOverWeek.totalBedsChange });
  r = await api('GET', '/analytics/occupancy-by-ward?ward=Emergency', { token: admin });
  check('ward counts leave out the retired bed', r.json?.totalBeds === beds.filter((b) => b.ward === 'Emergency').length - 1, r.json);

  r = await api('PATCH', `/beds/${withHistory._id}/reactivate`, { token: tech });
  check('technical team reactivates the bed', r.status === 200 && !r.json.data.bed.retiredAt, r.json);
  r = await api('PATCH', `/beds/${withHistory._id}/reactivate`, { token: tech });
  check('reactivating a bed in service -> 409', r.status === 409, r.json);
  r = await api('PATCH', `/beds/${withHistory._id}/retire`, { token: manager });
  check('managers cannot retire beds (403)', r.status === 403, r);

  out(`\n${pass} passed, ${fail} failed`);
  if (fail > 0 && serverErrors.length > 0) out('Server errors:\n' + serverErrors.slice(-10).join('\n'));
  await mongod.stop();
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  process.stdout.write(String(error.stack || error) + '\n');
  process.exit(1);
});
