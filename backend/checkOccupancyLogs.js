// Script to check OccupancyLog entries for maintenance-related status changes
// Note: We keep these as historical records, they don't affect current functionality

const mongoose = require('mongoose');
const OccupancyLog = require('./models/OccupancyLog');
require('dotenv').config();

const checkOccupancyLogs = async () => {
  try {
    // Connect to MongoDB
    const dbURI = process.env.MONGO_URI || 'mongodb://localhost:27017/hospital_bed_management';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(dbURI);
    console.log('✅ Connected to MongoDB');

    // Find all maintenance-related logs
    const maintenanceLogs = await OccupancyLog.find({
      statusChange: { $in: ['maintenance_start', 'maintenance_end'] }
    }).sort({ timestamp: -1 }).limit(20);

    console.log(`\n📊 Found ${maintenanceLogs.length} maintenance-related log entries (showing last 20)`);

    if (maintenanceLogs.length > 0) {
      console.log('\n📝 Recent maintenance logs:');
      maintenanceLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log.statusChange} - Bed ID: ${log.bedId} - ${new Date(log.timestamp).toLocaleString()}`);
      });
      console.log('\n💡 Note: These are historical records and do not affect current functionality.');
      console.log('   They show past maintenance activities and can be kept for audit purposes.');
    } else {
      console.log('✅ No maintenance-related logs found.');
    }

    // Get total count
    const totalMaintenanceLogs = await OccupancyLog.countDocuments({
      statusChange: { $in: ['maintenance_start', 'maintenance_end'] }
    });
    console.log(`\n📈 Total maintenance log entries in database: ${totalMaintenanceLogs}`);

    // Close connection
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');

  } catch (error) {
    console.error('❌ Error checking logs:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// Run the check
checkOccupancyLogs();
