// Script to check beds in cleaning status and their fields
const mongoose = require('mongoose');
const Bed = require('./models/Bed');
const CleaningLog = require('./models/CleaningLog');
require('dotenv').config();

const checkCleaningBeds = async () => {
  try {
    const dbURI = process.env.MONGO_URI || 'mongodb://localhost:27017/hospital_bed_management';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(dbURI);
    console.log('✅ Connected to MongoDB\n');

    // Find all beds in cleaning status
    const cleaningBeds = await Bed.find({ status: 'cleaning' });
    
    console.log(`📊 Found ${cleaningBeds.length} beds in 'cleaning' status\n`);

    if (cleaningBeds.length > 0) {
      console.log('🔍 Bed Details:');
      for (const bed of cleaningBeds) {
        console.log(`\n  Bed ${bed.bedId} (Ward: ${bed.ward})`);
        console.log(`    Status: ${bed.status}`);
        console.log(`    Cleaning Start: ${bed.cleaningStartTime || 'NOT SET ❌'}`);
        console.log(`    Estimated Duration: ${bed.estimatedCleaningDuration || 'NOT SET ❌'} minutes`);
        console.log(`    Estimated End: ${bed.estimatedCleaningEndTime || 'NOT SET ❌'}`);
        
        // Check if there's a cleaning log
        const cleaningLog = await CleaningLog.findOne({ 
          bedId: bed._id, 
          status: 'in_progress' 
        });
        
        if (cleaningLog) {
          console.log(`    ✅ Has CleaningLog (ID: ${cleaningLog._id})`);
        } else {
          console.log(`    ❌ NO CleaningLog found!`);
        }
        
        // Calculate progress if fields are set
        if (bed.cleaningStartTime && bed.estimatedCleaningDuration) {
          const now = new Date();
          const elapsedMinutes = (now - new Date(bed.cleaningStartTime)) / (1000 * 60);
          const percentage = Math.min(Math.round((elapsedMinutes / bed.estimatedCleaningDuration) * 100), 100);
          console.log(`    📊 Progress: ${percentage}% (${Math.round(elapsedMinutes)} of ${bed.estimatedCleaningDuration} minutes)`);
        }
      }

      // Suggest fix if needed
      const bedsNeedingFix = cleaningBeds.filter(
        bed => !bed.cleaningStartTime || !bed.estimatedCleaningDuration
      );

      if (bedsNeedingFix.length > 0) {
        console.log(`\n⚠️  ${bedsNeedingFix.length} bed(s) need cleaning fields fixed!`);
        console.log('   Run: node fixCleaningBeds.js');
      }
    } else {
      console.log('✅ No beds currently in cleaning status');
    }

    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');

  } catch (error) {
    console.error('❌ Error:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

checkCleaningBeds();
