// backend/models/EmergencyRequest.js
// EmergencyRequest model for managing emergency admission requests

const mongoose = require('mongoose');

const emergencyRequestSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required']
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true
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

// Index for faster queries by patientId
emergencyRequestSchema.index({ patientId: 1 });

// Compound index for status + createdAt queries
emergencyRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('EmergencyRequest', emergencyRequestSchema);
