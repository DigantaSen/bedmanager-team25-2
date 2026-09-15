// End-to-end checks for Socket.IO: that clients can no longer make the server broadcast
// anything, and that real-time events reach only the roles allowed to see their contents
// (in-memory MongoDB, never the real database)
const path = require('path');
const { execFile } = require('child_process');

const BACKEND = process.env.BACKEND_DIR || path.join(__dirname, '..');
const HERE = __dirname;
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io: ioClient } = require(path.join(BACKEND, 'node_modules/socket.io-client'));

const PORT = 5090;
const BASE = `http://127.0.0.1:${PORT}/api`;
const SOCKET_URL = `http://127.0.0.1:${PORT}`;

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

// A connected client that records every event it is sent
const connect = (name, token) => new Promise((resolve, reject) => {
  const socket = ioClient(SOCKET_URL, { auth: { token }, transports: ['websocket'], reconnection: false });
  const received = [];
  socket.onAny((event, payload) => received.push({ event, payload }));
  socket.on('connect', () => resolve({ name, socket, received }));
  socket.on('connect_error', (error) => reject(new Error(`${name}: ${error.message}`)));
  setTimeout(() => reject(new Error(`${name}: timed out connecting`)), 8000);
});

const refused = (token) => new Promise((resolve) => {
  const socket = ioClient(SOCKET_URL, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false });
  socket.on('connect', () => { socket.close(); resolve(null); });
  socket.on('connect_error', (error) => { socket.close(); resolve(error.message); });
  setTimeout(() => { socket.close(); resolve('timeout'); }, 8000);
});

