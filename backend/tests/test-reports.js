// End-to-end checks for report permissions and input handling: who may generate, email,
// download and schedule reports, where report emails may be sent, and what the PDF
// generator does with hostile input (in-memory MongoDB, never the real database)
const path = require('path');
const { execFile } = require('child_process');

const BACKEND = process.env.BACKEND_DIR || path.join(__dirname, '..');
const HERE = __dirname;
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = 5094;
const BASE = `http://127.0.0.1:${PORT}/api`;

const out = (...args) => process.stdout.write(args.join(' ') + '\n');
let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  out(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' - ' + JSON.stringify(detail).slice(0, 400)}`);
  ok ? pass++ : fail++;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const api = async (method, route, { token, body, raw } = {}) => {
  const res = await fetch(BASE + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    ...(body && { body: JSON.stringify(body) })
  });
  if (raw) {
    return { status: res.status, buffer: Buffer.from(await res.arrayBuffer()), headers: res.headers };
  }
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri('bedmanager_reporttest');
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error(`Refusing to use ${uri}`);

  const runScript = (script) => new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(BACKEND, script)], { cwd: HERE, env: { ...process.env, MONGO_URI: uri }, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => (error ? reject(new Error(`${script} failed: ${error.message}\n${stdout}\n${stderr}`)) : resolve(stdout)));
  });
  await runScript('seedBeds.js');
  await runScript('generateSyntheticData.js');

  Object.assign(process.env, { MONGO_URI: uri, JWT_SECRET: 'x'.repeat(64), PORT: String(PORT), NODE_ENV: 'test', ML_SERVICE_URL: 'http://127.0.0.1:1' });

  // Stub the mailer before the server loads it: no test may reach a real SMTP host
  const emailService = require(path.join(BACKEND, 'services/emailService'));
  const sent = [];
  emailService.sendReportEmail = async (to, subject, buffer, fileName, format) => {
    sent.push({ to, fileName, format, bytes: buffer?.length || 0 });
    return { success: true, messageId: 'stubbed' };
  };

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
  const reportService = require(path.join(BACKEND, 'services/reportService'));

  const tokenOf = async (email, password) => (await api('POST', '/auth/login', { body: { email, password } })).json?.data?.token;
  const admin = await tokenOf('sarah.chen@hospital.com', 'admin123');
  const manager = await tokenOf('anuradha@hospital.com', 'manager123');
  const wardStaff = await tokenOf('staff.icu1@hospital.com', 'staff123');
  const erStaff = await tokenOf('er.staff1@hospital.com', 'erstaff123');
  const tech = await tokenOf('admin@hospital.com', 'admin123');
  check('seeded roles log in', Boolean(admin && manager && wardStaff && erStaff && tech));

  const smallReport = { reportType: 'occupancy', dateRange: 'today', wards: [] };

  // ---- Who may use reports at all ----
  out('\n--- Report access by role ---');
  const readRoutes = [['GET', '/reports/history'], ['GET', '/reports/schedules']];
  const writeRoutes = [['POST', '/reports/generate/pdf'], ['POST', '/reports/generate/csv'], ['POST', '/reports/email']];
  const blocked = [];
  const anonymous = [];
  for (const [method, route] of [...readRoutes, ...writeRoutes]) {
    const noToken = await api(method, route, { body: method === 'POST' ? smallReport : undefined });
    if (noToken.status !== 401) anonymous.push([route, noToken.status]);
    for (const [label, token] of [['ward staff', wardStaff], ['ER staff', erStaff], ['technical team', tech]]) {
      const r = await api(method, route, { token, body: method === 'POST' ? smallReport : undefined });
      if (r.status !== 403) blocked.push([label, route, r.status]);
    }
  }
  check('every report route needs a login (401)', anonymous.length === 0, anonymous);
  check('ward staff, ER staff and the technical team cannot use reports (403)', blocked.length === 0, blocked);

  let r = await api('GET', '/reports/history', { token: manager });
  check('a manager can read report history (200)', r.status === 200, r.json?.message);
  r = await api('GET', '/reports/history', { token: admin });
  check('a hospital admin can read report history (200)', r.status === 200, r.json?.message);

  // ---- Generating ----
  out('\n--- Generating ---');
  r = await api('POST', '/reports/generate/pdf', { token: admin, body: smallReport, raw: true });
  check('a hospital admin generates a PDF (200)', r.status === 200, r.status);
  check('...and it really is a PDF', r.buffer?.slice(0, 5).toString() === '%PDF-', r.buffer?.slice(0, 20).toString());
  const pdfName = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1];
  check('...saved under a generated report name', /^report_\d+\.pdf$/.test(pdfName || ''), pdfName);

  r = await api('POST', '/reports/generate/csv', { token: manager, body: smallReport, raw: true });
  check('a manager generates a CSV (200)', r.status === 200, r.status);
  const csvName = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1];

  // ---- Input checks ----
  out('\n--- Input checks ---');
  r = await api('POST', '/reports/generate/pdf', { token: admin, body: { ...smallReport, wards: ['<script>alert(1)</script>'] } });
  check('an unknown ward is refused (400)', r.status === 400, [r.status, r.json?.message]);
  r = await api('POST', '/reports/generate/pdf', { token: admin, body: { ...smallReport, wards: 'ICU' } });
  check('wards must be an array (400)', r.status === 400, r.json?.message);
  r = await api('POST', '/reports/generate/pdf', { token: admin, body: { ...smallReport, reportType: 'everything' } });
  check('an unknown report type is refused (400)', r.status === 400, r.json?.message);
  r = await api('POST', '/reports/generate/pdf', { token: admin, body: { ...smallReport, wards: ['ICU'] } });
  check('a real ward is still accepted (200)', r.status === 200, r.status);

  // Defence in depth: even if a hostile string reached the generator, it is escaped
  // No URL in the payload itself, so the "no remote resources" scan below stays meaningful
  const hostile = '<script>alert(1)</script>" onload="alert(2)';
  const html = reportService.generateHTMLReport({
    reportType: 'occupancy',
    dateRange: 'today',
    generatedDate: new Date().toISOString(),
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    dateRangeLabel: hostile,
    selectedWards: [hostile],
    summary: { totalBeds: 1, occupiedBeds: 1, availableBeds: 0, cleaningBeds: 0, occupancyRate: 100 },
    wardStats: { [hostile]: { total: 1, occupied: 1, available: 0, cleaning: 0 } }
  });
  check('report HTML escapes ward names and labels', !html.includes('<script>') && html.includes('&lt;script&gt;'));
  check('...including quotes that would break out of an attribute', !html.includes('" onload="'), /.{0,40}onload.{0,20}/.exec(html)?.[0]);
  check('report HTML pulls in no remote resources', !/https?:\/\//.test(html), /https?:\/\/\S+/.exec(html)?.[0]);

  // ---- Emailing ----
  out('\n--- Emailing a report ---');
  // Managers decide who a report goes to, including people with no account here
  sent.length = 0;
  r = await api('POST', '/reports/email', { token: manager, body: { ...smallReport, email: 'consultant@partner.example', format: 'csv' } });
  check('a manager emails a report to an outside address (200)', r.status === 200, r.json?.message);
  check('...and it really was sent there', sent.length === 1 && sent[0].to === 'consultant@partner.example', sent);
  check('...with the report attached', (sent[0]?.bytes || 0) > 0, sent[0]?.bytes);

  sent.length = 0;
  r = await api('POST', '/reports/email', { token: admin, body: { ...smallReport, email: '  ANURADHA@hospital.com ', format: 'csv' } });
  check('an address is trimmed and lower-cased before sending (200)', r.status === 200 && sent[0]?.to === 'anuradha@hospital.com', [r.status, sent]);

  // What must still be refused: anything that is not one plain address, since commas,
  // semicolons, angle brackets and newlines are how extra recipients or headers get smuggled in
  const badAddresses = ['not-an-email', 'a@b.com\nBcc: evil@evil.test', 'a@b.com, evil@evil.test', '"Report" <a@b.com>', 'a@b.com; evil@evil.test', 'a@ b.com', ''];
  const wronglyAccepted = [];
  for (const address of badAddresses) {
    sent.length = 0;
    const bad = await api('POST', '/reports/email', { token: admin, body: { ...smallReport, email: address, format: 'csv' } });
    if (bad.status !== 400 || sent.length > 0) wronglyAccepted.push([address, bad.status, sent.length]);
  }
  check('malformed addresses and header injection are refused (400, nothing sent)', wronglyAccepted.length === 0, wronglyAccepted);

  r = await api('POST', '/reports/email', { token: admin, body: { ...smallReport, email: 'anuradha@hospital.com', format: 'exe' } });
  check('an unknown format is refused (400)', r.status === 400, r.json?.message);

  // ---- Schedules ----
  out('\n--- Schedules ---');
  r = await api('GET', '/reports/schedules', { token: manager });
  check('a manager can read the schedules (200)', r.status === 200 && r.json?.data?.length > 0, r.json?.message);
  const scheduleId = r.json?.data?.[0]?.id;

  r = await api('PUT', `/reports/schedules/${scheduleId}`, { token: manager, body: { enabled: false } });
  check('a manager cannot change a schedule (403)', r.status === 403, r.status);
  r = await api('POST', `/reports/schedules/${scheduleId}/run`, { token: manager });
  check('a manager cannot trigger a scheduled send (403)', r.status === 403, r.status);

  r = await api('PUT', `/reports/schedules/${scheduleId}`, { token: admin, body: { enabled: false } });
  check('a hospital admin disables a schedule (200)', r.status === 200 && r.json?.schedule?.enabled === false, r.json?.message);

  r = await api('PUT', `/reports/schedules/${scheduleId}`, { token: admin, body: { id: 'hijacked', name: 'Mine', enabled: false } });
  check('unknown fields are refused instead of merged (400)', r.status === 400, r.json?.message);
  const after = (await api('GET', '/reports/schedules', { token: admin })).json?.data?.find((s) => s.id === scheduleId);
  check('...so the schedule keeps its id and name', Boolean(after) && after.name !== 'Mine', after?.name);

  r = await api('PUT', `/reports/schedules/${scheduleId}`, { token: admin, body: { schedule: 'every minute please' } });
  check('an invalid cron expression is refused (400)', r.status === 400, r.json?.message);
  r = await api('PUT', `/reports/schedules/${scheduleId}`, { token: admin, body: { enabled: 'yes' } });
  check('enabled must be a boolean (400)', r.status === 400, r.json?.message);
  r = await api('PUT', `/reports/schedules/${scheduleId}`, { token: admin, body: { config: { reportType: 'everything' } } });
  check('an invalid config report type is refused (400)', r.status === 400, r.json?.message);
  r = await api('PUT', `/reports/schedules/${scheduleId}`, { token: admin, body: { config: { wards: ['Nowhere'] } } });
  check('an invalid config ward is refused (400)', r.status === 400, r.json?.message);
  r = await api('PUT', `/reports/schedules/${scheduleId}`, { token: admin, body: { config: { recipients: ['a@b.com\nBcc: evil@evil.test'] } } });
  check('a malformed scheduled recipient is refused (400)', r.status === 400, r.json?.message);
  r = await api('PUT', '/reports/schedules/does-not-exist', { token: admin, body: { enabled: false } });
  check('an unknown schedule is 404', r.status === 404, r.status);

  r = await api('PUT', `/reports/schedules/${scheduleId}`, { token: admin, body: { config: { recipients: ['Ops@Partner.example'], format: 'csv', dateRange: 'today', reportType: 'occupancy', wards: ['ICU'] } } });
  check('an outside recipient is accepted and normalised (200)', r.status === 200 && r.json?.schedule?.config?.recipients?.[0] === 'ops@partner.example', r.json?.schedule?.config);

  sent.length = 0;
  r = await api('POST', `/reports/schedules/${scheduleId}/run`, { token: admin });
  check('a hospital admin runs a schedule now (200)', r.status === 200, r.json?.message);
  check('...and the report is emailed to the configured recipient', sent.length === 1 && sent[0].to === 'ops@partner.example', sent);

  // ---- Download and delete still work for the allowed roles ----
  out('\n--- Download and delete ---');
  r = await api('GET', `/reports/download/${csvName}`, { token: manager, raw: true });
  check('a manager downloads a saved report (200)', r.status === 200 && r.buffer.length > 0, r.status);
  r = await api('GET', `/reports/download/${csvName}`, { token: erStaff });
  check('ER staff cannot download a saved report (403)', r.status === 403, r.status);
  r = await api('GET', '/reports/download/..%2F..%2F.env', { token: admin });
  check('path traversal is still refused (400)', r.status === 400, r.status);
  r = await api('DELETE', `/reports/${csvName}`, { token: admin });
  check('a hospital admin deletes a saved report (200)', r.status === 200, r.json?.message);

  out(`\n${pass} passed, ${fail} failed`);
  if (fail > 0 && serverErrors.length > 0) out('Server errors:\n' + serverErrors.slice(-10).join('\n'));
  await mongod.stop();
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  process.stdout.write(String(error.stack || error) + '\n');
  process.exit(1);
});
