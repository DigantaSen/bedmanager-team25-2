// ======================================================================
//  SYNTHETIC DATA GENERATOR
//  Simulates each bed's history (admission -> discharge -> cleaning -> idle)
//  so current bed statuses, occupancy logs, cleaning logs and alerts all
//  describe the same events.
// ======================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Bed = require("./models/Bed");
const User = require("./models/User");
const OccupancyLog = require("./models/OccupancyLog");
const CleaningLog = require("./models/CleaningLog");
const EmergencyRequest = require("./models/EmergencyRequest");
const Alert = require("./models/Alert");

// ----------------------------------------------------------------------
// DB CONNECT
// ----------------------------------------------------------------------
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/bedmanager";

// ----------------------------------------------------------------------
// CONFIGURATION — UPDATED TO MATCH SEEDBEDS.JS
// ----------------------------------------------------------------------
const CONFIG = {
  wards: ["ICU", "General", "Emergency"], // Match seedBeds.js wards only
  daysHistory: 100,  // simulated history window (covers the 90-day analytics views)
  today: new Date(), // simulation ends now
};

// ----------------------------------------------------------------------
// UTILS
// ----------------------------------------------------------------------
function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate realistic stay duration with ward-based mean and ±20% variance
function getRealisticStayDuration(ward) {
  const losRange = LOS[ward];

  // Central limit theorem: average of 6 uniform random variables approximates normal
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += Math.random();
  const normalRand = sum / 6;

  return Math.round(losRange[0] + normalRand * (losRange[1] - losRange[0]));
}

// Hours a bed stays empty between cleaning and the next admission (keeps average occupancy around 75%)
function getIdleHours(ward) {
  const meanStay = (LOS[ward][0] + LOS[ward][1]) / 2;
  return random(2, Math.round(meanStay * 0.6));
}

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const addHours = (d, h) => new Date(d.getTime() + h * 3600 * 1000);
const addMinutes = (d, m) => new Date(d.getTime() + m * 60 * 1000);

// Name and condition data
const firstNames = ["John", "Sarah", "Michael", "Emma", "David", "Lisa", "James", "Mary", "Robert", "Jennifer", "William", "Linda", "Richard", "Patricia", "Joseph", "Elizabeth"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor"];
const conditions = ["Chest Pain", "Respiratory Distress", "Abdominal Pain", "Head Injury", "Cardiac Event", "Stroke Symptoms", "Severe Bleeding", "Motor Vehicle Accident"];

// ----------------------------------------------------------------------
// REALISTIC LENGTH OF STAY DISTRIBUTIONS (hours)
// Updated to match seedBeds.js ward structure: ICU, General, Emergency only
// ----------------------------------------------------------------------
const LOS = {
  ICU: [72, 168],          // 3-7 days (critical care patients)
  General: [48, 120],      // 2-5 days (standard hospital stay)
  Emergency: [24, 72],     // 1-3 days (stabilization period)
};

// ----------------------------------------------------------------------
// SEED ACCOUNTS
// ----------------------------------------------------------------------
function buildSeedAccounts() {
  const accounts = [
    {
      name: "Admin User",
      email: "admin@hospital.com",
      password: "admin123",
      role: "technical_team",
      department: "IT",
    },
    {
      name: "Dr. Sarah Chen",
      email: "sarah.chen@hospital.com",
      password: "admin123",
      role: "hospital_admin",
      department: "Administration",
    },
    {
      name: "Anuradha Patel",
      email: "anuradha@hospital.com",
      password: "manager123",
      role: "manager",
      ward: "ICU",
      assignedWards: ["ICU"],
    },
  ];

  // Ward staff (3 per ward)
  CONFIG.wards.forEach((w) => {
    for (let i = 1; i <= 3; i++) {
      accounts.push({
        name: `${w} Staff ${i}`,
        email: `staff.${w.toLowerCase()}${i}@hospital.com`,
        password: "staff123",
        role: "ward_staff",
        ward: w,
      });
    }
  });

  // ER staff
  for (let i = 1; i <= 5; i++) {
    accounts.push({
      name: `ER Staff ${i}`,
      email: `er.staff${i}@hospital.com`,
      password: "erstaff123",
      role: "er_staff",
      ward: "Emergency",
    });
  }

  return accounts;
}

// ----------------------------------------------------------------------
// CLEAR DATABASE (EXCEPT BEDS — SEEDBEDS.JS HANDLES THOSE)
// Only the seed accounts are replaced; accounts created through sign-up are kept
// ----------------------------------------------------------------------
async function clearDatabase(seedEmails) {
  console.log("🗑 Clearing seed accounts, logs, requests and alerts (keeping beds and other accounts)...");
  await Promise.all([
    User.deleteMany({ email: { $in: seedEmails } }),
    OccupancyLog.deleteMany({}),
    CleaningLog.deleteMany({}),
    EmergencyRequest.deleteMany({}),
    Alert.deleteMany({}),
  ]);
  const keptAccounts = await User.countDocuments({});
  console.log(`✔ Database clean (beds and ${keptAccounts} other account${keptAccounts === 1 ? "" : "s"} preserved)`);
}

// ----------------------------------------------------------------------
// USER GENERATION
// ----------------------------------------------------------------------
async function generateUsers(seedAccounts) {
  console.log("👤 Generating users...");

  // Hash passwords
  const hashed = await Promise.all(
    seedAccounts.map(async (u) => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(u.password, salt);
      return { ...u, password: hashedPassword, status: "approved" };
    })
  );

  await User.insertMany(hashed);
  console.log(`✔ Created ${hashed.length} users`);

  // Generated activity is attributed to seed accounts only
  return User.find({ email: { $in: seedAccounts.map((u) => u.email) } });
}

