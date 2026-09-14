// backend/createAdmin.js
// Create an approved hospital_admin account, or promote an existing user.
// hospital_admin cannot be requested at sign-up, so use this to bootstrap the first admin.
//
// Usage:
//   npm run create:admin -- --email admin@hospital.com --password "<password>" --name "Jane Doe"
//   npm run create:admin -- --email existing.user@hospital.com   (promote existing user)

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const { MIN_PASSWORD_LENGTH } = require('./config/passwordPolicy');

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
  const { name, email, password } = parseArgs(process.argv.slice(2));

  if (!email) {
    console.error('Usage: npm run create:admin -- --email admin@hospital.com --password "<password>" --name "Jane Doe"');
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
    existingUser.role = 'hospital_admin';
    existingUser.status = 'approved';
    await existingUser.save();
    console.log(`✅ Promoted ${existingUser.email} to hospital_admin (password unchanged)`);
    return;
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    console.error(`❌ --password is required for a new account (at least ${MIN_PASSWORD_LENGTH} characters)`);
    process.exitCode = 1;
    return;
  }

  const user = await User.create({
    name: name || 'Hospital Admin',
    email,
    password,
    role: 'hospital_admin',
    status: 'approved'
  });
  console.log(`✅ Created hospital_admin account ${user.email}`);
}

main()
  .catch((err) => {
    console.error('❌ Failed to create admin:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
