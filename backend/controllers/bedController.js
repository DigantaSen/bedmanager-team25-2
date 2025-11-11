// backend/controllers/bedController.js
const Bed = require('../models/Bed');
const OccupancyLog = require('../models/OccupancyLog');
const Alert = require('../models/Alert');
const mongoose = require('mongoose');
const { AppError } = require('../middleware/errorHandler');

/**
 * @desc    Get all beds with optional filtering
 * @route   GET /api/beds
 * @access  Public
 * @query   status, ward
 */
exports.getAllBeds = async (req, res) => {
  try {
    const { status, ward } = req.query;
    
    // Build filter object
    const filter = {};
    if (status) {
      // Validate status
      const validStatuses = ['available', 'occupied', 'maintenance', 'reserved'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
      filter.status = status;
    }
    if (ward) {
      filter.ward = ward;
    }

    // Fetch beds
    const beds = await Bed.find(filter)
      .sort({ ward: 1, bedId: 1 });

    res.status(200).json({
      success: true,
      count: beds.length,
      data: { beds }
    });
  } catch (error) {
    console.error('Get all beds error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching beds',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get single bed by ID
 * @route   GET /api/beds/:id
 * @access  Public
 * @param   id - MongoDB ObjectId or bedId (e.g., "BED-101")
 */
exports.getBedById = async (req, res) => {
  try {
    const { id } = req.params;
    let bed;

    // Check if id is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      bed = await Bed.findById(id);
    } else {
      // Try to find by bedId (e.g., "iA5", "BED-101")
      bed = await Bed.findOne({ bedId: id });
    }

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { bed }
    });
  } catch (error) {
    console.error('Get bed by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching bed details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update bed status
 * @route   PATCH /api/beds/:id/status
 * @access  Private (Requires JWT)
 * @param   id - MongoDB ObjectId or bedId
 * @body    status, patientName, patientId (optional - external patient identifier)
 */
exports.updateBedStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, patientName, patientId } = req.body;

    // Validate status
    const validStatuses = ['available', 'occupied', 'maintenance', 'reserved'];
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find bed
    let bed;
    if (mongoose.Types.ObjectId.isValid(id)) {
      bed = await Bed.findById(id);
    } else {
      bed = await Bed.findOne({ bedId: id });
    }

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }

    // Validate patient info for occupied status
    if (status === 'occupied' && !patientName && !patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient name or ID is required when marking bed as occupied'
      });
    }

    // Store previous status for logging
    const previousStatus = bed.status;

    // Update bed
    bed.status = status;
    bed.patientName = status === 'occupied' ? (patientName || null) : null;
    bed.patientId = status === 'occupied' ? (patientId || null) : null;
    await bed.save();

    // Determine status change type for logging
    let statusChangeType;
    if (status === 'occupied') {
      statusChangeType = 'assigned';
    } else if (previousStatus === 'occupied' && status === 'available') {
      statusChangeType = 'released';
    } else if (status === 'maintenance') {
      statusChangeType = 'maintenance_start';
    } else if (previousStatus === 'maintenance' && status === 'available') {
      statusChangeType = 'maintenance_end';
    } else if (status === 'reserved') {
      statusChangeType = 'reserved';
    } else if (previousStatus === 'reserved' && status === 'available') {
      statusChangeType = 'reservation_cancelled';
    } else {
      // Default to assigned for any other transitions
      statusChangeType = 'assigned';
    }

    // Create occupancy log entry
    try {
      console.log('Creating log - User ID:', req.user._id, 'Bed ID:', bed._id);
      await OccupancyLog.create({
        bedId: bed._id,
        userId: req.user._id, // User who made the change (from JWT)
        statusChange: statusChangeType,
        timestamp: new Date()
      });
      console.log('✅ Occupancy log created successfully');
    } catch (logError) {
      console.error('Error creating occupancy log:', logError);
      // Continue even if logging fails - don't block the main operation
    }

    // Emit bedUpdate event via socket.io
    if (req.io) {
      req.io.emit('bedUpdate', {
        bed: bed.toObject(),
        previousStatus,
        timestamp: new Date()
      });
      console.log('✅ bedUpdate event emitted via socket.io');
    }

    // Check occupancy and trigger alerts if > 90%
    await checkOccupancyAndCreateAlerts(bed.ward, req.io);

    res.status(200).json({
      success: true,
      message: `Bed status updated to ${status}`,
      data: { bed }
    });
  } catch (error) {
    console.error('Update bed status error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error updating bed status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Helper function to check occupancy levels and create alerts
 * @param {String} ward - Ward to check (ICU, General, Emergency)
 * @param {Object} io - Socket.io instance
 */
const checkOccupancyAndCreateAlerts = async (ward, io) => {
  try {
    // Get total and occupied beds for this ward
    const totalBeds = await Bed.countDocuments({ ward });
    const occupiedBeds = await Bed.countDocuments({ ward, status: 'occupied' });

    if (totalBeds === 0) return; // No beds in this ward

    const occupancyRate = (occupiedBeds / totalBeds) * 100;
    console.log(`📊 ${ward} occupancy: ${occupancyRate.toFixed(1)}% (${occupiedBeds}/${totalBeds})`);

    // Create alert if occupancy > 90%
    if (occupancyRate > 90) {
      // Check if alert already exists for this ward (to avoid duplicates)
      const existingAlert = await Alert.findOne({
        type: 'occupancy_high',
        message: { $regex: ward, $options: 'i' },
        read: false
      });

      if (!existingAlert) {
        const severity = occupancyRate >= 95 ? 'critical' : 'high';
        
        const alert = await Alert.create({
          type: 'occupancy_high',
          severity,
          message: `${ward} ward occupancy at ${occupancyRate.toFixed(1)}% (${occupiedBeds}/${totalBeds} beds occupied)`,
          ward,
          targetRole: ['manager', 'hospital_admin']
        });

        console.log(`🚨 Alert created: ${ward} occupancy high (${occupancyRate.toFixed(1)}%)`);

        // Emit real-time alert via Socket.io
        if (io) {
          io.emit('occupancyAlert', {
            alert: alert.toObject(),
            ward,
            occupancyRate: occupancyRate.toFixed(1),
            occupiedBeds,
            totalBeds,
            timestamp: new Date()
          });
          console.log('✅ occupancyAlert event emitted via socket.io');
        }
      } else {
        console.log(`ℹ️ Alert already exists for ${ward} ward high occupancy`);
      }
    }
  } catch (error) {
    console.error('Error checking occupancy and creating alerts:', error);
    // Don't throw - this is a background check, shouldn't break main operation
  }
};
