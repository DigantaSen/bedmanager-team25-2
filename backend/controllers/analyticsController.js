// backend/controllers/analyticsController.js
// Analytics controller for hospital bed metrics and reporting

const Bed = require('../models/Bed');
const OccupancyLog = require('../models/OccupancyLog');
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
 * @returns { expectedDischarges, availabilityForecast, insights }
 *
 * NOTE: This is a placeholder implementation that provides basic statistics.
 * Full forecasting would require ML models or external scheduling system integration.
 */
exports.getForecasting = async (req, res) => {
  try {
    // Get current occupancy snapshot
    const occupiedBeds = await Bed.find({ status: 'occupied' })
      .populate('patientName', 'bedId ward patientName patientId createdAt')
      .lean();

    const totalBeds = await Bed.countDocuments({});
    const currentlyOccupied = occupiedBeds.length;

    // Calculate average length of stay (from occupancy logs)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stayAnalysis = await OccupancyLog.aggregate([
      {
        $match: {
          timestamp: { $gte: thirtyDaysAgo },
          statusChange: { $in: ['released'] }
        }
      },
      {
        $group: {
          _id: '$bedId',
          releaseCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: null,
          averageReleases: { $avg: '$releaseCount' },
          totalReleases: { $sum: '$releaseCount' }
        }
      }
    ]);

    const averageLengthOfStay = stayAnalysis.length > 0
      ? Math.round((30 / stayAnalysis[0].totalReleases) * 100) / 100 // Days per release
      : 3; // Default estimate

    // Get ward-level statistics
    const wardStats = await Bed.aggregate([
      {
        $group: {
          _id: '$ward',
          totalBeds: { $sum: 1 },
          occupiedBeds: {
            $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          availableBeds: { $subtract: ['$totalBeds', '$occupiedBeds'] }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Simple forecast: estimate discharges in next 24-72 hours based on average LOS
    const expectedDischarges = Math.round(currentlyOccupied / (averageLengthOfStay || 3));

    res.status(200).json({
      success: true,
      data: {
        currentMetrics: {
          totalBeds,
          occupiedBeds: currentlyOccupied,
          availableBeds: totalBeds - currentlyOccupied,
          occupancyPercentage: Math.round((currentlyOccupied / totalBeds) * 100)
        },
        expectedDischarges: {
          next24Hours: Math.ceil(expectedDischarges / 3),
          next48Hours: Math.ceil(expectedDischarges / 1.5),
          next72Hours: expectedDischarges,
          note: 'Based on average length of stay estimates'
        },
        averageLengthOfStay: {
          days: averageLengthOfStay,
          note: 'Average length of stay (last 30 days)'
        },
        wardForecast: wardStats.map(ward => ({
          ward: ward._id,
          totalBeds: ward.totalBeds,
          occupiedBeds: ward.occupiedBeds,
          availableBeds: ward.availableBeds,
          occupancyPercentage: Math.round((ward.occupiedBeds / ward.totalBeds) * 100),
          predictedDischarges: Math.max(1, Math.ceil(ward.occupiedBeds / (averageLengthOfStay || 3)))
        })),
        timestamp: new Date().toISOString(),
        disclaimer: 'Forecasting is based on historical trends and may not account for emergency admissions or unscheduled discharges'
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
