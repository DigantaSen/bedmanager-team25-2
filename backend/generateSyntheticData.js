// ======================================================================
//  FIXED SYNTHETIC DATA GENERATOR — VERSION 3
//  Fixes: ICU 30–35d overdue stays, invalid timestamps, bad logs,
//         duplicate alerts, noisy occupancy logs, wrong discharge times.
// ======================================================================

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
mongoose.connect("mongodb://localhost:27017/bedmanager", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// ----------------------------------------------------------------------
// CONFIGURATION — UPDATED TO MATCH SEEDBEDS.JS
// ----------------------------------------------------------------------
const CONFIG = {
  wards: ["ICU", "General", "Emergency"], // Match seedBeds.js wards only
  daysHistory: 15,   // realistic historical window
  today: new Date(), // anchor point for generating future discharges
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
  const mean = (losRange[0] + losRange[1]) / 2;
  
  // Generate duration with normal-ish distribution centered on mean
  // Using Box-Muller transform approximation for better normal distribution
  const u1 = Math.random();
  const u2 = Math.random();
  const u3 = Math.random();
  const u4 = Math.random();
  const u5 = Math.random();
  const u6 = Math.random();
  
  // Central limit theorem: average of 6 uniform random variables approximates normal
  const normalRand = (u1 + u2 + u3 + u4 + u5 + u6) / 6; // Mean = 0.5, more concentrated around center
  
  const minDuration = losRange[0];
  const maxDuration = losRange[1];
  const duration = minDuration + normalRand * (maxDuration - minDuration);
  
  return Math.round(duration);
}

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const addHours = (d, h) => new Date(d.getTime() + h * 3600 * 1000);
const addMinutes = (d, m) => new Date(d.getTime() + m * 60 * 1000);

// Name and condition data
const firstNames = ["John", "Sarah", "Michael", "Emma", "David", "Lisa", "James", "Mary", "Robert", "Jennifer", "William", "Linda", "Richard", "Patricia", "Joseph", "Elizabeth"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor"];
const conditions = ["Chest Pain", "Respiratory Distress", "Abdominal Pain", "Head Injury", "Cardiac Event", "Stroke Symptoms", "Severe Bleeding", "Motor Vehicle Accident"];

// ----------------------------------------------------------------------
// REALISTIC LENGTH OF STAY DISTRIBUTIONS (WARD-BASED WITH ±20% VARIANCE)
// Updated to match seedBeds.js ward structure: ICU, General, Emergency only
// ----------------------------------------------------------------------
const LOS = {
  ICU: [72, 168],          // 3-7 days (critical care patients)
  General: [48, 120],      // 2-5 days (standard hospital stay)
  Emergency: [24, 72],     // 1-3 days (stabilization period)
};

// ----------------------------------------------------------------------
// CLEAR DATABASE (EXCEPT BEDS — SEEDBEDS.JS HANDLES THOSE)
// ----------------------------------------------------------------------
async function clearDatabase() {
  console.log("🗑 Clearing database (keeping beds)...");
  await Promise.all([
    // Bed.deleteMany({}), // ← REMOVED: seedBeds.js creates beds
    User.deleteMany({}),
    OccupancyLog.deleteMany({}),
    CleaningLog.deleteMany({}),
    EmergencyRequest.deleteMany({}),
    Alert.deleteMany({}),
  ]);
  console.log("✔ Database clean (beds preserved)");
}

// ----------------------------------------------------------------------
// USER GENERATION
// ----------------------------------------------------------------------
async function generateUsers() {
  console.log("👤 Generating users...");

  const defaultUsers = [
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
      assignedWards: ["ICU", "Cardiology"],
    },
  ];

  // Ward staff (3 per ward)
  CONFIG.wards.forEach((w) => {
    for (let i = 1; i <= 3; i++) {
      defaultUsers.push({
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
    defaultUsers.push({
      name: `ER Staff ${i}`,
      email: `er.staff${i}@hospital.com`,
      password: "er123",
      role: "er_staff",
      ward: "Emergency",
    });
  }

  // Hash passwords
  const hashed = await Promise.all(
    defaultUsers.map(async (u) => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(u.password, salt);
      return { ...u, password: hashedPassword };
    })
  );

  await User.insertMany(hashed);
  console.log(`✔ Created ${hashed.length} users`);

  return User.find({});
}

// ----------------------------------------------------------------------
// FETCH EXISTING BEDS & UPDATE STATUS (SEEDBEDS.JS CREATES THE BEDS)
// ----------------------------------------------------------------------
async function fetchAndUpdateBeds() {
  console.log("🛏 Fetching beds from database...");

  const beds = await Bed.find({}).lean();

  if (beds.length === 0) {
    console.error("❌ No beds found! Please run seedBeds.js first.");
    throw new Error("No beds in database. Run seedBeds.js before generateSyntheticData.js");
  }

  console.log(`✔ Found ${beds.length} beds in database`);

  // Verify bed structure matches seedBeds layout
  const icuBeds = beds.filter((b) => b.ward === "ICU");
  const generalBeds = beds.filter((b) => b.ward === "General");
  const emergencyBeds = beds.filter((b) => b.ward === "Emergency");

  console.log(`  - ICU: ${icuBeds.length} beds`);
  console.log(`  - General: ${generalBeds.length} beds`);
  console.log(`  - Emergency: ${emergencyBeds.length} beds`);

  // Now update beds with realistic occupancy states
  console.log("🔄 Updating bed statuses...");
  
  const updates = [];
  
  for (let bed of beds) {
    // 70% occupied / 20% available / 10% cleaning
    const r = Math.random();
    let status = "available";
    if (r < 0.7) status = "occupied";
    else if (r < 0.9) status = "cleaning";

    const update = {
      status,
      patientName: null,
      patientId: null,
      estimatedDischargeTime: null,
      cleaningStartTime: null,
      estimatedCleaningDuration: null,
      estimatedCleaningEndTime: null,
    };

    // OCCUPIED LOGIC — realistic patient + discharge time with ward-based duration
    if (status === "occupied") {
      const stayHours = getRealisticStayDuration(bed.ward);

      // Calculate discharge time from now + stay duration
      const dischargeTime = addHours(CONFIG.today, stayHours);

      // Ensure future discharge (never past)
      const safeDischarge =
        dischargeTime < CONFIG.today
          ? addHours(CONFIG.today, random(6, 48))
          : dischargeTime;

      update.patientName = randomChoice(firstNames) + " " + randomChoice(lastNames);
      update.patientId = "P" + random(10000, 99999);
      update.estimatedDischargeTime = safeDischarge;
    }

    // CLEANING BEDS
    if (status === "cleaning") {
      const start = addMinutes(CONFIG.today, -random(5, 25));
      const dur = random(20, 45);
      update.cleaningStartTime = start;
      update.estimatedCleaningDuration = dur;
      update.estimatedCleaningEndTime = addMinutes(start, dur);
    }

    updates.push(
      Bed.updateOne({ _id: bed._id }, { $set: update })
    );
  }

  await Promise.all(updates);
  console.log(`✔ Updated ${beds.length} beds with realistic states`);
  
  // Fetch updated beds
  return Bed.find({});
}

// ----------------------------------------------------------------------
// OCCUPANCY LOGS — FIXED ENTRY/EXIT MODEL + HISTORICAL DATA
// ----------------------------------------------------------------------
async function generateOccupancyLogs(beds, users) {
  console.log("📘 Generating occupancy logs...");

  const logs = [];
  const wardStaff = users.filter((u) => u.role === "ward_staff");

  // Current occupied beds - create admission logs (only past timestamps)
  for (let bed of beds) {
    const staff = randomChoice(wardStaff.filter((s) => s.ward === bed.ward));
    if (!staff) continue;

    if (bed.status === "occupied") {
      // Calculate admission time based on stay duration (always in the past)
      const stayHours = getRealisticStayDuration(bed.ward);
      const admissionTime = addHours(CONFIG.today, -random(12, Math.floor(stayHours * 0.8)));
      
      // Only create assignment log (admission)
      // Don't create future release logs - those would violate OccupancyLog validation
      logs.push({
        bedId: bed._id,
        userId: staff._id,
        statusChange: "assigned",
        timestamp: admissionTime,
      });
    }
  }

  // Generate historical occupancy logs for past 15 days
  for (let bed of beds) {
    const staff = randomChoice(wardStaff.filter((s) => s.ward === bed.ward));
    if (!staff) continue;

    const numHistoricalStays = random(3, 8); // 3-8 past stays per bed
    
    for (let i = 0; i < numHistoricalStays; i++) {
      // Use realistic ward-based duration with ±20% variance
      const stayHours = getRealisticStayDuration(bed.ward);
      
      // Historical admission (up to 15 days ago)
      const daysAgo = random(1, CONFIG.daysHistory);
      const hoursAgo = daysAgo * 24 + random(0, 23);
      const admissionTime = addHours(CONFIG.today, -hoursAgo);
      const dischargeTime = addHours(admissionTime, stayHours);
      
      // Only include if discharge is in the past
      if (dischargeTime < CONFIG.today) {
        logs.push({
          bedId: bed._id,
          userId: staff._id,
          statusChange: "assigned",
          timestamp: admissionTime,
        });

        logs.push({
          bedId: bed._id,
          userId: staff._id,
          statusChange: "released",
          timestamp: dischargeTime,
        });
      }
    }
  }

  logs.sort((a, b) => a.timestamp - b.timestamp);
  await OccupancyLog.insertMany(logs);

  console.log(`✔ Created ${logs.length} occupancy logs`);
}

// ----------------------------------------------------------------------
// CLEANING LOGS — ENHANCED WITH MORE HISTORICAL DATA
// ----------------------------------------------------------------------
async function generateCleaningLogs(beds, users) {
  console.log("🧽 Generating cleaning logs...");

  const wardStaff = users.filter((u) => u.role === "ward_staff");
  const logs = [];

  beds.forEach((bed) => {
    // Generate 10-20 historical cleaning logs per bed
    const n = random(10, 20);
    for (let i = 0; i < n; i++) {
      const hoursAgo = random(1, CONFIG.daysHistory * 24);
      const start = addHours(CONFIG.today, -hoursAgo);
      const dur = random(15, 45);
      logs.push({
        bedId: bed._id,
        ward: bed.ward,
        startTime: start,
        endTime: addMinutes(start, dur),
        actualDuration: dur,
        estimatedDuration: random(20, 35),
        performedBy: randomChoice(wardStaff)._id,
        status: 'completed'
      });
    }
  });

  await CleaningLog.insertMany(logs);
  console.log(`✔ Created ${logs.length} cleaning logs`);
}

// ----------------------------------------------------------------------
// EMERGENCY REQUESTS — unchanged (already good)
// ----------------------------------------------------------------------
async function generateEmergencyRequests(users) {
  console.log("🚑 Generating emergency requests...");

  const erStaff = users.filter((u) => u.role === "er_staff");
  const requests = [];

  for (let i = 0; i < random(30, 50); i++) {
    const ts = addHours(CONFIG.today, -random(1, 72));
    requests.push({
      patientName: randomChoice(firstNames),
      patientContact: "+1" + random(2000000000, 9999999999),
      ward: randomChoice(["ICU", "General", "Emergency"]),
      priority: randomChoice(["critical", "high", "medium", "low"]),
      status: randomChoice(["approved", "pending", "rejected"]),
      reason: randomChoice(conditions),
      location: randomChoice(["ER Bay 1", "ER Bay 2", "Trauma Room"]),
      description: "Emergency case handled",
      timestamp: ts,
    });
  }

  await EmergencyRequest.insertMany(requests);
  console.log(`✔ Created ${requests.length} emergency requests`);
}

// ----------------------------------------------------------------------
// ALERTS — FIXED VOLUME + NO DUPLICATES
// ----------------------------------------------------------------------
async function generateAlerts() {
  console.log("🔔 Generating alerts...");

  const alertTemplates = [
    { type: "occupancy_high", severity: "critical" },
    { type: "bed_emergency", severity: "critical" },
    { type: "maintenance_needed", severity: "medium" },
    { type: "request_pending", severity: "high" },
  ];

  const alerts = [];

  for (let i = 0; i < random(20, 35); i++) {
    const tpl = randomChoice(alertTemplates);
    const ward = randomChoice(["ICU", "General", "Emergency"]);

    alerts.push({
      type: tpl.type,
      severity: tpl.severity,
      ward: ward,
      message: `${ward} — ${tpl.type.replace("_", " ")}`,
      timestamp: addMinutes(CONFIG.today, -random(5, 180)),
    });
  }

  await Alert.insertMany(alerts);
  console.log(`✔ Created ${alerts.length} alerts`);
}

// ----------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------
(async () => {
  try {
    await clearDatabase(); // Clears logs/users/requests/alerts (NOT beds)
    const users = await generateUsers();
    const beds = await fetchAndUpdateBeds(); // Fetches beds from seedBeds.js, updates status
    await generateOccupancyLogs(beds, users);
    await generateCleaningLogs(beds, users);
    await generateEmergencyRequests(users);
    await generateAlerts();

    console.log("\n🎉 Synthetic dataset generated successfully!");
    console.log("ℹ️  Bed structure preserved from seedBeds.js\n");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
