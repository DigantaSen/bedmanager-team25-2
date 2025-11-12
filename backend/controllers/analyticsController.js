// backend/controllers/analyticsController.js
// Analytics controller for hospital bed metrics and reporting

const Bed = require('../models/Bed');
const OccupancyLog = require('../models/OccupancyLog');
const CleaningLog = require('../models/CleaningLog');
const mongoose = require('mongoose');

/**
 * @desc    Get occupancy summary for all beds
 * @route   GET /api/analytics/occupancy-summary
 * @access  Public
 * @returns { totalBeds, occupied, available, maintenance, reserved, occupancyPercentage }
 */
exports.getOccupancySummary = async (req, res) => {
  try {
    // Count beds by status
    const [totalBeds, occupied, available, maintenance, reserved] = await Promise.all([
      Bed.countDocuments({}),
      Bed.countDocuments({ status: 'occupied' }),
      Bed.countDocuments({ status: 'available' }),
      Bed.countDocuments({ status: 'maintenance' }),
      Bed.countDocuments({ status: 'reserved' })
    ]);

    // Calculate occupancy percentage
    const occupancyPercentage = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalBeds,
          occupied,
          available,
          maintenance,
          reserved,
          occupancyPercentage
        }
      }
    });
  } catch (error) {
    console.error('Get occupancy summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching occupancy summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get occupancy breakdown by ward
 * @route   GET /api/analytics/occupancy-by-ward
 * @access  Public
 * @returns Array of { ward, totalBeds, occupied, available, maintenance, reserved, occupancyPercentage }
 */
exports.getOccupancyByWard = async (req, res) => {
  try {
    // Get all unique wards
    const wards = await Bed.distinct('ward');

    // For each ward, get the count of beds by status
    const wardData = await Promise.all(
      wards.map(async (ward) => {
        const [totalBeds, occupied, available, maintenance, reserved] = await Promise.all([
          Bed.countDocuments({ ward }),
          Bed.countDocuments({ ward, status: 'occupied' }),
          Bed.countDocuments({ ward, status: 'available' }),
          Bed.countDocuments({ ward, status: 'maintenance' }),
          Bed.countDocuments({ ward, status: 'reserved' })
        ]);

        const occupancyPercentage = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;

        return {
          ward,
          totalBeds,
          occupied,
          available,
          maintenance,
          reserved,
          occupancyPercentage
        };
      })
    );

    // Sort by ward name for consistent ordering
    wardData.sort((a, b) => a.ward.localeCompare(b.ward));

    res.status(200).json({
      success: true,
      data: {
        wardBreakdown: wardData
      }
    });
  } catch (error) {
    console.error('Get occupancy by ward error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching ward occupancy data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get bed history - complete history of status changes for a specific bed
 * @route   GET /api/analytics/bed-history/:bedId
 * @access  Public
 * @param   bedId - MongoDB ObjectId or bedId string (e.g., "iA5")
 * @query   limit (default: 50), skip (default: 0)
 * @returns Array of occupancy log entries with user and status change details
 */
exports.getBedHistory = async (req, res) => {
  try {
    const { bedId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200); // Max 200 records
    const skip = parseInt(req.query.skip) || 0;

    // Find bed by ID or bedId string
    let bed;
    if (mongoose.Types.ObjectId.isValid(bedId)) {
      bed = await Bed.findById(bedId);
    } else {
      bed = await Bed.findOne({ bedId: bedId });
    }

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }

    // Get occupancy history for this bed
    const [history, totalRecords] = await Promise.all([
      OccupancyLog.find({ bedId: bed._id })
        .populate('userId', 'name email role')
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      OccupancyLog.countDocuments({ bedId: bed._id })
    ]);

    res.status(200).json({
      success: true,
      data: {
        bed: {
          _id: bed._id,
          bedId: bed.bedId,
          ward: bed.ward,
          currentStatus: bed.status
        },
        history,
        pagination: {
          total: totalRecords,
          limit,
          skip,
          hasMore: skip + limit < totalRecords
        }
      }
    });
  } catch (error) {
    console.error('Get bed history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching bed history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get occupancy trends over time
 * @route   GET /api/analytics/occupancy-trends
 * @access  Public
 * @query   startDate (ISO string), endDate (ISO string), granularity ('hourly'|'daily'|'weekly', default: 'daily')
 * @returns Array of time series data points with occupancy metrics
 */
exports.getOccupancyTrends = async (req, res) => {
  try {
    const { startDate, endDate, granularity = 'daily' } = req.query;

    // Validate and parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const end = endDate ? new Date(endDate) : new Date();

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use ISO 8601 format (e.g., 2025-11-05T00:00:00Z)'
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be after end date'
      });
    }

    // Validate granularity
    const validGranularities = ['hourly', 'daily', 'weekly'];
    if (!validGranularities.includes(granularity)) {
      return res.status(400).json({
        success: false,
        message: `Invalid granularity. Must be one of: ${validGranularities.join(', ')}`
      });
    }

    // Determine grouping format based on granularity
    let dateFormat;
    if (granularity === 'hourly') {
      dateFormat = '%Y-%m-%d %H:00'; // Group by hour
    } else if (granularity === 'daily') {
      dateFormat = '%Y-%m-%d'; // Group by day
    } else if (granularity === 'weekly') {
      dateFormat = '%Y-W%V'; // Group by week
    }

    // Aggregate occupancy logs to get trends
    const trends = await OccupancyLog.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lte: end },
          statusChange: { $in: ['assigned', 'released', 'maintenance_start', 'maintenance_end'] }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$timestamp' } },
          count: { $sum: 1 },
          assignedCount: {
            $sum: { $cond: [{ $eq: ['$statusChange', 'assigned'] }, 1, 0] }
          },
          releasedCount: {
            $sum: { $cond: [{ $eq: ['$statusChange', 'released'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get total beds for context
    const totalBeds = await Bed.countDocuments({});

    res.status(200).json({
      success: true,
      data: {
        timeRange: {
          start: start.toISOString(),
          end: end.toISOString(),
          granularity
        },
        totalBeds,
        trends
      }
    });
  } catch (error) {
    console.error('Get occupancy trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching occupancy trends',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get forecasting data - predicted discharges and available beds
 * @route   GET /api/analytics/forecasting
 * @access  Public
 * @returns { expectedDischarges, availabilityForecast, insights, timeline }
 *
 * Enhanced implementation for Task 2.4:
 * - Calculates actual average length of stay from OccupancyLog
 * - Queries expected discharges based on patient admission times
 * - Provides timeline visualization data
 */
exports.getForecasting = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ===== 1. Calculate Average Length of Stay =====
    // Find all assigned/released pairs in last 30 days to calculate actual stay duration
    const occupancyLogs = await OccupancyLog.find({
      timestamp: { $gte: thirtyDaysAgo },
      statusChange: { $in: ['assigned', 'released'] }
    })
      .sort({ bedId: 1, timestamp: 1 })
      .lean();

    // Group logs by bedId and calculate stay durations
    const bedStays = {};
    const stayDurations = [];

    occupancyLogs.forEach(log => {
      if (!bedStays[log.bedId]) {
        bedStays[log.bedId] = [];
      }
      bedStays[log.bedId].push(log);
    });

    // Calculate duration for each stay (assigned -> released)
    Object.values(bedStays).forEach(logs => {
      for (let i = 0; i < logs.length - 1; i++) {
        if (logs[i].statusChange === 'assigned' && logs[i + 1].statusChange === 'released') {
          const durationMs = logs[i + 1].timestamp - logs[i].timestamp;
          const durationDays = durationMs / (1000 * 60 * 60 * 24);
          stayDurations.push(durationDays);
        }
      }
    });

    const averageLengthOfStay = stayDurations.length > 0
      ? stayDurations.reduce((sum, dur) => sum + dur, 0) / stayDurations.length
      : 3.5; // Default 3.5 days if no data

    // ===== 2. Get Current Occupancy and Expected Discharges =====
    const occupiedBeds = await Bed.find({ status: 'occupied' })
      .select('bedId ward patientName patientId updatedAt')
      .lean();

    const totalBeds = await Bed.countDocuments({});
    const currentlyOccupied = occupiedBeds.length;

    // Calculate expected discharge time for each occupied bed
    const expectedDischargesList = occupiedBeds.map(bed => {
      // Use updatedAt as proxy for admission time (when status changed to occupied)
      const admissionTime = bed.updatedAt;
      const expectedDischargeTime = new Date(
        admissionTime.getTime() + averageLengthOfStay * 24 * 60 * 60 * 1000
      );
      const hoursUntilDischarge = (expectedDischargeTime - now) / (1000 * 60 * 60);

      return {
        bedId: bed.bedId,
        ward: bed.ward,
        patientName: bed.patientName,
        patientId: bed.patientId,
        admissionTime: admissionTime,
        expectedDischargeTime: expectedDischargeTime,
        hoursUntilDischarge: Math.max(0, hoursUntilDischarge),
        daysInBed: (now - admissionTime) / (1000 * 60 * 60 * 24)
      };
    });

    // Sort by expected discharge time
    expectedDischargesList.sort((a, b) => a.expectedDischargeTime - b.expectedDischargeTime);

    // Count discharges by time window
    const dischargesNext24h = expectedDischargesList.filter(d => d.hoursUntilDischarge <= 24).length;
    const dischargesNext48h = expectedDischargesList.filter(d => d.hoursUntilDischarge <= 48).length;
    const dischargesNext72h = expectedDischargesList.filter(d => d.hoursUntilDischarge <= 72).length;

    // ===== 3. Get Ward-Level Statistics =====
    const wardStats = await Bed.aggregate([
      {
        $group: {
          _id: '$ward',
          totalBeds: { $sum: 1 },
          occupiedBeds: {
            $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] }
          },
          availableBeds: {
            $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Calculate ward-specific forecasts
    const wardForecasts = wardStats.map(ward => {
      const wardDischarges = expectedDischargesList.filter(d => d.ward === ward._id);
      const wardDischargesNext24h = wardDischarges.filter(d => d.hoursUntilDischarge <= 24).length;
      const wardDischargesNext48h = wardDischarges.filter(d => d.hoursUntilDischarge <= 48).length;

      return {
        ward: ward._id,
        totalBeds: ward.totalBeds,
        occupiedBeds: ward.occupiedBeds,
        availableBeds: ward.availableBeds,
        occupancyPercentage: Math.round((ward.occupiedBeds / ward.totalBeds) * 100),
        expectedDischarges: {
          next24Hours: wardDischargesNext24h,
          next48Hours: wardDischargesNext48h
        },
        projectedAvailability: {
          next24Hours: ward.availableBeds + wardDischargesNext24h,
          next48Hours: ward.availableBeds + wardDischargesNext48h
        }
      };
    });

    // ===== 4. Build Timeline Data =====
    // Create hourly buckets for next 72 hours
    const timelineBuckets = [];
    for (let i = 0; i < 72; i += 6) { // 6-hour intervals
      const bucketTime = new Date(now.getTime() + i * 60 * 60 * 1000);
      const bucketEndTime = new Date(now.getTime() + (i + 6) * 60 * 60 * 1000);
      
      const dischargesInBucket = expectedDischargesList.filter(
        d => d.expectedDischargeTime >= bucketTime && d.expectedDischargeTime < bucketEndTime
      );

      timelineBuckets.push({
        startTime: bucketTime,
        endTime: bucketEndTime,
        label: `${i}h - ${i + 6}h`,
        expectedDischarges: dischargesInBucket.length,
        beds: dischargesInBucket.map(d => ({
          bedId: d.bedId,
          ward: d.ward,
          patientId: d.patientId
        }))
      });
    }

    // ===== 5. Generate Insights =====
    const insights = [];
    
    if (currentlyOccupied / totalBeds > 0.9) {
      insights.push({
        type: 'warning',
        message: `High occupancy alert: ${Math.round((currentlyOccupied / totalBeds) * 100)}% of beds occupied`,
        priority: 'high'
      });
    }

    if (dischargesNext24h >= 3) {
      insights.push({
        type: 'info',
        message: `${dischargesNext24h} beds expected to be available in next 24 hours`,
        priority: 'medium'
      });
    }

    const criticalWards = wardForecasts.filter(w => w.occupancyPercentage > 90);
    if (criticalWards.length > 0) {
      insights.push({
        type: 'warning',
        message: `Critical capacity in ${criticalWards.map(w => w.ward).join(', ')}`,
        priority: 'high'
      });
    }

    // ===== Response =====
    res.status(200).json({
      success: true,
      data: {
        currentMetrics: {
          totalBeds,
          occupiedBeds: currentlyOccupied,
          availableBeds: totalBeds - currentlyOccupied,
          occupancyPercentage: Math.round((currentlyOccupied / totalBeds) * 100)
        },
        averageLengthOfStay: {
          days: Math.round(averageLengthOfStay * 10) / 10,
          basedOnSamples: stayDurations.length,
          note: `Calculated from ${stayDurations.length} patient stays in last 30 days`
        },
        expectedDischarges: {
          next24Hours: dischargesNext24h,
          next48Hours: dischargesNext48h,
          next72Hours: dischargesNext72h,
          total: expectedDischargesList.length,
          details: expectedDischargesList.slice(0, 10).map(d => ({
            bedId: d.bedId,
            ward: d.ward,
            patientId: d.patientId,
            expectedDischargeTime: d.expectedDischargeTime,
            hoursUntilDischarge: Math.round(d.hoursUntilDischarge * 10) / 10,
            daysInBed: Math.round(d.daysInBed * 10) / 10
          }))
        },
        wardForecasts,
        timeline: timelineBuckets,
        insights,
        metadata: {
          timestamp: now.toISOString(),
          forecastHorizon: '72 hours',
          calculationMethod: 'Average length of stay based on historical occupancy logs',
          disclaimer: 'Forecasting is based on historical trends and may not account for emergency admissions or unscheduled discharges'
        }
      }
    });
  } catch (error) {
    console.error('Get forecasting error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching forecasting data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get cleaning performance analytics
 * @route   GET /api/analytics/cleaning-performance
 * @access  Private (Manager, Hospital Admin)
 * @query   ward (optional), startDate, endDate, period (default: 7 days)
 */
exports.getCleaningPerformance = async (req, res) => {
  try {
    const { ward, startDate, endDate, period = 7 } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.startTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      // Default to last N days based on period
      const daysAgo = parseInt(period) || 7;
      dateFilter.startTime = {
        $gte: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
      };
    }
    
    // Build filter
    const filter = { ...dateFilter };
    
    // Apply ward filter for managers
    if (req.user.role === 'manager' && req.user.ward) {
      filter.ward = req.user.ward;
    } else if (ward) {
      filter.ward = ward;
    }
    
    // Get all cleaning logs
    const allCleanings = await CleaningLog.find(filter)
      .populate('assignedTo', 'name email')
      .populate('completedBy', 'name email')
      .sort({ startTime: -1 })
      .lean();
    
    // Filter completed cleanings for detailed stats
    const completedCleanings = allCleanings.filter(log => log.status === 'completed');
    const overdueCleanings = completedCleanings.filter(log => 
      log.actualDuration > log.estimatedDuration
    );
    const inProgressCleanings = allCleanings.filter(log => log.status === 'in_progress');
    
    // Calculate statistics
    const totalCleanings = allCleanings.length;
    const totalCompleted = completedCleanings.length;
    const totalOverdue = overdueCleanings.length;
    const totalInProgress = inProgressCleanings.length;
    
    // Average durations
    const avgActualDuration = completedCleanings.length > 0
      ? completedCleanings.reduce((sum, log) => sum + log.actualDuration, 0) / completedCleanings.length
      : 0;
    
    const avgEstimatedDuration = allCleanings.length > 0
      ? allCleanings.reduce((sum, log) => sum + log.estimatedDuration, 0) / allCleanings.length
      : 0;
    
    // Fastest and slowest cleanings
    const sortedByDuration = [...completedCleanings].sort((a, b) => a.actualDuration - b.actualDuration);
    const fastestCleaning = sortedByDuration[0] || null;
    const slowestCleaning = sortedByDuration[sortedByDuration.length - 1] || null;
    
    // Overdue rate
    const overdueRate = totalCompleted > 0
      ? Math.round((totalOverdue / totalCompleted) * 100)
      : 0;
    
    // On-time rate
    const onTimeRate = totalCompleted > 0
      ? Math.round(((totalCompleted - totalOverdue) / totalCompleted) * 100)
      : 0;
    
    // Group by ward
    const byWard = {};
    allCleanings.forEach(log => {
      if (!byWard[log.ward]) {
        byWard[log.ward] = {
          total: 0,
          completed: 0,
          overdue: 0,
          inProgress: 0,
          avgDuration: 0
        };
      }
      
      byWard[log.ward].total++;
      if (log.status === 'completed') {
        byWard[log.ward].completed++;
        if (log.actualDuration > log.estimatedDuration) {
          byWard[log.ward].overdue++;
        }
      } else if (log.status === 'in_progress') {
        byWard[log.ward].inProgress++;
      }
    });
    
    // Calculate average duration per ward
    Object.keys(byWard).forEach(wardName => {
      const wardCleanings = completedCleanings.filter(log => log.ward === wardName);
      if (wardCleanings.length > 0) {
        byWard[wardName].avgDuration = Math.round(
          wardCleanings.reduce((sum, log) => sum + log.actualDuration, 0) / wardCleanings.length
        );
      }
    });
    
    // Group by staff member (only for completed cleanings)
    const byStaff = {};
    completedCleanings.forEach(log => {
      if (log.completedBy) {
        const staffId = log.completedBy._id.toString();
        if (!byStaff[staffId]) {
          byStaff[staffId] = {
            name: log.completedBy.name || log.completedBy.email,
            email: log.completedBy.email,
            totalCompleted: 0,
            avgDuration: 0,
            overdue: 0
          };
        }
        
        byStaff[staffId].totalCompleted++;
        if (log.actualDuration > log.estimatedDuration) {
          byStaff[staffId].overdue++;
        }
      }
    });
    
    // Calculate average duration per staff
    Object.keys(byStaff).forEach(staffId => {
      const staffCleanings = completedCleanings.filter(log => 
        log.completedBy && log.completedBy._id.toString() === staffId
      );
      if (staffCleanings.length > 0) {
        byStaff[staffId].avgDuration = Math.round(
          staffCleanings.reduce((sum, log) => sum + log.actualDuration, 0) / staffCleanings.length
        );
      }
    });
    
    // Convert to array and sort by total completed (descending)
    const staffPerformance = Object.values(byStaff).sort((a, b) => b.totalCompleted - a.totalCompleted);
    
    // Daily breakdown
    const dailyStats = {};
    allCleanings.forEach(log => {
      const dateKey = new Date(log.startTime).toISOString().split('T')[0];
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          date: dateKey,
          total: 0,
          completed: 0,
          overdue: 0,
          inProgress: 0
        };
      }
      
      dailyStats[dateKey].total++;
      if (log.status === 'completed') {
        dailyStats[dateKey].completed++;
        if (log.actualDuration > log.estimatedDuration) {
          dailyStats[dateKey].overdue++;
        }
      } else if (log.status === 'in_progress') {
        dailyStats[dateKey].inProgress++;
      }
    });
    
    // Convert to array and sort by date (ascending)
    const dailyBreakdown = Object.values(dailyStats).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
    
    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalCleanings,
          totalCompleted,
          totalOverdue,
          totalInProgress,
          overdueRate,
          onTimeRate,
          avgActualDuration: Math.round(avgActualDuration),
          avgEstimatedDuration: Math.round(avgEstimatedDuration)
        },
        performance: {
          fastestCleaning: fastestCleaning ? {
            bedId: fastestCleaning.bedId,
            ward: fastestCleaning.ward,
            duration: fastestCleaning.actualDuration,
            completedBy: fastestCleaning.completedBy?.name || 'Unknown'
          } : null,
          slowestCleaning: slowestCleaning ? {
            bedId: slowestCleaning.bedId,
            ward: slowestCleaning.ward,
            duration: slowestCleaning.actualDuration,
            completedBy: slowestCleaning.completedBy?.name || 'Unknown'
          } : null
        },
        byWard,
        staffPerformance,
        dailyBreakdown,
        recentCleanings: allCleanings.slice(0, 10) // Last 10 cleanings
      }
    });
  } catch (error) {
    console.error('Get cleaning performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching cleaning performance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