// ----------------------------------------------------------------------
// FETCH EXISTING BEDS (SEEDBEDS.JS CREATES THE BEDS)
// ----------------------------------------------------------------------
async function loadBeds() {
  console.log("🛏 Fetching beds from database...");

  const beds = await Bed.find({ retiredAt: null }).lean();

  if (beds.length === 0) {
    console.error("❌ No beds found! Please run seedBeds.js first.");
    throw new Error("No beds in database. Run seedBeds.js before generateSyntheticData.js");
  }

  const unsupportedWards = [...new Set(beds.map((b) => b.ward))].filter((ward) => !LOS[ward]);
  if (unsupportedWards.length > 0) {
    throw new Error(`No length-of-stay settings for ward(s): ${unsupportedWards.join(", ")}. Add them to LOS first.`);
  }

  console.log(`✔ Found ${beds.length} beds in database`);
  CONFIG.wards.forEach((ward) => {
    console.log(`  - ${ward}: ${beds.filter((b) => b.ward === ward).length} beds`);
  });

  return beds;
}

// ----------------------------------------------------------------------
// BED HISTORY SIMULATION
// Each bed cycles through: admitted -> released -> cleaned -> idle -> admitted ...
// Logs use the same events the app records (assigned, released, maintenance_end),
// and the bed's current status is wherever its simulated timeline is right now.
// ----------------------------------------------------------------------
function simulateBed(bed, staff) {
  const now = CONFIG.today;
  const windowStart = addHours(now, -CONFIG.daysHistory * 24);
  const meanStay = (LOS[bed.ward][0] + LOS[bed.ward][1]) / 2;
  const occupancyLogs = [];
  const cleaningLogs = [];

  const occupancyLog = (statusChange, timestamp) => ({
    bedId: bed._id,
    userId: randomChoice(staff)._id,
    statusChange,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // Open the window part-way through a stay (most beds) or an empty spell, like a running ward
  let admittedAt = Math.random() < 0.75
    ? addHours(windowStart, -random(0, Math.round(meanStay)))
    : addHours(windowStart, getIdleHours(bed.ward));

  while (true) {
    occupancyLogs.push(occupancyLog("assigned", admittedAt));

    const releasedAt = addHours(admittedAt, getRealisticStayDuration(bed.ward));
    if (releasedAt >= now) {
      return {
        occupancyLogs,
        cleaningLogs,
        state: {
          status: "occupied",
          patientName: `${randomChoice(firstNames)} ${randomChoice(lastNames)}`,
          patientId: `P${random(10000, 99999)}`,
        },
      };
    }
    occupancyLogs.push(occupancyLog("released", releasedAt));

    // Cleaning starts when the patient leaves
    const cleaner = randomChoice(staff);
    const estimatedDuration = random(20, 35);
    const actualDuration = random(15, 45);
    const cleanedAt = addMinutes(releasedAt, actualDuration);

    if (cleanedAt >= now) {
      cleaningLogs.push({
        bedId: bed._id,
        ward: bed.ward,
        startTime: releasedAt,
        endTime: null,
        estimatedDuration,
        actualDuration: null,
        status: "in_progress",
        assignedTo: cleaner._id,
        completedBy: null,
        notes: null,
        createdAt: releasedAt,
        updatedAt: releasedAt,
      });
      return {
        occupancyLogs,
        cleaningLogs,
        state: {
          status: "cleaning",
          cleaningStartTime: releasedAt,
          estimatedCleaningDuration: estimatedDuration,
          estimatedCleaningEndTime: addMinutes(releasedAt, estimatedDuration),
        },
      };
    }

    cleaningLogs.push({
      bedId: bed._id,
      ward: bed.ward,
      startTime: releasedAt,
      endTime: cleanedAt,
      estimatedDuration,
      actualDuration,
      status: "completed",
      assignedTo: cleaner._id,
      completedBy: cleaner._id,
      notes: null,
      createdAt: releasedAt,
      updatedAt: cleanedAt,
    });
    occupancyLogs.push(occupancyLog("maintenance_end", cleanedAt));

    const nextAdmission = addHours(cleanedAt, getIdleHours(bed.ward));
    if (nextAdmission >= now) {
      return { occupancyLogs, cleaningLogs, state: { status: "available" } };
    }
    admittedAt = nextAdmission;
  }
}

async function insertInChunks(Model, docs, chunkSize = 2000) {
  for (let i = 0; i < docs.length; i += chunkSize) {
    // lean: documents are fully formed here, so skip Mongoose's per-document validation lookups
    await Model.insertMany(docs.slice(i, i + chunkSize), { lean: true });
  }
}

async function simulateBedHistory(beds, users) {
  console.log(`📘 Simulating ${CONFIG.daysHistory} days of bed history...`);

  const wardStaff = users.filter((u) => u.role === "ward_staff");
  const occupancyLogs = [];
  const cleaningLogs = [];
  const bedUpdates = [];
  const statusCounts = { occupied: 0, cleaning: 0, available: 0 };

  for (const bed of beds) {
    const staff = wardStaff.filter((s) => s.ward === bed.ward);
    const { occupancyLogs: bedLogs, cleaningLogs: bedCleanings, state } = simulateBed(bed, staff.length > 0 ? staff : wardStaff);

    occupancyLogs.push(...bedLogs);
    cleaningLogs.push(...bedCleanings);
    statusCounts[state.status]++;

    bedUpdates.push({
      updateOne: {
        filter: { _id: bed._id },
        update: {
          $set: {
            status: state.status,
            patientName: state.patientName || null,
            patientId: state.patientId || null,
            cleaningStartTime: state.cleaningStartTime || null,
            estimatedCleaningDuration: state.estimatedCleaningDuration || null,
            estimatedCleaningEndTime: state.estimatedCleaningEndTime || null,
            // Discharge estimates are set by managers in the app, not invented here
            estimatedDischargeTime: null,
            dischargeNotes: null,
            notes: null,
          },
        },
      },
    });
  }

  occupancyLogs.sort((a, b) => a.timestamp - b.timestamp);
  await insertInChunks(OccupancyLog, occupancyLogs);
  await insertInChunks(CleaningLog, cleaningLogs);
  await Bed.bulkWrite(bedUpdates);

  console.log(`✔ Created ${occupancyLogs.length} occupancy logs and ${cleaningLogs.length} cleaning logs`);
  console.log(`✔ Current bed states: ${statusCounts.occupied} occupied, ${statusCounts.cleaning} cleaning, ${statusCounts.available} available`);
}

// ----------------------------------------------------------------------
// EMERGENCY REQUESTS
// ----------------------------------------------------------------------
async function generateEmergencyRequests() {
  console.log("🚑 Generating emergency requests...");

  const requests = [];
  const count = random(30, 50);

  for (let i = 0; i < count; i++) {
    // Older requests have been decided; recent ones may still be pending
    const hoursAgo = random(1, 72);
    const status = hoursAgo <= 6 ? randomChoice(["pending", "approved"]) : randomChoice(["approved", "approved", "rejected"]);
    const createdAt = addHours(CONFIG.today, -hoursAgo);

    requests.push({
      patientName: `${randomChoice(firstNames)} ${randomChoice(lastNames)}`,
      patientContact: "+1" + random(2000000000, 9999999999),
      patientId: null,
      ward: randomChoice(CONFIG.wards),
      priority: randomChoice(["critical", "high", "medium", "low"]),
      status,
      reason: randomChoice(conditions),
      location: randomChoice(["ER Bay 1", "ER Bay 2", "Trauma Room"]),
      description: null,
      createdAt,
      updatedAt: status === "pending" ? createdAt : addMinutes(createdAt, random(5, 90)),
    });
  }

  // Insert directly so the historical createdAt/updatedAt values are kept
  const result = await EmergencyRequest.collection.insertMany(requests);
  console.log(`✔ Created ${requests.length} emergency requests`);

  return requests.map((request, i) => ({ ...request, _id: result.insertedIds[i] }));
}

// ----------------------------------------------------------------------
// ALERTS — only for conditions that exist in the generated data
// (same messages the app creates for pending requests and high occupancy)
// ----------------------------------------------------------------------
async function generateAlerts(requests) {
  console.log("🔔 Generating alerts...");

  const alerts = requests
    .filter((request) => request.status === "pending")
    .map((request) => ({
      type: "request_pending",
      severity: request.priority,
      message: `Emergency bed request for ${request.patientName} at ${request.location} (${request.ward} ward)`,
      relatedRequest: request._id,
      ward: request.ward,
      targetRole: ["manager", "hospital_admin"],
      timestamp: request.createdAt,
    }));

  for (const ward of CONFIG.wards) {
    const totalBeds = await Bed.countDocuments({ ward, retiredAt: null });
    const occupiedBeds = await Bed.countDocuments({ ward, status: "occupied", retiredAt: null });
    const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds) * 100 : 0;

    if (occupancyRate > 90) {
      alerts.push({
        type: "occupancy_high",
        severity: occupancyRate >= 95 ? "critical" : "high",
        message: `${ward} ward occupancy at ${occupancyRate.toFixed(1)}% (${occupiedBeds}/${totalBeds} beds occupied)`,
        ward,
        targetRole: ["manager", "hospital_admin"],
        timestamp: CONFIG.today,
      });
    }
  }

  if (alerts.length > 0) {
    await Alert.insertMany(alerts);
  }
  console.log(`✔ Created ${alerts.length} alerts`);
}

// ----------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------
(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✔ Connected to MongoDB (${mongoose.connection.name})`);

    const beds = await loadBeds(); // Checked before anything is deleted
    const seedAccounts = buildSeedAccounts();
    await clearDatabase(seedAccounts.map((account) => account.email)); // Keeps beds and non-seed accounts
    const users = await generateUsers(seedAccounts);
    await simulateBedHistory(beds, users);
    const requests = await generateEmergencyRequests();
    await generateAlerts(requests);

    console.log("\n🎉 Synthetic dataset generated successfully!");
    console.log("ℹ️  Bed structure preserved from seedBeds.js\n");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
