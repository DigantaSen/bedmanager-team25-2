// End-to-end checks for real-data forecasting, estimates and status logging.
// Uses an in-memory MongoDB seeded by seedBeds.js + generateSyntheticData.js (never the real database).
const path = require('path');
const { execFile, spawn } = require('child_process');

const BACKEND = process.env.BACKEND_DIR || path.join(__dirname, '..');
const ML_DIR = process.env.ML_DIR || path.join(__dirname, '../../ml-service');
const HERE = __dirname;
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 5098;
const ML_PORT = 8011;
const ML_NO_DB_PORT = 8012;
const BASE = `http://127.0.0.1:${PORT}/api`;
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const out = (...args) => process.stdout.write(args.join(' ') + '\n');
let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  out(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' - ' + JSON.stringify(detail).slice(0, 900)}`);
  ok ? pass++ : fail++;
};
const near = (a, b, tolerance) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tolerance;
const round1 = (value) => Math.round(value * 10) / 10;
const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const request = async (base, method, route, { body, token } = {}) => {
  const res = await fetch(base + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};
const api = (method, route, options) => request(BASE, method, route, options);
const mlApi = (port) => (method, route, options) => request(`http://127.0.0.1:${port}`, method, route, options);

const children = [];
process.on('exit', () => children.forEach((child) => child.kill()));
const startMl = (port, mongoUri) => {
  const child = spawn(path.join(ML_DIR, 'venv/Scripts/python.exe'), ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: ML_DIR,
    env: { ...process.env, MONGO_URI: mongoUri },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.output = '';
  child.stdout.on('data', (chunk) => { child.output += chunk; });
  child.stderr.on('data', (chunk) => { child.output += chunk; });
  children.push(child);
  return child;
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('bedmanager_apitest');
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error(`Refusing to use ${uri}`);

  // Seed from this folder so dotenv finds no .env file (asynchronous, so mongod's output keeps being read)
  const runScript = (script) => new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(BACKEND, script)], { cwd: HERE, env: { ...process.env, MONGO_URI: uri }, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => (error ? reject(new Error(`${script} failed: ${error.message}\n${stdout}\n${stderr}`)) : resolve(stdout)));
  });
  await runScript('seedBeds.js');
  await runScript('generateSyntheticData.js');
  out('Seeded in-memory database');

  Object.assign(process.env, {
    MONGO_URI: uri,
    JWT_SECRET: 'x'.repeat(64),
    PORT: String(PORT),
    NODE_ENV: 'test',
    ML_SERVICE_URL: `http://127.0.0.1:${ML_PORT}`
  });

  // Silence server logs (keep errors for the summary)
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
  const OccupancyLog = require(path.join(BACKEND, 'models/OccupancyLog'));
  const CleaningLog = require(path.join(BACKEND, 'models/CleaningLog'));

  const login = async (email, password) => (await api('POST', '/auth/login', { body: { email, password } })).json?.data?.token;
  const adminToken = await login('sarah.chen@hospital.com', 'admin123');
  const managerToken = await login('anuradha@hospital.com', 'manager123');
  const icuStaffToken = await login('staff.icu1@hospital.com', 'staff123');
  check('seeded admin, ICU manager and ICU staff can log in', Boolean(adminToken && managerToken && icuStaffToken));

  // ---- Ground truth straight from the collections ----
  const loadTruth = async () => ({
    beds: await Bed.find().lean(),
    logs: await OccupancyLog.find({ statusChange: { $in: ['assigned', 'released'] } }).sort({ timestamp: 1 }).lean(),
    cleanings: await CleaningLog.find({ status: 'completed' }).lean()
  });
  const staysReleasedBetween = ({ beds, logs }, from, to) => {
    const wardOf = new Map(beds.map((bed) => [bed._id.toString(), bed.ward]));
    const admittedAt = new Map();
    const stays = [];
    for (const log of logs) {
      const key = log.bedId.toString();
      if (log.statusChange === 'assigned') {
        admittedAt.set(key, log.timestamp);
      } else {
        if (admittedAt.has(key) && log.timestamp >= from && log.timestamp <= to) {
          stays.push({ ward: wardOf.get(key), hours: (log.timestamp - admittedAt.get(key)) / HOUR });
        }
        admittedAt.delete(key);
      }
    }
    return stays;
  };

  let truth = await loadTruth();
  const now0 = Date.now();
  const avgStayHours = {};
  const stays90 = staysReleasedBetween(truth, new Date(now0 - 90 * DAY), new Date(now0)).filter((stay) => stay.hours > 0 && stay.hours < 720);
  for (const ward of ['ICU', 'General', 'Emergency']) avgStayHours[ward] = average(stays90.filter((stay) => stay.ward === ward).map((stay) => stay.hours));
  const avgCleaningMinutes = {};
  const recentCleanings = truth.cleanings.filter((cleaning) => cleaning.actualDuration >= 1 && cleaning.actualDuration <= 480 && cleaning.endTime >= new Date(now0 - 90 * DAY));
  for (const ward of ['ICU', 'General', 'Emergency']) avgCleaningMinutes[ward] = average(recentCleanings.filter((cleaning) => cleaning.ward === ward).map((cleaning) => cleaning.actualDuration));
  const latestAssigned = new Map();
  truth.logs.filter((log) => log.statusChange === 'assigned').forEach((log) => latestAssigned.set(log.bedId.toString(), log.timestamp));
  const occupiedBeds = truth.beds.filter((bed) => bed.status === 'occupied');
  const countStatus = (status) => truth.beds.filter((bed) => bed.status === status).length;
  out(`  ward average stay (h): ${JSON.stringify(Object.fromEntries(Object.entries(avgStayHours).map(([w, h]) => [w, round1(h)])))}; average cleaning (min): ${JSON.stringify(Object.fromEntries(Object.entries(avgCleaningMinutes).map(([w, m]) => [w, round1(m)])))}`);

  // =====================================================================
  out('\n--- ML service unavailable: estimates come from recorded ward averages ---');
  let r = await api('GET', '/analytics/forecasting', { token: adminToken });
  let data = r.json?.data;
  check('forecasting returns 200', r.status === 200, r);
  check('current metrics match bed statuses (available excludes cleaning)',
    data.currentMetrics.totalBeds === truth.beds.length && data.currentMetrics.occupiedBeds === occupiedBeds.length &&
    data.currentMetrics.availableBeds === countStatus('available') && data.currentMetrics.cleaningBeds === countStatus('cleaning'),
    { api: data.currentMetrics, available: countStatus('available'), cleaning: countStatus('cleaning') });

  const stays30 = staysReleasedBetween(truth, new Date(Date.now() - 30 * DAY), new Date());
  check('average length of stay = stays that ended in the last 30 days (no 3.5-day default)',
    data.averageLengthOfStay.basedOnSamples === stays30.length && near(data.averageLengthOfStay.days, round1(average(stays30.map((stay) => stay.hours)) / 24), 0.051),
    { api: data.averageLengthOfStay, truth: { samples: stays30.length, days: average(stays30.map((stay) => stay.hours)) / 24 } });

  const estimates = data.aiDischarges.details;
  check('every occupied bed has an estimate (seed sets no manager times)',
    data.aiDischarges.total === occupiedBeds.length && data.manualDischarges.total === 0 && data.expectedDischarges.withoutEstimate === 0,
    { ai: data.aiDischarges.total, manual: data.manualDischarges.total, without: data.expectedDischarges.withoutEstimate, occupied: occupiedBeds.length });

  const nowMs = Date.now();
  const badEstimates = estimates.filter((estimate) => {
    const bed = occupiedBeds.find((b) => b.bedId === estimate.bedId);
    const admitted = latestAssigned.get(bed._id.toString());
    const expected = admitted.getTime() + avgStayHours[bed.ward] * HOUR;
    return estimate.source !== 'historical_average' ||
      new Date(estimate.admissionTime).getTime() !== admitted.getTime() ||
      Math.abs(new Date(estimate.expectedDischargeTime).getTime() - expected) > 60 * 1000 ||
      Math.abs(estimate.hoursUntilDischarge - Math.max(0, (expected - nowMs) / HOUR)) > 0.11 ||
      estimate.isOverdue !== (expected < nowMs);
  });
  check('each estimate = recorded admission time + ward average stay, with correct time remaining', badEstimates.length === 0, badEstimates.slice(0, 3));
  check('estimates sorted soonest first', estimates.every((estimate, i) => i === 0 || new Date(estimates[i - 1].expectedDischargeTime) <= new Date(estimate.expectedDischargeTime)));
  // details are capped at 100 beds, so the 72-hour truth is computed for every occupied bed
  const dueIn72h = occupiedBeds
    .map((bed) => latestAssigned.get(bed._id.toString()).getTime() + avgStayHours[bed.ward] * HOUR)
    .filter((time) => time < nowMs + 72 * HOUR).length;
  const bucketTotal = data.timeline.reduce((sum, bucket) => sum + bucket.expectedDischarges, 0);
  check('72-hour timeline counts every discharge due within 72 hours (overdue in the first bucket)',
    bucketTotal === dueIn72h && data.expectedDischarges.next72Hours === dueIn72h,
    { bucketTotal, next72Hours: data.expectedDischarges.next72Hours, dueIn72h });
  check('details list the soonest estimates (up to 100)', estimates.length === Math.min(100, occupiedBeds.length), estimates.length);
  check('24h count matches details', data.expectedDischarges.next24Hours === estimates.filter((estimate) => estimate.hoursUntilDischarge <= 24).length);

  r = await api('GET', '/analytics/forecasting', { token: managerToken });
  check('ICU manager forecast is limited to ICU',
    r.status === 200 && r.json.data.wardForecasts.length === 1 && r.json.data.wardForecasts[0].ward === 'ICU' &&
    r.json.data.currentMetrics.totalBeds === truth.beds.filter((bed) => bed.ward === 'ICU').length &&
    r.json.data.aiDischarges.details.every((estimate) => estimate.ward === 'ICU'),
    r.json?.data?.wardForecasts);

  const icuOccupied = occupiedBeds.filter((bed) => bed.ward === 'ICU');
  const probeBed = icuOccupied[0] || occupiedBeds[0];
  r = await api('POST', `/beds/${probeBed._id}/predict-discharge`, { token: managerToken });
  const discharge = r.json?.data?.prediction;
  const probeAdmitted = latestAssigned.get(probeBed._id.toString()).getTime();
  check('predict-discharge: recorded admission + ward average stay, time remaining from now',
    r.status === 200 && discharge.source === 'historical_average' &&
    new Date(discharge.admission_time).getTime() === probeAdmitted &&
    near(discharge.predicted_stay_hours, round1(avgStayHours[probeBed.ward]), 0.051) &&
    Math.abs(new Date(discharge.estimated_discharge_time) - (probeAdmitted + avgStayHours[probeBed.ward] * HOUR)) < 60 * 1000 &&
    near(discharge.hours_remaining, (probeAdmitted + avgStayHours[probeBed.ward] * HOUR - Date.now()) / HOUR, 0.11),
    { status: r.status, discharge, averageStay: avgStayHours[probeBed.ward] });
  const availableBed = truth.beds.find((bed) => bed.status === 'available');
  r = await api('POST', `/beds/${availableBed._id}/predict-discharge`, { token: managerToken });
  check('predict-discharge on a bed without a patient -> 400', r.status === 400, r);
  r = await api('POST', `/beds/${availableBed._id}/predict-cleaning`, { token: managerToken });
  check('predict-cleaning for a bed not being cleaned needs an estimate -> 400', r.status === 400, r);
  r = await api('POST', `/beds/${availableBed._id}/predict-cleaning`, { token: managerToken, body: { estimatedDuration: -5 } });
  check('predict-cleaning with a negative estimate -> 400', r.status === 400, r);
  r = await api('POST', `/beds/${availableBed._id}/predict-cleaning`, { token: managerToken, body: { estimatedDuration: 25 } });
  check('predict-cleaning with an explicit estimate -> 200', r.status === 200 && r.json.data.prediction.estimated_duration === 25, r);

  // =====================================================================
  out('\n--- Status changes are logged as real transitions ---');
  const tokens = [managerToken, icuStaffToken, adminToken];
  const patchStatus = async (bed, body) => {
    let response;
    for (const token of tokens) {
      response = await api('PATCH', `/beds/${bed._id}/status`, { token, body });
      if (response.status !== 403) return response;
    }
    return response;
  };
  const bedEvents = (bedId) => OccupancyLog.find({ bedId }).sort({ timestamp: 1, _id: 1 }).lean();
  const activeCleaning = (bedId) => CleaningLog.findOne({ bedId, status: 'in_progress' }).lean();

  const B1 = probeBed;
  const eventsBefore = (await bedEvents(B1._id)).length;

  r = await patchStatus(B1, { status: 'available' });
  let events = await bedEvents(B1._id);
  let bedDoc = await Bed.findById(B1._id).lean();
  let cleaningLog = await activeCleaning(B1._id);
  check('releasing a patient moves the bed to cleaning', r.status === 200 && r.json.data.bed.status === 'cleaning', r);
  check('release logged once as "released"', events.length === eventsBefore + 1 && events.at(-1).statusChange === 'released', events.slice(-2).map((e) => e.statusChange));
  check('no duration given -> cleaning estimate is the ward average cleaning time (not 30)',
    bedDoc.estimatedCleaningDuration === Math.round(avgCleaningMinutes[B1.ward]) && cleaningLog?.estimatedDuration === Math.round(avgCleaningMinutes[B1.ward]),
    { bed: bedDoc.estimatedCleaningDuration, log: cleaningLog?.estimatedDuration, average: avgCleaningMinutes[B1.ward] });

  r = await api('POST', `/beds/${B1._id}/predict-cleaning`, { token: managerToken });
  let cleaning = r.json?.data?.prediction;
  check('predict-cleaning uses the bed\'s recorded start and estimate (ward average without ML)',
    r.status === 200 && cleaning.source === 'historical_average' &&
    new Date(cleaning.start_time).getTime() === new Date(bedDoc.cleaningStartTime).getTime() &&
    cleaning.estimated_duration === bedDoc.estimatedCleaningDuration &&
    near(cleaning.predicted_duration_minutes, round1(avgCleaningMinutes[B1.ward]), 0.051),
    { status: r.status, cleaning });

  r = await patchStatus(B1, { status: 'available' });
  events = await bedEvents(B1._id);
  const finishedCleaning = await CleaningLog.findById(cleaningLog._id).lean();
  check('finishing cleaning via status update logged as "maintenance_end"',
    r.status === 200 && r.json.data.bed.status === 'available' && events.length === eventsBefore + 2 && events.at(-1).statusChange === 'maintenance_end',
    { status: r.status, events: events.slice(-2).map((e) => e.statusChange) });
  check('...and its cleaning log is completed', finishedCleaning.status === 'completed' && finishedCleaning.endTime && finishedCleaning.completedBy, finishedCleaning);

  r = await patchStatus(B1, { status: 'cleaning', cleaningDuration: 20 });
  events = await bedEvents(B1._id);
  cleaningLog = await activeCleaning(B1._id);
  check('sending an available bed for cleaning logged as "maintenance_start" with the given duration',
    r.status === 200 && events.length === eventsBefore + 3 && events.at(-1).statusChange === 'maintenance_start' && cleaningLog?.estimatedDuration === 20,
    { status: r.status, last: events.at(-1).statusChange, cleaningLog });

  r = await patchStatus(B1, { status: 'occupied', patientName: 'Test Patient' });
  events = await bedEvents(B1._id);
  const secondCleaning = await CleaningLog.findById(cleaningLog._id).lean();
  check('assigning a patient to a bed being cleaned logged as "assigned" and completes the cleaning log',
    r.status === 200 && events.length === eventsBefore + 4 && events.at(-1).statusChange === 'assigned' && secondCleaning.status === 'completed',
    { status: r.status, last: events.at(-1).statusChange, cleaning: secondCleaning.status });

  r = await patchStatus(B1, { status: 'occupied', patientName: 'Renamed Patient' });
  events = await bedEvents(B1._id);
  check('updating an occupied bed without changing status adds no log (was a duplicate "assigned")',
    r.status === 200 && events.length === eventsBefore + 4, { status: r.status, newEvents: events.length - eventsBefore });

  const B2 = icuOccupied.find((bed) => bed._id.toString() !== B1._id.toString()) || occupiedBeds.find((bed) => bed._id.toString() !== B1._id.toString());
  r = await patchStatus(B2, { status: 'available' });
  check('second bed released (left in cleaning for the ML check)', r.status === 200 && r.json.data.bed.status === 'cleaning', r);

  truth = await loadTruth();
  const occupiedNow = truth.beds.filter((bed) => bed.status === 'occupied').length;
  let walk = occupiedNow;
  let outOfRange = 0;
  for (let i = truth.logs.length - 1; i >= 0; i--) {
    walk -= truth.logs[i].statusChange === 'assigned' ? 1 : -1;
    if (walk < 0 || walk > truth.beds.length) outOfRange++;
  }
  check('occupancy history still reconstructs cleanly after the changes', outOfRange === 0 && walk === 0, { outOfRange, walk });

  // =====================================================================
  out('\n--- Summary metrics from recorded history ---');
  r = await api('GET', '/analytics/occupancy-summary', { token: adminToken });
  const weekAgo = Date.now() - 7 * DAY;
  const occupiedWeekAgo = occupiedNow - truth.logs.filter((log) => log.timestamp.getTime() >= weekAgo).reduce((sum, log) => sum + (log.statusChange === 'assigned' ? 1 : -1), 0);
  const rateChange = Math.round((occupiedNow / truth.beds.length) * 100) - Math.round((occupiedWeekAgo / truth.beds.length) * 100);
  check('week-over-week occupied and occupancy-rate change = now vs 7 days ago',
    r.status === 200 && r.json.occupiedBeds === occupiedNow && r.json.weekOverWeek.occupiedChange === occupiedNow - occupiedWeekAgo &&
    r.json.weekOverWeek.occupancyRateChange === `${rateChange >= 0 ? '+' : ''}${rateChange}%`,
    { api: r.json?.weekOverWeek, truth: { occupiedChange: occupiedNow - occupiedWeekAgo, rateChange } });
  check('bed count change comes from when beds were added/retired (none here); available change stays unknown (null)', r.json.weekOverWeek.totalBedsChange === 0 && r.json.weekOverWeek.availableChange === null, r.json?.weekOverWeek);

  const turnaroundTruth = (ward) => {
    const wardBedIds = new Set(truth.beds.filter((bed) => bed.ward === ward).map((bed) => bed._id.toString()));
    const from = Date.now() - 7 * DAY;
    const byBed = new Map();
    truth.logs.filter((log) => wardBedIds.has(log.bedId.toString())).forEach((log) => {
      const key = log.bedId.toString();
      if (!byBed.has(key)) byBed.set(key, []);
      byBed.get(key).push(log);
    });
    const hours = [];
    for (const list of byBed.values()) {
      for (let i = 0; i < list.length - 1; i++) {
        if (list[i].statusChange === 'released' && list[i].timestamp.getTime() >= from && list[i + 1].statusChange === 'assigned') {
          hours.push((list[i + 1].timestamp - list[i].timestamp) / HOUR);
        }
      }
    }
    return hours.length ? round1(average(hours)) : null;
  };
  r = await api('GET', '/analytics/ward-utilization', { token: adminToken });
  const utilization = r.json?.data?.utilization || [];
  check('ward utilization reports cleaning beds and real turnaround times (was always 0)',
    r.status === 200 && utilization.length === 3 && utilization.every((ward) =>
      'cleaning' in ward.currentStatus && !('maintenance' in ward.currentStatus) &&
      near(ward.last7Days.avgTurnAroundTimeHours, turnaroundTruth(ward.ward), 0.051)),
    utilization.map((ward) => ({ ward: ward.ward, status: ward.currentStatus, api: ward.last7Days.avgTurnAroundTimeHours, truth: turnaroundTruth(ward.ward) })));

  r = await api('GET', '/analytics/occupancy-timeline?range=7days', { token: adminToken });
  check('occupancy timeline still works', r.status === 200 && r.json.data.periods.length === 7 && r.json.data.periods.every((period) => period.averageOccupancy !== null), r.json?.data?.periods?.map((period) => period.averageOccupancy));

  // =====================================================================
  out('\n--- ML service without database history ---');
  startMl(ML_NO_DB_PORT, 'mongodb://127.0.0.1:1/unreachable');
  const mlNoDb = mlApi(ML_NO_DB_PORT);
  let noDbHealthy = false;
  for (let i = 0; i < 60 && !noDbHealthy; i++) {
    await sleep(1000);
    try { noDbHealthy = (await mlNoDb('GET', '/health')).status === 200; } catch {}
  }
  if (noDbHealthy) {
    const results = await Promise.all([
      mlNoDb('POST', '/api/ml/predict/discharge', { body: { ward: 'ICU' } }),
      mlNoDb('POST', '/api/ml/predict/cleaning-duration', { body: { ward: 'ICU', estimated_duration: 30 } }),
      mlNoDb('POST', '/api/ml/predict/bed-availability', { body: { ward: 'ICU', bed_status: 'occupied' } })
    ]);
    check('without history the ML service returns 503 for all predictions instead of hardcoded defaults', results.every((result) => result.status === 503), results.map((result) => [result.status, result.json?.detail]));
  } else {
    check('ML service (no database) started', false, children[0].output.slice(-1500));
  }

  // =====================================================================
  out('\n--- ML service running: predictions come from the models ---');
  const mlProcess = startMl(ML_PORT, uri);
  const ml = mlApi(ML_PORT);
  let mlReady = false;
  for (let i = 0; i < 120 && !mlReady; i++) {
    await sleep(1000);
    try { mlReady = (await ml('POST', '/api/ml/predict/discharge', { body: { ward: 'ICU', admission_time: new Date().toISOString() } })).status === 200; } catch {}
  }
  check('ML service started and loaded history from the database', mlReady, mlProcess.output.slice(-1500));

  if (mlReady) {
    r = await api('GET', '/analytics/forecasting', { token: adminToken });
    const mlEstimates = r.json?.data?.aiDischarges?.details || [];
    check('forecast estimates now come from the ML model', r.status === 200 && mlEstimates.length > 0 && mlEstimates.every((estimate) => estimate.source === 'ml'), mlEstimates.slice(0, 2));
    const mismatches = [];
    for (const estimate of mlEstimates.slice(0, 5)) {
      const direct = await ml('POST', '/api/ml/predict/discharge', { body: { ward: estimate.ward, admission_time: estimate.admissionTime } });
      const expected = new Date(estimate.admissionTime).getTime() + direct.json.prediction.hours_until_discharge * HOUR;
      if (Math.abs(new Date(estimate.expectedDischargeTime).getTime() - expected) > 60 * 1000) {
        mismatches.push({ bed: estimate.bedId, api: estimate.expectedDischargeTime, expected: new Date(expected) });
      }
    }
    check('ML estimates = recorded admission time + model-predicted stay', mismatches.length === 0, mismatches);

    const b2 = await Bed.findById(B2._id).lean();
    r = await api('POST', `/beds/${B2._id}/predict-cleaning`, { token: managerToken });
    cleaning = r.json?.data?.prediction;
    const directCleaning = await ml('POST', '/api/ml/predict/cleaning-duration', {
      body: { ward: b2.ward, estimated_duration: b2.estimatedCleaningDuration, start_time: new Date(b2.cleaningStartTime).toISOString() }
    });
    check('cleaning estimate from the ML model uses the bed\'s recorded start and estimate',
      r.status === 200 && cleaning.source === 'ml' && near(cleaning.predicted_duration_minutes, round1(directCleaning.json.prediction.predicted_duration_minutes), 0.051),
      { cleaning, direct: directCleaning.json?.prediction });

    r = await ml('POST', '/api/ml/predict/cleaning-duration', { body: { ward: 'ICU' } });
    check('ML cleaning prediction requires estimated_duration (422)', r.status === 422, r.status);
    const occupiedAvailability = await ml('POST', '/api/ml/predict/bed-availability', { body: { ward: 'ICU', bed_status: 'occupied' } });
    const availableAvailability = await ml('POST', '/api/ml/predict/bed-availability', { body: { ward: 'ICU', bed_status: 'available' } });
    check('bed availability uses the bed status and recorded history',
      occupiedAvailability.status === 200 && occupiedAvailability.json.metadata.history_samples > 0 &&
      occupiedAvailability.json.metadata.bed_status === 'occupied' && occupiedAvailability.json.prediction.prediction_horizon_hours === 6,
      occupiedAvailability.json);
    out(`  availability probability (ICU, 6h): occupied ${occupiedAvailability.json?.prediction?.probability}, available ${availableAvailability.json?.prediction?.probability}`);
    r = await ml('POST', '/api/ml/predict/bed-availability', { body: { ward: 'ICU' } });
    check('bed availability without bed_status -> 422', r.status === 422, r.status);
    r = await ml('POST', '/api/ml/predict/discharge', { body: { ward: 'General', admission_time: new Date().toISOString() } });
    check('discharge metadata reports history samples (no "defaults" source)', r.status === 200 && r.json.metadata.history_samples > 0 && !('history_source' in r.json.metadata), r.json?.metadata);
  }

  out(`\n${pass} passed, ${fail} failed`);
  if (fail > 0 && serverErrors.length > 0) out('Server errors:\n' + serverErrors.slice(-15).join('\n'));
  children.forEach((child) => child.kill());
  await mongod.stop();
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  process.stdout.write(String(error.stack || error) + '\n');
  process.exit(1);
});