const eventsFor = (client, event) => client.received.filter((entry) => entry.event === event);
const clear = (clients) => clients.forEach((client) => { client.received.length = 0; });

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('bedmanager_sockettest');
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error(`Refusing to use ${uri}`);

  const runScript = (script) => new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(BACKEND, script)], { cwd: HERE, env: { ...process.env, MONGO_URI: uri }, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => (error ? reject(new Error(`${script} failed: ${error.message}\n${stdout}\n${stderr}`)) : resolve(stdout)));
  });
  await runScript('seedBeds.js');
  await runScript('generateSyntheticData.js');

  Object.assign(process.env, { MONGO_URI: uri, JWT_SECRET: 'x'.repeat(64), PORT: String(PORT), NODE_ENV: 'test', ML_SERVICE_URL: 'http://127.0.0.1:1' });

  // Capture the server's own logs so a leaked token would be visible
  const serverLogs = [];
  const realLog = console.log;
  console.log = (...args) => serverLogs.push(args.map(String).join(' '));
  console.warn = () => {};
  console.error = (...args) => serverLogs.push(args.map(String).join(' '));

  require(path.join(BACKEND, 'server.js'));
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) break; } catch {}
    await sleep(200);
  }

  const tokenOf = async (email, password) => (await api('POST', '/auth/login', { body: { email, password } })).json?.data?.token;
  const tokens = {
    admin: await tokenOf('sarah.chen@hospital.com', 'admin123'),
    manager: await tokenOf('anuradha@hospital.com', 'manager123'),      // ICU
    icuStaff: await tokenOf('staff.icu1@hospital.com', 'staff123'),
    generalStaff: await tokenOf('staff.general1@hospital.com', 'staff123'),
    er1: await tokenOf('er.staff1@hospital.com', 'erstaff123'),
    er2: await tokenOf('er.staff2@hospital.com', 'erstaff123'),
    tech: await tokenOf('admin@hospital.com', 'admin123')
  };
  check('every role logs in', Object.values(tokens).every(Boolean), Object.keys(tokens).filter((k) => !tokens[k]));

  // ---- Connecting ----
  out('\n--- Connecting ---');
  check('a socket without a token is refused', (await refused(null))?.includes('Authentication error'), await refused(null));
  check('a socket with a rubbish token is refused', (await refused('not-a-token'))?.includes('Authentication error'));

  const clients = {};
  for (const [name, token] of Object.entries(tokens)) clients[name] = await connect(name, token);
  const all = Object.values(clients);
  check('every role connects with a valid token', all.length === 7);

  const tokenInLogs = serverLogs.filter((line) => Object.values(tokens).some((token) => token && line.includes(token.slice(0, 25))));
  check('no token appears in the server log', tokenInLogs.length === 0, tokenInLogs.slice(0, 2));

  // ---- Clients can no longer make the server broadcast ----
  out('\n--- Events a client tries to inject ---');
  clear(all);
  clients.icuStaff.socket.emit('bedStatusUpdate', { bed: { _id: 'fake', bedId: 'FAKE-1', ward: 'ICU', status: 'available', patientName: 'Injected Patient' } });
  clients.icuStaff.socket.emit('occupancyLogUpdate', { bedId: 'fake', statusChange: 'released' });
  clients.icuStaff.socket.emit('message', 'hello everyone');
  clients.tech.socket.emit('bedStatusUpdate', { bed: { _id: 'fake2', bedId: 'FAKE-2', ward: 'ICU', status: 'occupied', patientName: 'Also Injected' } });
  await sleep(600);

  const injected = all.flatMap((client) => client.received.map((entry) => ({ to: client.name, event: entry.event })));
  check('a client emitting bedStatusUpdate causes no broadcast', injected.filter((e) => e.event === 'bedStatusChanged').length === 0, injected);
  check('a client emitting occupancyLogUpdate causes no broadcast', injected.filter((e) => e.event === 'occupancyLogChanged').length === 0, injected);
  check('a client emitting message causes no broadcast', injected.filter((e) => e.event === 'newMessage').length === 0, injected);
  check('no invented bed reached anyone', !JSON.stringify(injected).includes('Injected'), injected);

  // ---- A real bed change ----
  out('\n--- A real bed status change (ICU) ---');
  const beds = await api('GET', '/beds?ward=ICU&status=available', { token: tokens.manager });
  const bed = beds.json?.data?.beds?.[0];
  check('found an available ICU bed to use', Boolean(bed), beds.status);

  clear(all);
  const assigned = await api('PATCH', `/beds/${bed._id}/status`, {
    token: tokens.icuStaff,
    body: { status: 'occupied', patientName: 'Socket Test Patient', patientId: null, notes: 'Private note' }
  });
  check('ward staff assigned the bed (200)', assigned.status === 200, assigned.json?.message);
  await sleep(600);

  const statusEvents = Object.fromEntries(all.map((client) => [client.name, eventsFor(client, 'bedStatusChanged')]));
  const payloadFor = (name) => statusEvents[name][0]?.payload?.bed || {};

  check('the ward\'s own staff are told', statusEvents.icuStaff.length === 1, statusEvents.icuStaff.length);
  check('...with the patient name', payloadFor('icuStaff').patientName === 'Socket Test Patient', payloadFor('icuStaff').patientName);
  check('the ward\'s manager is told, with the patient name', statusEvents.manager.length === 1 && payloadFor('manager').patientName === 'Socket Test Patient', payloadFor('manager'));
  check('the hospital admin is told, with the patient name', statusEvents.admin.length === 1 && payloadFor('admin').patientName === 'Socket Test Patient', payloadFor('admin'));

  check('ER staff are told the bed changed', statusEvents.er1.length === 1, statusEvents.er1.length);
  check('...but without the patient name or notes', payloadFor('er1').patientName === undefined && payloadFor('er1').notes === undefined, payloadFor('er1'));
  check('the technical team is told, without patient details', statusEvents.tech.length === 1 && payloadFor('tech').patientName === undefined, payloadFor('tech'));
  check('staff of another ward are not told at all', statusEvents.generalStaff.length === 0, statusEvents.generalStaff.length);

  const everyPayload = JSON.stringify(all.flatMap((client) => (client.name === 'icuStaff' || client.name === 'manager' || client.name === 'admin') ? [] : client.received));
  check('no unauthorised client received the private note', !everyPayload.includes('Private note'));

  // ---- An emergency request ----
  out('\n--- An emergency request (ICU) ---');
  clear(all);
  const created = await api('POST', '/emergency-requests', {
    token: tokens.er1,
    body: { patientName: 'Socket Request Patient', location: 'ER Bay 4', ward: 'ICU', priority: 'high' }
  });
  check('ER staff raised the request (201)', created.status === 201, created.json?.message);
  const requestId = created.json?.data?.emergencyRequest?._id;
  await sleep(600);

  const requestEvents = Object.fromEntries(all.map((client) => [client.name, eventsFor(client, 'emergencyRequestCreated')]));
  check('the ward\'s manager is notified', requestEvents.manager.length === 1, requestEvents.manager.length);
  check('the hospital admin is notified', requestEvents.admin.length === 1, requestEvents.admin.length);
  check('the ER user who raised it is notified', requestEvents.er1.length === 1, requestEvents.er1.length);
  check('another ER user is not notified', requestEvents.er2.length === 0, requestEvents.er2.length);
  check('ward staff are not notified', requestEvents.icuStaff.length === 0 && requestEvents.generalStaff.length === 0,
    [requestEvents.icuStaff.length, requestEvents.generalStaff.length]);
  check('the technical team is not notified', requestEvents.tech.length === 0, requestEvents.tech.length);

  const alertEvents = Object.fromEntries(all.map((client) => [client.name, eventsFor(client, 'alertCreated')]));
  check('the alert reaches the ward manager and admin only',
    alertEvents.manager.length === 1 && alertEvents.admin.length === 1 &&
    alertEvents.icuStaff.length === 0 && alertEvents.er1.length === 0 && alertEvents.tech.length === 0,
    Object.fromEntries(Object.entries(alertEvents).map(([k, v]) => [k, v.length])));
  const unauthorisedAlerts = JSON.stringify([clients.icuStaff, clients.generalStaff, clients.er2, clients.tech].flatMap((c) => c.received));
  check('the patient name is not in anyone else\'s events', !unauthorisedAlerts.includes('Socket Request Patient'));

  // ---- Approving it ----
  out('\n--- Approving the request ---');
  clear(all);
  const approved = await api('PATCH', `/emergency-requests/${requestId}/approve`, { token: tokens.manager, body: {} });
  check('the manager approved it (200)', approved.status === 200, approved.json?.message);
  await sleep(600);

  const approvedEvents = Object.fromEntries(all.map((client) => [client.name, eventsFor(client, 'emergencyRequestApproved')]));
  check('the requester learns the outcome', approvedEvents.er1.length === 1, approvedEvents.er1.length);
  check('the manager and admin learn the outcome', approvedEvents.manager.length === 1 && approvedEvents.admin.length === 1,
    [approvedEvents.manager.length, approvedEvents.admin.length]);
  check('it is not broadcast to everyone else',
    approvedEvents.er2.length === 0 && approvedEvents.icuStaff.length === 0 && approvedEvents.generalStaff.length === 0 && approvedEvents.tech.length === 0,
    Object.fromEntries(Object.entries(approvedEvents).map(([k, v]) => [k, v.length])));

  all.forEach((client) => client.socket.close());
  console.log = realLog;
  out(`\n${pass} passed, ${fail} failed`);
  await mongod.stop();
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  process.stdout.write(String(error.stack || error) + '\n');
  process.exit(1);
});
