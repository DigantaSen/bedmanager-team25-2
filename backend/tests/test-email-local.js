// Proves the application's own email path works without touching a real mail provider:
// starts a throwaway SMTP server on 127.0.0.1, points emailService at it, sends a report
// through sendReportEmail(), and prints what the server actually received.
const net = require('net');
const path = require('path');

const BACKEND = process.env.BACKEND_DIR || path.join(__dirname, '..');
const PORT = 2525;

const out = (...args) => process.stdout.write(args.join(' ') + '\n');
let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  out(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || detail === undefined ? '' : ' - ' + JSON.stringify(detail).slice(0, 300)}`);
  ok ? pass++ : fail++;
};

// --- A minimal SMTP server: enough of the conversation for nodemailer to deliver ---
const received = { from: null, recipients: [], message: '' };

const server = net.createServer((socket) => {
  let inData = false;
  socket.write('220 localhost Test SMTP\r\n');

  socket.on('data', (chunk) => {
    const text = chunk.toString();

    if (inData) {
      received.message += text;
      if (/\r\n\.\r\n$/.test(received.message)) {
        inData = false;
        received.message = received.message.replace(/\r\n\.\r\n$/, '');
        socket.write('250 Message accepted\r\n');
      }
      return;
    }

    for (const line of text.split('\r\n').filter(Boolean)) {
      const command = line.toUpperCase();
      if (command.startsWith('EHLO') || command.startsWith('HELO')) {
        socket.write('250-localhost\r\n250 AUTH PLAIN LOGIN\r\n');
      } else if (command.startsWith('AUTH')) {
        socket.write('235 Authentication successful\r\n');
      } else if (command.startsWith('MAIL FROM')) {
        received.from = line.slice(line.indexOf(':') + 1).trim();
        socket.write('250 OK\r\n');
      } else if (command.startsWith('RCPT TO')) {
        received.recipients.push(line.slice(line.indexOf(':') + 1).trim());
        socket.write('250 OK\r\n');
      } else if (command === 'DATA') {
        inData = true;
        socket.write('354 Send message, end with .\r\n');
      } else if (command === 'QUIT') {
        socket.write('221 Bye\r\n');
        socket.end();
      } else {
        socket.write('250 OK\r\n');
      }
    }
  });
});

(async () => {
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  out(`📮 Throwaway SMTP server listening on 127.0.0.1:${PORT}\n`);

  // emailService reads its configuration when it is first required
  Object.assign(process.env, {
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(PORT),
    SMTP_USER: 'reports@hospital.test',
    SMTP_PASS: 'not-a-real-password',
    SMTP_FROM: 'reports@hospital.test'
  });

  const emailService = require(path.join(BACKEND, 'services/emailService'));

  const attachment = Buffer.from('Ward,Total Beds,Occupied Beds\nICU,10,7\n');
  const fileName = `report_${Date.now()}.csv`;

  const result = await emailService.sendReportEmail('consultant@partner.example', null, attachment, fileName, 'csv');
  check('sendReportEmail resolves successfully', result.success === true, result);
  check('...and returns a message id', Boolean(result.messageId), result.messageId);

  // Give the server a moment to finish reading the message body
  await new Promise((resolve) => setTimeout(resolve, 300));

  out('\n--- What the SMTP server received ---');
  out(`MAIL FROM: ${received.from}`);
  out(`RCPT TO:   ${received.recipients.join(', ')}`);
  const headers = received.message.split('\r\n\r\n')[0];
  out(headers.split('\r\n').filter((line) => /^(From|To|Subject|Content-Type|Date):/i.test(line)).join('\n'));

  check('the message is addressed to the requested recipient', received.recipients.includes('<consultant@partner.example>'), received.recipients);
  check('it is sent from the configured sender', received.from === '<reports@hospital.test>', received.from);
  check('the subject is the report subject', /Subject: Hospital Bed Management Report/i.test(received.message));
  check('the report is attached under its generated name', received.message.includes(fileName), fileName);
  check('the attachment carries the report content', received.message.includes(Buffer.from('Ward,Total Beds').toString('base64').slice(0, 12)) || received.message.includes('Ward,Total Beds'));
  check('the body mentions the format', /CSV/.test(received.message));

  // The address checks that protect the mail headers live in reportRecipients
  const { normalizeAddress } = require(path.join(BACKEND, 'services/reportRecipients'));
  check('a header-injection address is rejected before it reaches the mailer',
    normalizeAddress('a@b.com\nBcc: evil@evil.test') === null);
  check('a normal address passes through, trimmed and lower-cased',
    normalizeAddress('  Consultant@Partner.Example ') === 'consultant@partner.example');

  out(`\n${pass} passed, ${fail} failed`);
  server.close();
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  process.stdout.write(String(error.stack || error) + '\n');
  server.close();
  process.exit(1);
});
