// backend/controllers/analyticsController.js
// Analytics controller for hospital bed metrics and reporting

const Bed = require('../models/Bed');
const OccupancyLog = require('../models/OccupancyLog');
const CleaningLog = require('../models/CleaningLog');
const mongoose = require('mongoose');
const {
  DAY_MS,
  getBedsInScope,
  buildOccupancyPoints,
  summarizeOccupancy,
  splitPeriods,
  getStaysAndTurnarounds
} = require('../services/occupancyHistory');
const { getAverageStayHours } = require('../services/historicalAverages');
const { estimateDischarge } = require('../services/predictionService');

/**
 * @desc    Get occupancy summary for all beds with week-over-week comparison
 * @route   GET /api/analytics/occupancy-summary
 * @access  Public
 * @returns { totalBeds, occupiedBeds, availableBeds, cleaningBeds, occupancyRate, weekOverWeek }
 */
exports.getOccupancySummary = async (req, res) => {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * DAY_MS);

    // Count beds by status (only 3 statuses now: available, cleaning, occupied)
    const beds = await getBedsInScope();
    const totalBeds = beds.length;
    const occupied = beds.filter((bed) => bed.status === 'occupied').length;
    const available = beds.filter((bed) => bed.status === 'available').length;
    const cleaning = beds.filter((bed) => bed.status === 'cleaning').length;

    // Calculate occupancy percentage
    const occupancyPercentage = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;

    // Occupied beds 7 days ago, rebuilt from recorded assignments and releases
    // (unknown when recorded history does not reach back that far)
    const { points, historyStart } = await buildOccupancyPoints(beds, oneWeekAgo, now);
    const occupiedWeekAgo = historyStart && historyStart <= oneWeekAgo ? points[0].occupied : null;

    const occupiedChange = occupiedWeekAgo === null ? null : occupied - occupiedWeekAgo;
    const occupancyRateChange = occupiedWeekAgo === null || totalBeds === 0
      ? null
      : occupancyPercentage - Math.round((occupiedWeekAgo / totalBeds) * 100);

    res.status(200).json({
      success: true,
      totalBeds,
      occupiedBeds: occupied,
      availableBeds: available,
      cleaningBeds: cleaning,
      occupancyRate: occupancyPercentage,
      // Changes vs 7 days ago. Bed additions/removals and past cleaning states are not
      // reconstructed, so those changes are unknown (null), as is anything before recorded history
      weekOverWeek: {
        totalBedsChange: null,
        occupiedChange,
        availableChange: null,
        occupancyRateChange: occupancyRateChange === null
          ? null
          : `${occupancyRateChange >= 0 ? '+' : ''}${occupancyRateChange}%`,
        historyStart
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
 * @returns Array of { ward, totalBeds, occupied, available, cleaning, occupancyPercentage }
 */
exports.getOccupancyByWard = async (req, res) => {
  try {
    const { ward } = req.query;

    // If specific ward is requested, return data for that ward only
    if (ward) {
      const [totalBeds, occupied, available, cleaning] = await Promise.all([
        Bed.countDocuments({ ward }),
        Bed.countDocuments({ ward, status: 'occupied' }),
        Bed.countDocuments({ ward, status: 'available' }),
        Bed.countDocuments({ ward, status: 'cleaning' })
      ]);

      const occupancyRate = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;

      return res.status(200).json({
        success: true,
        totalBeds,
        occupiedBeds: occupied,
        availableBeds: available,
        cleaningBeds: cleaning,
        occupancyRate
      });
    }

    // Get all unique wards
    const wards = await Bed.distinct('ward');

    // For each ward, get the count of beds by status
    const wardData = await Promise.all(
      wards.map(async (ward) => {
        const [totalBeds, occupied, available, cleaning] = await Promise.all([
          Bed.countDocuments({ ward }),
          Bed.countDocuments({ ward, status: 'occupied' }),
          Bed.countDocuments({ ward, status: 'available' }),
          Bed.countDocuments({ ward, status: 'cleaning' })
        ]);

        const occupancyPercentage = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;

        return {
          ward,
          totalBeds,
          occupied,
          available,
          cleaning,
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
 * @access  Private (managers only see their own ward)
 * @returns { currentMetrics, averageLengthOfStay, expectedDischarges, manualDischarges, aiDischarges, wardForecasts, timeline, insights }
 *
 * Enhanced implementation for Task 2.4:
 * - Calculates actual average length of stay from OccupancyLog
 * - Queries expected discharges based on patient admission times
 * - Provides timeline visualization data
 */
exports.getForecasting = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
    const HOUR_MS = 60 * 60 * 1000;

    // Determine ward filter based on user role
    const userRole = req.user?.role || 'unknown';
    const userWard = req.user?.ward;
    let wardFilter = {};

    // Managers can only see their ward's data (if ward is set)
    if (userRole === 'manager' && userWard) {
      wardFilter.ward = userWard;
    }
    // hospital_admin, er_staff, technical_team, and managers without ward can see all wards

    const beds = await getBedsInScope(wardFilter.ward ? [wardFilter.ward] : []);
    const totalBeds = beds.length;
    const countStatus = (list, status) => list.filter((bed) => bed.status === status).length;

    // ===== 1. Average Length of Stay =====
    // Completed stays (assigned -> released) that ended in the last 30 days
    const { stayHours } = await getStaysAndTurnarounds(beds, thirtyDaysAgo, now);
    const averageLengthOfStay = stayHours.length > 0
      ? stayHours.reduce((sum, hours) => sum + hours, 0) / stayHours.length / 24
      : null;

    // ===== 2. Get Current Occupancy and Expected Discharges =====
    const occupiedBeds = await Bed.find({ status: 'occupied', ...wardFilter })
      .select('bedId ward patientName patientId estimatedDischargeTime')
      .lean();
    const currentlyOccupied = occupiedBeds.length;
    const currentlyAvailable = countStatus(beds, 'available');

    // Each patient's admission time is the bed's most recent recorded assignment
    const admissions = await OccupancyLog.aggregate([
      { $match: { bedId: { $in: occupiedBeds.map((bed) => bed._id) }, statusChange: 'assigned' } },
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$bedId', admittedAt: { $first: '$timestamp' } } }
    ]);
    const admittedAtByBed = new Map(admissions.map((admission) => [admission._id.toString(), admission.admittedAt]));

    // Ward average stays are only needed when the ML service is unavailable (loaded once per ward)
    const averageStays = new Map();
    const getAverageStay = (ward) => {
      if (!averageStays.has(ward)) averageStays.set(ward, getAverageStayHours(ward));
      return averageStays.get(ward);
    };

    // Manager-set discharge times take priority; other beds are estimated from their admission time
    const manualDischargesList = [];
    const aiDischargesList = [];
    let withoutEstimateCount = 0;

    await Promise.all(occupiedBeds.map(async (bed) => {
      const admissionTime = admittedAtByBed.get(bed._id.toString()) || null;
      const discharge = {
        bedId: bed.bedId,
        ward: bed.ward,
        patientName: bed.patientName,
        patientId: bed.patientId,
        admissionTime,
        daysInBed: admissionTime ? (now - admissionTime) / DAY_MS : null
      };

      if (bed.estimatedDischargeTime) {
        const expectedDischargeTime = new Date(bed.estimatedDischargeTime);
        manualDischargesList.push({
          ...discharge,
          expectedDischargeTime,
          hoursUntilDischarge: Math.max(0, (expectedDischargeTime - now) / HOUR_MS),
          isManuallySet: true
        });
        return;
      }

      // ML prediction, or the ward's recorded average stay when the ML service is unavailable
      const estimate = admissionTime
        ? await estimateDischarge(bed.ward, admissionTime, { now, getAverageStay })
        : null;
      if (!estimate) {
        withoutEstimateCount++;
        return;
      }
      aiDischargesList.push({
        ...discharge,
        expectedDischargeTime: estimate.estimated_discharge_time,
        hoursUntilDischarge: Math.max(0, estimate.hours_remaining),
        source: estimate.source,
        isManuallySet: false
      });
    }));

    // Sort by expected discharge time
    const byExpectedTime = (a, b) => a.expectedDischargeTime - b.expectedDischargeTime;
    manualDischargesList.sort(byExpectedTime);
    aiDischargesList.sort(byExpectedTime);
    const expectedDischargesList = [...manualDischargesList, ...aiDischargesList].sort(byExpectedTime);

    // Count discharges by time window
    const countWithin = (list, hours) => list.filter((d) => d.hoursUntilDischarge <= hours).length;
    const dischargesNext24h = countWithin(expectedDischargesList, 24);
    const dischargesNext48h = countWithin(expectedDischargesList, 48);
    const dischargesNext72h = countWithin(expectedDischargesList, 72);

    // ===== 3. Get Ward-Level Statistics =====
    const wardNames = [...new Set(beds.map((bed) => bed.ward))].sort();
    const wardForecasts = wardNames.map((ward) => {
      const wardBeds = beds.filter((bed) => bed.ward === ward);
      const occupied = countStatus(wardBeds, 'occupied');
      const available = countStatus(wardBeds, 'available');
      const wardDischarges = expectedDischargesList.filter((d) => d.ward === ward);
      const wardDischargesNext24h = countWithin(wardDischarges, 24);
      const wardDischargesNext48h = countWithin(wardDischarges, 48);

      return {
        ward,
        totalBeds: wardBeds.length,
        occupiedBeds: occupied,
        availableBeds: available,
        occupancyPercentage: Math.round((occupied / wardBeds.length) * 100),
        expectedDischarges: {
          next24Hours: wardDischargesNext24h,
          next48Hours: wardDischargesNext48h
        },
        projectedAvailability: {
          next24Hours: available + wardDischargesNext24h,
          next48Hours: available + wardDischargesNext48h
        }
      };
    });

    // ===== 4. Build Timeline Data =====
    // 6-hour buckets for the next 72 hours (patients already past their estimate count in the first bucket)
    const timelineBuckets = [];
    for (let i = 0; i < 72; i += 6) {
      const bucketTime = new Date(now.getTime() + i * HOUR_MS);
      const bucketEndTime = new Date(now.getTime() + (i + 6) * HOUR_MS);

      const dischargesInBucket = expectedDischargesList.filter(
        (d) => d.expectedDischargeTime < bucketEndTime && (i === 0 || d.expectedDischargeTime >= bucketTime)
      );

      timelineBuckets.push({
        startTime: bucketTime,
        endTime: bucketEndTime,
        label: `${i}h - ${i + 6}h`,
        expectedDischarges: dischargesInBucket.length,
        beds: dischargesInBucket.map((d) => ({
          bedId: d.bedId,
          ward: d.ward,
          patientId: d.patientId
        }))
      });
    }

    // ===== 5. Generate Insights =====
    const insights = [];
    const manuallySetCount = manualDischargesList.length;
    const estimatedCount = aiDischargesList.length;

    if (totalBeds > 0 && currentlyOccupied / totalBeds > 0.9) {
      insights.push({
        type: 'warning',
        message: `High occupancy alert: ${Math.round((currentlyOccupied / totalBeds) * 100)}% of beds occupied`,
        priority: 'high'
      });
    }

    if (dischargesNext24h >= 3) {
      const manualNext24h = countWithin(manualDischargesList, 24);
      insights.push({
        type: 'info',
        message: `${dischargesNext24h} beds expected to be available in next 24 hours (${manualNext24h} confirmed, ${dischargesNext24h - manualNext24h} estimated)`,
        priority: 'medium'
      });
    }

    if (estimatedCount > manuallySetCount && currentlyOccupied > 5) {
      insights.push({
        type: 'warning',
        message: `${estimatedCount} of ${currentlyOccupied} occupied beds using estimated discharge times. Set accurate discharge times for better forecasting.`,
        priority: 'medium'
      });
    }

    if (withoutEstimateCount > 0) {
      insights.push({
        type: 'warning',
        message: `${withoutEstimateCount} occupied bed(s) have no discharge estimate (no recorded admission, or the ML service is unavailable and no stays are recorded for the ward)`,
        priority: 'medium'
      });
    }

    const criticalWards = wardForecasts.filter((w) => w.occupancyPercentage > 90);
    if (criticalWards.length > 0) {
      insights.push({
        type: 'warning',
        message: `Critical capacity in ${criticalWards.map((w) => w.ward).join(', ')}`,
        priority: 'high'
      });
    }

    const formatDischarge = (d) => ({
      bedId: d.bedId,
      ward: d.ward,
      patientId: d.patientId,
      patientName: d.patientName,
      admissionTime: d.admissionTime,
      expectedDischargeTime: d.expectedDischargeTime,
      hoursUntilDischarge: Math.round(d.hoursUntilDischarge * 10) / 10,
      isOverdue: d.expectedDischargeTime < now,
      daysInBed: d.daysInBed === null ? null : Math.round(d.daysInBed * 10) / 10,
      isManuallySet: d.isManuallySet,
      source: d.isManuallySet ? 'manager' : d.source
    });
    const summarizeDischarges = (list) => ({
      total: list.length,
      next24Hours: countWithin(list, 24),
      next48Hours: countWithin(list, 48),
      next72Hours: countWithin(list, 72),
      details: list.slice(0, 100).map(formatDischarge)
    });

    // ===== Response =====
    res.status(200).json({
      success: true,
      data: {
        currentMetrics: {
          totalBeds,
          occupiedBeds: currentlyOccupied,
          availableBeds: currentlyAvailable,
          cleaningBeds: countStatus(beds, 'cleaning'),
          occupancyPercentage: totalBeds > 0 ? Math.round((currentlyOccupied / totalBeds) * 100) : 0
        },
        averageLengthOfStay: {
          days: averageLengthOfStay === null ? null : Math.round(averageLengthOfStay * 10) / 10,
          hours: averageLengthOfStay === null ? null : Math.round(averageLengthOfStay * 24 * 10) / 10,
          basedOnSamples: stayHours.length,
          sessionsAnalyzed: stayHours.length,
          note: stayHours.length > 0
            ? `Calculated from ${stayHours.length} patient stays that ended in the last 30 days`
            : 'No completed patient stays recorded in the last 30 days'
        },
        expectedDischarges: {
          ...summarizeDischarges(expectedDischargesList),
          manuallySet: manuallySetCount,
          estimated: estimatedCount,
          withoutEstimate: withoutEstimateCount
        },
        // Separate manual and estimated discharge lists for toggle functionality
        manualDischarges: summarizeDischarges(manualDischargesList),
        aiDischarges: summarizeDischarges(aiDischargesList),
        wardForecasts,
        timeline: timelineBuckets,
        insights,
        metadata: {
          timestamp: now.toISOString(),
          forecastHorizon: '72 hours',
          calculationMethod: 'Manager-set discharge times where available; otherwise ML predictions from each patient\'s recorded admission time (the ward\'s recorded average stay when the ML service is unavailable)',
          disclaimer: 'Forecasts prioritize manager-set discharge times when available. Estimates may not account for emergency admissions or unscheduled discharges.',
          accuracyNote: `${manuallySetCount} beds have confirmed discharge times, ${estimatedCount} use estimates, ${withoutEstimateCount} have no estimate`,
          filteredByWard: wardFilter.ward || null,
          userRole: userRole,
          scope: wardFilter.ward ? `Data filtered for ${wardFilter.ward} ward only` : 'Hospital-wide data'
        }
      }
    });
  } catch (error) {
    console.error('Get forecasting error:', error);
    console.error('User info:', req.user ? { role: req.user.role, ward: req.user.ward, id: req.user._id } : 'No user');
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

/**
 * @desc    Get occupancy history with date range and granularity
 * @route   GET /api/analytics/occupancy-history
 * @access  Public
 * @query   startDate (ISO string), endDate (ISO string), wardFilter (string), granularity ('hourly'|'daily'|'weekly', default: 'daily')
 * @returns Time series data of occupancy changes aggregated from OccupancyLog
 */
exports.getOccupancyHistory = async (req, res) => {
  try {
    const { startDate, endDate, wardFilter, granularity = 'daily' } = req.query;

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use ISO 8601 format (e.g., 2025-11-01T00:00:00Z)'
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
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
      dateFormat = '%Y-%m-%d %H:00';
    } else if (granularity === 'daily') {
      dateFormat = '%Y-%m-%d';
    } else if (granularity === 'weekly') {
      dateFormat = '%Y-W%V';
    }

    // Build aggregation pipeline
    const matchStage = {
      timestamp: { $gte: start, $lte: end }
    };

    // Add ward filter if provided
    if (wardFilter) {
      const bedsInWard = await Bed.find({ ward: wardFilter }).distinct('_id');
      matchStage.bedId = { $in: bedsInWard };
    }

    const history = await OccupancyLog.aggregate([
      {
        $match: matchStage
      },
      {
        $lookup: {
          from: 'beds',
          localField: 'bedId',
          foreignField: '_id',
          as: 'bedDetails'
        }
      },
      {
        $unwind: { path: '$bedDetails', preserveNullAndEmptyArrays: true }
      },
      {
        $group: {
          _id: {
            timePeriod: { $dateToString: { format: dateFormat, date: '$timestamp' } },
            ward: '$bedDetails.ward'
          },
          totalChanges: { $sum: 1 },
          assignedCount: {
            $sum: { $cond: [{ $eq: ['$statusChange', 'assigned'] }, 1, 0] }
          },
          releasedCount: {
            $sum: { $cond: [{ $eq: ['$statusChange', 'released'] }, 1, 0] }
          },
          maintenanceStartCount: {
            $sum: { $cond: [{ $eq: ['$statusChange', 'maintenance_start'] }, 1, 0] }
          },
          maintenanceEndCount: {
            $sum: { $cond: [{ $eq: ['$statusChange', 'maintenance_end'] }, 1, 0] }
          },
          reservedCount: {
            $sum: { $cond: [{ $eq: ['$statusChange', 'reserved'] }, 1, 0] }
          },
          reservationCancelledCount: {
            $sum: { $cond: [{ $eq: ['$statusChange', 'reservation_cancelled'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { '_id.timePeriod': 1, '_id.ward': 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        timeRange: {
          start: start.toISOString(),
          end: end.toISOString(),
          granularity
        },
        wardFilter: wardFilter || 'all',
        history
      }
    });
  } catch (error) {
    console.error('Get occupancy history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching occupancy history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get ward utilization with detailed metrics
 * @route   GET /api/analytics/ward-utilization
 * @access  Public
 * @returns Detailed ward-level metrics aggregated from OccupancyLog and Bed data
 */
exports.getWardUtilization = async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

    // Get all unique wards
    const wards = await Bed.distinct('ward');

    // For each ward, calculate detailed metrics
    const utilizationData = await Promise.all(
      wards.map(async (ward) => {
        // Current bed status counts
        const beds = await getBedsInScope([ward]);
        const totalBeds = beds.length;
        const occupied = beds.filter((bed) => bed.status === 'occupied').length;
        const available = beds.filter((bed) => bed.status === 'available').length;
        const cleaning = beds.filter((bed) => bed.status === 'cleaning').length;

        // Calculate occupancy percentage
        const occupancyPercentage = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0;

        // Status changes recorded in the last 7 days
        const recentLogs = await OccupancyLog.find({
          bedId: { $in: beds.map((bed) => bed._id) },
          timestamp: { $gte: sevenDaysAgo, $lte: now }
        })
          .select('statusChange')
          .lean();
        const countChanges = (...changes) => recentLogs.filter((log) => changes.includes(log.statusChange)).length;

        // Average turnaround: time from a release to the bed's next assignment
        const { turnaroundHours } = await getStaysAndTurnarounds(beds, sevenDaysAgo, now);
        const avgTurnAroundTime = turnaroundHours.length > 0
          ? Math.round((turnaroundHours.reduce((sum, hours) => sum + hours, 0) / turnaroundHours.length) * 10) / 10
          : null;

        return {
          ward,
          totalBeds,
          currentStatus: {
            occupied,
            available,
            cleaning
          },
          occupancyPercentage,
          last7Days: {
            totalStatusChanges: recentLogs.length,
            turnoverCount: countChanges('assigned', 'released'),
            avgTurnAroundTimeHours: avgTurnAroundTime,
            assignedCount: countChanges('assigned'),
            releasedCount: countChanges('released'),
            maintenanceEvents: countChanges('maintenance_start', 'maintenance_end')
          }
        };
      })
    );

    // Sort by occupancy percentage descending
    utilizationData.sort((a, b) => b.occupancyPercentage - a.occupancyPercentage);

    res.status(200).json({
      success: true,
      data: {
        totalWards: wards.length,
        utilization: utilizationData
      }
    });
  } catch (error) {
    console.error('Get ward utilization error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching ward utilization',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get peak demand analysis with seasonal patterns and projections
 * @route   GET /api/analytics/peak-demand-analysis
 * @access  Public
 * @returns Peak demand patterns, seasonal trends, and projections from OccupancyLog
 */
exports.getPeakDemandAnalysis = async (req, res) => {
  try {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Aggregate occupancy logs by hour of day and day of week
    const hourlyPattern = await OccupancyLog.aggregate([
      {
        $match: {
          timestamp: { $gte: ninetyDaysAgo },
          statusChange: 'assigned'
        }
      },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Aggregate by day of week
    const dayOfWeekPattern = await OccupancyLog.aggregate([
      {
        $match: {
          timestamp: { $gte: ninetyDaysAgo },
          statusChange: 'assigned'
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: '$timestamp' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    // Map day numbers to names
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeekData = dayOfWeekPattern.map(item => ({
      day: dayNames[item._id - 1],
      dayNumber: item._id,
      admissionCount: item.count
    }));

    // Find peak hours and days
    const peakHour = hourlyPattern.reduce((max, item) => item.count > max.count ? item : max, { _id: 0, count: 0 });
    const peakDay = dayOfWeekPattern.reduce((max, item) => item.count > max.count ? item : max, { _id: 0, count: 0 });

    // Calculate monthly trends for seasonal patterns
    const monthlyTrends = await OccupancyLog.aggregate([
      {
        $match: {
          timestamp: { $gte: ninetyDaysAgo },
          statusChange: 'assigned'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' }
          },
          admissionCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Calculate average daily admissions
    const totalAssignments = await OccupancyLog.countDocuments({
      timestamp: { $gte: ninetyDaysAgo },
      statusChange: 'assigned'
    });
    const avgDailyAdmissions = Math.round((totalAssignments / 90) * 10) / 10;

    // Project next 7 days based on day-of-week pattern
    const projections = [];
    for (let i = 0; i < 7; i++) {
      const projectedDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const dayOfWeek = projectedDate.getDay() + 1; // MongoDB uses 1-7, JS uses 0-6
      const dayPattern = dayOfWeekPattern.find(d => d._id === dayOfWeek) || { count: 0 };
      const projectedAdmissions = Math.round((dayPattern.count / 90) * 7); // Scale to expected daily count

      projections.push({
        date: projectedDate.toISOString().split('T')[0],
        dayOfWeek: dayNames[projectedDate.getDay()],
        projectedAdmissions
      });
    }

    // Calculate current total beds for capacity planning
    const totalBeds = await Bed.countDocuments({});
    const currentOccupied = await Bed.countDocuments({ status: 'occupied' });
    const currentOccupancyRate = totalBeds > 0 ? Math.round((currentOccupied / totalBeds) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        analysisWindow: {
          start: ninetyDaysAgo.toISOString(),
          end: now.toISOString(),
          days: 90
        },
        currentCapacity: {
          totalBeds,
          occupied: currentOccupied,
          available: totalBeds - currentOccupied,
          occupancyRate: currentOccupancyRate
        },
        peakDemand: {
          peakHour: {
            hour: peakHour._id,
            timeRange: `${peakHour._id}:00 - ${peakHour._id + 1}:00`,
            admissionCount: peakHour.count
          },
          peakDay: {
            day: dayNames[peakDay._id - 1],
            admissionCount: peakDay.count
          },
          avgDailyAdmissions
        },
        patterns: {
          hourlyDistribution: hourlyPattern.map(item => ({
            hour: item._id,
            timeRange: `${item._id}:00 - ${item._id + 1}:00`,
            admissionCount: item.count
          })),
          dayOfWeekDistribution: dayOfWeekData
        },
        seasonalTrends: {
          monthlyData: monthlyTrends.map(item => ({
            year: item._id.year,
            month: item._id.month,
            monthName: new Date(item._id.year, item._id.month - 1).toLocaleString('default', { month: 'long' }),
            admissionCount: item.admissionCount
          }))
        },
        projections: {
          next7Days: projections,
          methodology: 'Based on historical day-of-week admission patterns from last 90 days'
        }
      }
    });
  } catch (error) {
    console.error('Get peak demand analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching peak demand analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Occupancy over time, reconstructed from recorded bed assignments and releases
 * @route   GET /api/analytics/occupancy-timeline
 * @access  Private (Manager, Hospital Admin)
 * @query   range ('7days' | '30days' | '90days', default: '7days'), ward (optional)
 * @returns Time-weighted average, peak and lowest occupancy per period, plus the previous period for comparison
 */
exports.getOccupancyTimeline = async (req, res) => {
  try {
    const RANGES = {
      '7days': { days: 7, periods: 7 },
      '30days': { days: 30, periods: 6 },
      '90days': { days: 90, periods: 9 }
    };
    const { range = '7days', ward } = req.query;
    const config = RANGES[range];

    if (!config) {
      return res.status(400).json({
        success: false,
        message: `Invalid range. Must be one of: ${Object.keys(RANGES).join(', ')}`
      });
    }

    // Managers only see their own ward
    const scopedWard = req.user.role === 'manager' && req.user.ward ? req.user.ward : ward;
    const beds = await getBedsInScope(scopedWard ? [scopedWard] : []);

    const now = new Date();
    const start = new Date(now.getTime() - config.days * DAY_MS);
    const previousStart = new Date(start.getTime() - config.days * DAY_MS);

    const { points, historyStart } = await buildOccupancyPoints(beds, previousStart, now);
    const periods = summarizeOccupancy(points, splitPeriods(start, now, config.periods), beds.length, historyStart);
    const [previousSummary, summary] = summarizeOccupancy(
      points,
      [{ start: previousStart, end: start }, { start, end: now }],
      beds.length,
      historyStart
    );

    res.status(200).json({
      success: true,
      data: {
        range,
        ward: scopedWard || null,
        totalBeds: beds.length,
        periods,
        summary,
        previousSummary,
        historyStart,
        method: 'Reconstructed from recorded bed assignments and releases'
      }
    });
  } catch (error) {
    console.error('Get occupancy timeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching occupancy timeline',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

