// backend/createAdmin.js
// Create an approved hospital_admin or technical_team account, or promote an existing user.
// These roles cannot be requested at sign-up, so they are only created from the command line.
//
// Usage:
//   npm run create:admin -- --email admin@hospital.com --password "<password>" --name "Jane Doe"
//   npm run create:technical -- --email tech@hospital.com --password "<password>" --name "Sam Lee"
//   npm run create:admin -- --email existing.user@hospital.com   (promote existing user)

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const { MIN_PASSWORD_LENGTH } = require('./config/passwordPolicy');

const COMMAND_LINE_ROLES = ['hospital_admin', 'technical_team'];
const DEFAULT_NAMES = { hospital_admin: 'Hospital Admin', technical_team: 'Technical Team' };

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

async function main() {
  const { name, email, password, role = 'hospital_admin' } = parseArgs(process.argv.slice(2));

  if (!email) {
    console.error('Usage: npm run create:admin -- --email admin@hospital.com --password "<password>" --name "Jane Doe"');
    console.error('       npm run create:technical -- --email tech@hospital.com --password "<password>" --name "Sam Lee"');
    process.exitCode = 1;
    return;
  }

  if (!COMMAND_LINE_ROLES.includes(role)) {
    console.error(`❌ --role must be one of: ${COMMAND_LINE_ROLES.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not set in .env');
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);

  const existingUser = await User.findOne({ email: email.toLowerCase() });

  if (existingUser) {
    existingUser.role = role;
    existingUser.status = 'approved';
    await existingUser.save();
    console.log(`✅ Promoted ${existingUser.email} to ${role} (password unchanged)`);
    return;
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    console.error(`❌ --password is required for a new account (at least ${MIN_PASSWORD_LENGTH} characters)`);
    process.exitCode = 1;
    return;
  }

  const user = await User.create({
    name: name || DEFAULT_NAMES[role],
    email,
    password,
    role,
    status: 'approved'
  });
  console.log(`✅ Created ${role} account ${user.email}`);
}

main()
  .catch((err) => {
    console.error('❌ Failed to create account:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
