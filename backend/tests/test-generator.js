// Checks that generateSyntheticData.js produces internally consistent data.
// Runs seedBeds.js + generateSyntheticData.js against an in-memory MongoDB (never the real database).
const path = require('path');
const { execFile } = require('child_process');

const BACKEND = process.env.BACKEND_DIR || path.join(__dirname, '..');
const HERE = __dirname;
const { MongoMemoryServer } = require('mongodb-memory-server');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' - ' + JSON.stringify(detail).slice(0, 600)}`);
  ok ? pass++ : fail++;
};
const pushTo = (map, key, value) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('bedmanager_seedtest');
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error(`Refusing to seed ${uri}`);

  // Run from this folder so dotenv finds no .env file: MONGO_URI only comes from here.
  // Asynchronous, so this process keeps reading mongod's output (an unread pipe stalls mongod)
  const run = (script) => new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(BACKEND, script)], {
      cwd: HERE,
      env: { ...process.env, MONGO_URI: uri },
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024
    }, (error, stdout, stderr) => (error ? reject(new Error(`${script} failed: ${error.message}\n${stdout}\n${stderr}`)) : resolve(stdout)));
  });
  await run('seedBeds.js');

  // An account created through sign-up (not a seed account) must survive re-seeding
  const { MongoClient } = require('mongodb');
  const client = await MongoClient.connect(uri);
  await client.db().collection('users').insertOne({
    name: 'Signed Up Nurse', email: 'signed.up@hospital.com', role: 'ward_staff', ward: 'ICU',
    status: 'approved', password: 'not-a-real-hash', createdAt: new Date(), updatedAt: new Date()
  });
  await client.close();

  const startedAt = Date.now();
  const output = await run('generateSyntheticData.js');
  console.log(output.split('\n').filter((line) => /✔|🎉/.test(line)).join('\n'));
  console.log(`(generator ran in ${((Date.now() - startedAt) / 1000).toFixed(1)}s)\n`);
  check('generator used the in-memory database', output.includes('(bedmanager_seedtest)'));

  const mongoose = require(path.join(BACKEND, 'node_modules/mongoose'));
  await mongoose.connect(uri);
  const Bed = require(path.join(BACKEND, 'models/Bed'));
  const OccupancyLog = require(path.join(BACKEND, 'models/OccupancyLog'));
  const CleaningLog = require(path.join(BACKEND, 'models/CleaningLog'));
  const EmergencyRequest = require(path.join(BACKEND, 'models/EmergencyRequest'));
  const Alert = require(path.join(BACKEND, 'models/Alert'));
  const history = require(path.join(BACKEND, 'services/occupancyHistory'));

  const now = new Date();
  const beds = await Bed.find().lean();
  const logs = await OccupancyLog.find().sort({ timestamp: 1 }).lean();
  const cleanings = await CleaningLog.find().sort({ startTime: 1 }).lean();
  const totalBeds = beds.length;

  // ---- Accounts ----
  const User = require(path.join(BACKEND, 'models/User'));
  const users = await User.find().lean();
  const seedUsers = users.filter((user) => user.email !== 'signed.up@hospital.com');
  const seedUserIds = new Set(seedUsers.map((user) => user._id.toString()));
  check('account created through sign-up is kept', users.some((user) => user.email === 'signed.up@hospital.com'));
  check('17 seed accounts recreated, all approved', seedUsers.length === 17 && seedUsers.every((user) => user.status === 'approved'), seedUsers.length);
  check('generated logs are attributed to seed accounts only', logs.every((log) => seedUserIds.has(log.userId.toString())));

  const logsByBed = new Map();
  const cleaningsByBed = new Map();
  logs.forEach((log) => pushTo(logsByBed, log.bedId.toString(), log));
  cleanings.forEach((cleaning) => pushTo(cleaningsByBed, cleaning.bedId.toString(), cleaning));

  // ---- Per-bed consistency ----
  const NEXT = { assigned: 'released', released: 'maintenance_end', maintenance_end: 'assigned' };
  const STATUS_AFTER = { assigned: 'occupied', released: 'cleaning', maintenance_end: 'available' };
  const problems = { order: [], future: [], status: [], cleaning: [], fields: [] };

  for (const bed of beds) {
    const id = bed._id.toString();
    const events = logsByBed.get(id) || [];
    const bedCleanings = cleaningsByBed.get(id) || [];
    const last = events[events.length - 1];

    if (events.length === 0 || events[0].statusChange !== 'assigned') {
      problems.order.push(`${bed.bedId}: first event ${events[0]?.statusChange}`);
    }
    for (let i = 1; i < events.length; i++) {
      if (events[i].statusChange !== NEXT[events[i - 1].statusChange] || events[i].timestamp < events[i - 1].timestamp) {
        problems.order.push(`${bed.bedId}: ${events[i - 1].statusChange} -> ${events[i].statusChange}`);
      }
    }
    if (events.some((event) => event.timestamp > now)) problems.future.push(bed.bedId);
    if (last && STATUS_AFTER[last.statusChange] !== bed.status) {
      problems.status.push(`${bed.bedId}: status ${bed.status}, last event ${last.statusChange}`);
    }

    const releases = events.filter((event) => event.statusChange === 'released');
    const cleaningEnds = events.filter((event) => event.statusChange === 'maintenance_end');
    if (bedCleanings.length !== releases.length) {
      problems.cleaning.push(`${bed.bedId}: ${bedCleanings.length} cleanings for ${releases.length} releases`);
    }
    bedCleanings.forEach((cleaning, i) => {
      if (!releases[i] || cleaning.startTime.getTime() !== releases[i].timestamp.getTime()) {
        problems.cleaning.push(`${bed.bedId}: cleaning ${i} does not start at a release`);
      }
      if (cleaning.status === 'completed') {
        if (!cleaningEnds[i] || cleaning.endTime.getTime() !== cleaningEnds[i].timestamp.getTime()) {
          problems.cleaning.push(`${bed.bedId}: cleaning ${i} end does not match maintenance_end`);
        }
        if (Math.round((cleaning.endTime - cleaning.startTime) / 60000) !== cleaning.actualDuration) {
          problems.cleaning.push(`${bed.bedId}: cleaning ${i} actualDuration mismatch`);
        }
      } else if (!(cleaning.status === 'in_progress' && i === bedCleanings.length - 1 && bed.status === 'cleaning' && cleaning.endTime === null)) {
        problems.cleaning.push(`${bed.bedId}: unexpected ${cleaning.status} cleaning ${i}`);
      }
    });

    if (bed.status === 'occupied' && !(bed.patientName && bed.patientId)) problems.fields.push(`${bed.bedId}: occupied without patient`);
    if (bed.status !== 'occupied' && (bed.patientName || bed.patientId)) problems.fields.push(`${bed.bedId}: patient on ${bed.status} bed`);
    if (bed.estimatedDischargeTime) problems.fields.push(`${bed.bedId}: invented discharge time`);
    if (bed.status === 'cleaning' && bed.cleaningStartTime?.getTime() !== last?.timestamp.getTime()) problems.fields.push(`${bed.bedId}: cleaning start mismatch`);
    if (bed.status !== 'cleaning' && bed.cleaningStartTime) problems.fields.push(`${bed.bedId}: stale cleaning fields`);
  }

  const statusCounts = beds.reduce((counts, bed) => ({ ...counts, [bed.status]: (counts[bed.status] || 0) + 1 }), {});
  console.log(`Beds: ${totalBeds} ${JSON.stringify(statusCounts)}; ${logs.length} occupancy logs; ${cleanings.length} cleaning logs`);
  check('events follow assigned -> released -> maintenance_end for every bed', problems.order.length === 0, problems.order);
  check('no timestamps in the future', problems.future.length === 0, problems.future);
  check('each bed status matches its last event', problems.status.length === 0, problems.status);
  check('one cleaning log per release with matching times', problems.cleaning.length === 0, problems.cleaning);
  check('bed fields consistent with status (no invented discharge times)', problems.fields.length === 0, problems.fields);

  // ---- Walking back from current statuses (what the reports do) ----
  let occupied = beds.filter((bed) => bed.status === 'occupied').length;
  let outOfRange = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    occupied -= { assigned: 1, released: -1 }[logs[i].statusChange] || 0;
    if (occupied < 0 || occupied > totalBeds) outOfRange++;
  }
  check('walk-back occupancy never leaves [0, total beds]', outOfRange === 0, { outOfRange });
  check('walk-back reaches 0 before the first admission', occupied === 0, { occupied });

  // ---- Timeline vs exact occupancy from each bed's stays ----
  const stays = [];
  for (const events of logsByBed.values()) {
    let admittedAt = null;
    events.forEach((event) => {
      if (event.statusChange === 'assigned') admittedAt = event.timestamp;
      if (event.statusChange === 'released') {
        stays.push([admittedAt.getTime(), event.timestamp.getTime()]);
        admittedAt = null;
      }
    });
    if (admittedAt) stays.push([admittedAt.getTime(), now.getTime()]);
  }
  const exactAverage = (start, end) => {
    const occupiedMs = stays.reduce((sum, [from, to]) => sum + Math.max(0, Math.min(to, end) - Math.max(from, start)), 0);
    return Math.round((occupiedMs / ((end - start) * totalBeds)) * 1000) / 10;
  };

  const scopeBeds = await history.getBedsInScope();
  for (const [label, days, count] of [['7-day', 7, 7], ['30-day', 30, 6], ['90-day', 90, 9]]) {
    const start = new Date(now.getTime() - days * DAY);
    const { points, historyStart } = await history.buildOccupancyPoints(scopeBeds, start, now);
    const periods = history.summarizeOccupancy(points, history.splitPeriods(start, now, count), totalBeds, historyStart);
    const averages = periods.map((period) => period.averageOccupancy);
    const expected = periods.map((period) => exactAverage(Math.max(period.start.getTime(), historyStart.getTime()), period.end.getTime()));
    const maxDiff = Math.max(...averages.map((value, i) => Math.abs(value - expected[i])));
    console.log(`  ${label}: avg ${averages.join(' / ')} | peak ${periods.map((p) => p.peakOccupancy).join(' / ')} | history since ${historyStart.toISOString().slice(0, 10)}`);
    check(`${label} timeline matches exact occupancy (max diff ${maxDiff.toFixed(2)})`, maxDiff <= 0.2, { averages, expected });
    check(`${label} timeline has no gaps or 100% plateaus`, averages.every((value) => value > 40 && value < 95), averages);
  }

  // ---- Stay and cleaning statistics the ML service derives ----
  const wardOf = new Map(beds.map((bed) => [bed._id.toString(), bed.ward]));
  const staysByWard = {};
  for (const [bedId, events] of logsByBed) {
    let admittedAt = null;
    events.forEach((event) => {
      if (event.statusChange === 'assigned') admittedAt = event.timestamp;
      if (event.statusChange === 'released') {
        (staysByWard[wardOf.get(bedId)] ||= []).push((event.timestamp - admittedAt) / HOUR);
      }
    });
  }
  const ranges = { ICU: [72, 168], General: [48, 120], Emergency: [24, 72] };
  const stayAverages = Object.fromEntries(Object.entries(staysByWard).map(([ward, hours]) => [ward, Math.round(hours.reduce((a, b) => a + b, 0) / hours.length)]));
  console.log(`  average stay (h): ${JSON.stringify(stayAverages)}`);
  check('average stay per ward inside its configured range', Object.entries(stayAverages).every(([ward, hours]) => hours > ranges[ward][0] && hours < ranges[ward][1]), stayAverages);
  const completed = cleanings.filter((cleaning) => cleaning.status === 'completed');
  check('completed cleanings have durations between 15 and 45 minutes', completed.every((cleaning) => cleaning.actualDuration >= 15 && cleaning.actualDuration <= 45));

  // ---- Requests and alerts ----
  const requests = await EmergencyRequest.find().lean();
  const alerts = await Alert.find().lean();
  const pending = requests.filter((request) => request.status === 'pending');
  check('requests were created within the last 72 hours', requests.every((request) => request.createdAt <= now && now - request.createdAt <= 73 * HOUR));
  check('only recent requests (<= 6h) are still pending', pending.every((request) => now - request.createdAt <= 6 * HOUR + 60000));
  const pendingAlerts = alerts.filter((alert) => alert.type === 'request_pending');
  check('one pending-request alert per pending request', pendingAlerts.length === pending.length && pendingAlerts.every((alert) => pending.some((request) => request._id.equals(alert.relatedRequest))), { alerts: pendingAlerts.length, pending: pending.length });
  const wardsOver90 = ['ICU', 'General', 'Emergency'].filter((ward) => {
    const wardBeds = beds.filter((bed) => bed.ward === ward);
    return wardBeds.length > 0 && (wardBeds.filter((bed) => bed.status === 'occupied').length / wardBeds.length) * 100 > 90;
  });
  const occupancyAlertWards = alerts.filter((alert) => alert.type === 'occupancy_high').map((alert) => alert.ward).sort();
  check('occupancy alerts exactly for wards above 90%', JSON.stringify(occupancyAlertWards) === JSON.stringify(wardsOver90.sort()), { occupancyAlertWards, wardsOver90 });
  check('no other alert types', alerts.every((alert) => ['request_pending', 'occupancy_high'].includes(alert.type)));

  console.log(`\n${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
