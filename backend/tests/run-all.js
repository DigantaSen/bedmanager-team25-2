// backend/tests/run-all.js
// Runs every end-to-end suite and reports the totals.
//
//   npm test                 - run everything
//   npm test -- sockets      - run only the suites whose name contains "sockets"
//
// Each suite starts its own in-memory MongoDB (mongodb-memory-server) and its own copy of
// the server on its own port, so none of them touch a real database. The first run downloads
// a MongoDB binary, which takes a minute; later runs reuse it.
const path = require('path');
const { execFile } = require('child_process');

// Ordered roughly by what they cover: data, then access control, then hardening
const SUITES = [
  { file: 'test-generator.js', name: 'seed data' },
  { file: 'test-api.js', name: 'forecasting and ML', needsMl: true },
  { file: 'test-beds.js', name: 'bed access and inventory' },
  { file: 'test-roles.js', name: 'sign-up approvals and roles' },
  { file: 'test-hospitals.js', name: 'hospital directory' },
  { file: 'test-emergency-requests.js', name: 'emergency requests' },
  { file: 'test-endpoint-auth.js', name: 'analytics and log endpoints' },
  { file: 'test-reports.js', name: 'report access and input' },
  { file: 'test-report-path.js', name: 'report path traversal' },
  { file: 'test-sockets.js', name: 'real-time events' },
  { file: 'test-hardening.js', name: 'headers, limits and rate limiting' },
  { file: 'test-email-local.js', name: 'report email' }
];

const filter = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const selected = filter.length
  ? SUITES.filter((suite) => filter.some((term) => suite.file.includes(term) || suite.name.includes(term)))
  : SUITES;

if (selected.length === 0) {
  console.error(`No suite matches ${filter.join(' ')}. Available:\n  ${SUITES.map((s) => s.file).join('\n  ')}`);
  process.exit(1);
}

const run = (suite) => new Promise((resolve) => {
  const started = Date.now();
  execFile(process.execPath, [path.join(__dirname, suite.file)], { cwd: __dirname, maxBuffer: 20 * 1024 * 1024 },
    (error, stdout, stderr) => {
      const summary = /(\d+) passed, (\d+) failed/.exec(stdout);
      const noSummary = !summary;
      resolve({
        suite,
        passed: summary ? Number(summary[1]) : 0,
        failed: summary ? Number(summary[2]) : 0,
        // A suite that never printed a summary crashed, however it exited
        ok: !error && !noSummary,
        crashed: noSummary,
        seconds: Math.round((Date.now() - started) / 1000),
        // stderr matters: a crash before the first check prints nothing to stdout
        output: [stdout, stderr].filter(Boolean).join('\n')
      });
    });
});

(async () => {
  console.log(`Running ${selected.length} suite(s)\n`);

  const results = [];
  for (const suite of selected) {
    process.stdout.write(`  ${suite.name.padEnd(36)}`);
    const result = await run(suite);
    results.push(result);
    console.log(result.ok
      ? `✅ ${result.passed} passed  (${result.seconds}s)`
      : result.crashed
        ? `💥 crashed before reporting  (${result.seconds}s)`
        : `❌ ${result.failed} failed of ${result.passed + result.failed}  (${result.seconds}s)`);
  }

  const failures = results.filter((result) => !result.ok);
  const passed = results.reduce((total, result) => total + result.passed, 0);
  const failed = results.reduce((total, result) => total + result.failed, 0);

  console.log(`\n${passed} checks passed, ${failed} failed, across ${results.length} suite(s)`);

  for (const failure of failures) {
    console.log(`\n--- ${failure.suite.file} ---`);
    const lines = failure.output.split('\n').filter((line) => line.startsWith('FAIL') || /passed, \d+ failed/.test(line));
    console.log(lines.length ? lines.join('\n') : failure.output.slice(-2000));
  }

  process.exit(failures.length ? 1 : 0);
})();
