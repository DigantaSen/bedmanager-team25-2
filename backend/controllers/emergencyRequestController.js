// backend/controllers/emergencyRequestController.js
const EmergencyRequest = require('../models/EmergencyRequest');
const mongoose = require('mongoose');

/**
 * @desc    Create a new emergency request
 * @route   POST /api/emergency-requests
 * @access  Private
 */
exports.createEmergencyRequest = async (req, res) => {
  try {
    const { patientId, location, description } = req.body;

    // Validate required fields
    if (!patientId || !location) {
      return res.status(400).json({
        success: false,
        message: 'Please provide patientId and location'
      });
    }

    // Validate patientId format
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format'
      });
    }

    // Create emergency request
    const emergencyRequest = await EmergencyRequest.create({
      patientId,
      location,
      description: description || null
    });

    // Emit Socket.io event for real-time notification
    if (req.io) {
      req.io.emit('emergencyRequestCreated', {
        requestId: emergencyRequest._id,
        patientId: emergencyRequest.patientId,
        location: emergencyRequest.location,
        status: emergencyRequest.status,
        createdAt: emergencyRequest.createdAt
      });
      console.log('✅ Socket event emitted: emergencyRequestCreated');
    }

    res.status(201).json({
      success: true,
      message: 'Emergency request created successfully',
      data: { emergencyRequest }
    });
  } catch (error) {
    console.error('Create emergency request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating emergency request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get all emergency requests with optional filtering
 * @route   GET /api/emergency-requests
 * @access  Private
 * @query   status
 */
exports.getAllEmergencyRequests = async (req, res) => {
  try {
    const { status } = req.query;

    // Build filter object
    const filter = {};
    if (status) {
      // Validate status
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
      filter.status = status;
    }

    // Fetch emergency requests and populate patient details
    const emergencyRequests = await EmergencyRequest.find(filter)
      .populate('patientId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: emergencyRequests.length,
      data: { emergencyRequests }
    });
  } catch (error) {
    console.error('Get all emergency requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching emergency requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get single emergency request by ID
 * @route   GET /api/emergency-requests/:id
 * @access  Private
 */
exports.getEmergencyRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid emergency request ID format'
      });
    }

    // Fetch emergency request
    const emergencyRequest = await EmergencyRequest.findById(id)
      .populate('patientId', 'name email');

    if (!emergencyRequest) {
      return res.status(404).json({
        success: false,
        message: 'Emergency request not found'
      });
    }

    res.status(200).json({
      success: true,
      data: { emergencyRequest }
    });
  } catch (error) {
    console.error('Get emergency request by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching emergency request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update emergency request
 * @route   PUT /api/emergency-requests/:id
 * @access  Private
 */
exports.updateEmergencyRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, location, description } = req.body;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid emergency request ID format'
      });
    }

    // Validate status if provided
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: pending, approved, rejected'
      });
    }

    // Find existing emergency request
    const existingRequest = await EmergencyRequest.findById(id);
    if (!existingRequest) {
      return res.status(404).json({
        success: false,
        message: 'Emergency request not found'
      });
    }

    // Store old status for comparison
    const oldStatus = existingRequest.status;

    // Build update object
    const updateData = {};
    if (status) updateData.status = status;
    if (location) updateData.location = location;
    if (description !== undefined) updateData.description = description;

    // Update emergency request
    const updatedRequest = await EmergencyRequest.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('patientId', 'name email');

    // Emit Socket.io events based on status change
    if (req.io && status && oldStatus !== status) {
      if (status === 'approved') {
        req.io.emit('emergencyRequestApproved', {
          requestId: updatedRequest._id,
          patientId: updatedRequest.patientId,
          location: updatedRequest.location,
          status: updatedRequest.status,
          updatedAt: updatedRequest.updatedAt
        });
        console.log('✅ Socket event emitted: emergencyRequestApproved');
      } else if (status === 'rejected') {
        req.io.emit('emergencyRequestRejected', {
          requestId: updatedRequest._id,
          patientId: updatedRequest.patientId,
          location: updatedRequest.location,
          status: updatedRequest.status,
          updatedAt: updatedRequest.updatedAt
        });
        console.log('✅ Socket event emitted: emergencyRequestRejected');
      }
    }

    res.status(200).json({
      success: true,
      message: 'Emergency request updated successfully',
      data: { emergencyRequest: updatedRequest }
    });
  } catch (error) {
    console.error('Update emergency request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating emergency request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Delete emergency request
 * @route   DELETE /api/emergency-requests/:id
 * @access  Private
 */
exports.deleteEmergencyRequest = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid emergency request ID format'
      });
    }

    // Find and delete emergency request
    const emergencyRequest = await EmergencyRequest.findByIdAndDelete(id);

    if (!emergencyRequest) {
      return res.status(404).json({
        success: false,
        message: 'Emergency request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Emergency request deleted successfully',
      data: { emergencyRequest }
    });
  } catch (error) {
    console.error('Delete emergency request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting emergency request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
