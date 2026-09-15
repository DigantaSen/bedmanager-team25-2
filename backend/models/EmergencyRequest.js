// backend/models/EmergencyRequest.js
// EmergencyRequest model for managing emergency admission requests

const mongoose = require('mongoose');

const emergencyRequestSchema = new mongoose.Schema(
  {
    patientName: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true
    },
    patientContact: {
      type: String,
      trim: true,
      default: null
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null // Generated later if needed
    },
    // The staff member who raised the request. ER staff may only see their own requests,
    // so this is set from the logged-in user and never from the request body.
    // Not required, so requests created before this field existed can still be approved.
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true
    },
    ward: {
      type: String,
      enum: {
        values: ['ICU', 'General', 'Emergency'],
        message: '{VALUE} is not a valid ward'
      },
      required: [true, 'Ward is required']
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: '{VALUE} is not a valid priority'
      },
      default: 'medium'
    },
    reason: {
      type: String,
      trim: true,
      default: null
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected'],
        message: '{VALUE} is not a valid status'
      },
      default: 'pending'
    },
    description: {
      type: String,
      trim: true,
      default: null
    }
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    versionKey: false
  }
);

// Index for faster queries by status
emergencyRequestSchema.index({ status: 1 });

// Index for faster queries by patientId (when it exists)
emergencyRequestSchema.index({ patientId: 1 });

// Index for searching by patient name
emergencyRequestSchema.index({ patientName: 1 });

// Index for the list ER staff see: their own requests, newest first
emergencyRequestSchema.index({ requestedBy: 1, createdAt: -1 });

// Compound index for status + createdAt queries
emergencyRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('EmergencyRequest', emergencyRequestSchema);
