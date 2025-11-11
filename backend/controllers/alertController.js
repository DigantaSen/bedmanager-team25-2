// backend/controllers/alertController.js
const Alert = require('../models/Alert');
const mongoose = require('mongoose');

/**
 * @desc    Get all alerts for the authenticated user's role
 * @route   GET /api/alerts
 * @access  Private
 */
exports.getAlerts = async (req, res) => {
  try {
    const role = req.user.role;

    // Fetch alerts filtered by user's role
    const alerts = await Alert.find({ targetRole: role })
      .populate('relatedBed', 'bedId ward status')
      .populate('relatedRequest', 'patientId location status')
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      count: alerts.length,
      data: { alerts }
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching alerts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Dismiss alert (mark as read)
 * @route   PATCH /api/alerts/:id/dismiss
 * @access  Private
 */
exports.dismissAlert = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid alert ID format'
      });
    }

    // Find and update alert
    const alert = await Alert.findByIdAndUpdate(
      id,
      { read: true },
      { new: true, runValidators: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Alert dismissed successfully',
      data: { alert }
    });
  } catch (error) {
    console.error('Dismiss alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error dismissing alert',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
