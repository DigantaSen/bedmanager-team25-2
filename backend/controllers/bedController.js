// backend/controllers/bedController.js
const Bed = require('../models/Bed');
const OccupancyLog = require('../models/OccupancyLog');
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

    // Fetch beds with optional population
    const beds = await Bed.find(filter)
      .populate('patientId', 'name email')
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
      bed = await Bed.findById(id).populate('patientId', 'name email role');
    } else {
      // Try to find by bedId (e.g., "BED-101")
      bed = await Bed.findOne({ bedId: id.toUpperCase() })
        .populate('patientId', 'name email role');
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
 * @body    status, patientId (optional)
 */
exports.updateBedStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, patientId } = req.body;

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
      bed = await Bed.findOne({ bedId: id.toUpperCase() });
    }

    if (!bed) {
      return res.status(404).json({
        success: false,
        message: 'Bed not found'
      });
    }

    // Validate status change logic
    if (status === 'occupied' && !patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required when marking bed as occupied'
      });
    }

    // Validate patientId if provided
    if (patientId) {
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid patient ID format'
        });
      }

      const User = mongoose.model('User');
      const patient = await User.findById(patientId);
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      if (patient.role !== 'patient') {
        return res.status(400).json({
          success: false,
          message: 'User must have role "patient" to be assigned to a bed'
        });
      }
    }

    // Store previous status for logging
    const previousStatus = bed.status;

    // Update bed
    bed.status = status;
    bed.patientId = status === 'occupied' ? patientId : null;
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

    // Populate patient details
    await bed.populate('patientId', 'name email');

    // Emit bedUpdate event via socket.io
    if (req.io) {
      req.io.emit('bedUpdate', {
        bed: bed.toObject(),
        previousStatus,
        timestamp: new Date()
      });
      console.log('✅ bedUpdate event emitted via socket.io');
    }

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
