// Comprehensive Database Cleanup Script
// Removes all 'maintenance' status references and orphaned data

const mongoose = require('mongoose');
const Bed = require('./models/Bed');
const CleaningLog = require('./models/CleaningLog');
require('dotenv').config();

const comprehensiveCleanup = async () => {
  try {
    const dbURI = process.env.MONGO_URI || 'mongodb://localhost:27017/hospital_bed_management';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(dbURI);
    console.log('✅ Connected to MongoDB\n');

    console.log('=' .repeat(60));
    console.log('  COMPREHENSIVE DATABASE CLEANUP');
    console.log('  Removing old "maintenance" status references');
    console.log('=' .repeat(60));
    console.log('');

    // 1. Clean up beds with 'maintenance' status
    console.log('1️⃣  Checking Bed collection...');
    const maintenanceBeds = await Bed.find({ status: 'maintenance' });
    
    if (maintenanceBeds.length > 0) {
      console.log(`   Found ${maintenanceBeds.length} beds with 'maintenance' status`);
      maintenanceBeds.forEach((bed, i) => {
        console.log(`      ${i+1}. Bed ${bed.bedId} (Ward: ${bed.ward})`);
      });
      
      const bedResult = await Bed.updateMany(
        { status: 'maintenance' },
        { 
          $set: { 
            status: 'available',
            cleaningStartTime: null,
            estimatedCleaningDuration: null,
            estimatedCleaningEndTime: null,
            patientName: null,
            patientId: null
          }
        }
      );
      console.log(`   ✅ Updated ${bedResult.modifiedCount} beds to 'available' status\n`);
    } else {
      console.log('   ✅ No beds with maintenance status\n');
    }

    // 2. Check for orphaned CleaningLogs
    console.log('2️⃣  Checking CleaningLog collection for orphaned entries...');
    const inProgressLogs = await CleaningLog.find({ status: 'in_progress' })
      .populate('bedId');
    
    const orphanedLogs = inProgressLogs.filter(log => 
      !log.bedId || (log.bedId.status !== 'cleaning' && log.bedId.status !== 'maintenance')
    );
    
    if (orphanedLogs.length > 0) {
      console.log(`   Found ${orphanedLogs.length} orphaned in-progress cleaning logs`);
      
      // Mark them as completed
      const logIds = orphanedLogs.map(log => log._id);
      const logResult = await CleaningLog.updateMany(
        { _id: { $in: logIds } },
        { 
          $set: { 
            status: 'completed',
            endTime: new Date(),
            notes: 'Auto-completed during maintenance status cleanup'
          }
        }
      );
      console.log(`   ✅ Marked ${logResult.modifiedCount} orphaned logs as completed\n`);
    } else {
      console.log('   ✅ No orphaned cleaning logs\n');
    }

    // 3. Verify cleanup
    console.log('3️⃣  Verifying cleanup...');
    const remainingMaintenance = await Bed.countDocuments({ status: 'maintenance' });
    const remainingOrphaned = await CleaningLog.countDocuments({ 
      status: 'in_progress',
      bedId: { $exists: false }
    });
    
    console.log(`   Beds with 'maintenance' status: ${remainingMaintenance}`);
    console.log(`   Orphaned in-progress logs: ${remainingOrphaned}\n`);

    // 4. Summary
    console.log('=' .repeat(60));
    console.log('  CLEANUP SUMMARY');
    console.log('=' .repeat(60));
    console.log(`  ✅ Beds cleaned: ${maintenanceBeds.length}`);
    console.log(`  ✅ Logs cleaned: ${orphanedLogs.length}`);
    console.log(`  ✅ Database is ready for new status flow!`);
    console.log('  ℹ️  Valid statuses: available, cleaning, occupied');
    console.log('=' .repeat(60));

    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    console.log('✨ Cleanup complete!\n');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
};

// Run the comprehensive cleanup
comprehensiveCleanup();
