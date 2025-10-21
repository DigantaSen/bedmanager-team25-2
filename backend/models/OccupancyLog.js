// backend/models/OccupancyLog.js
// Log model for tracking bed occupancy history and status changes

const mongoose = require('mongoose');

const occupancyLogSchema = new mongoose.Schema(
  {
    bedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bed',
      required: [true, 'Bed ID is required'],
      validate: {
        validator: async function(value) {
          const Bed = mongoose.model('Bed');
          const bed = await Bed.findById(value);
          return !!bed;
        },
        message: 'Bed ID must reference a valid bed'
      }
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      validate: {
        validator: async function(value) {
          const User = mongoose.model('User');
          const user = await User.findById(value);
          return !!user;
        },
        message: 'User ID must reference a valid user'
      }
    },
    timestamp: {
      type: Date,
      required: [true, 'Timestamp is required'],
      default: Date.now,
      validate: {
        validator: function(value) {
          return value <= new Date();
        },
        message: 'Timestamp cannot be in the future'
      }
    },
    statusChange: {
      type: String,
      required: [true, 'Status change is required'],
      enum: {
        values: [
          'assigned',
          'released',
          'maintenance_start',
          'maintenance_end',
          'reserved',
          'reservation_cancelled'
        ],
        message: '{VALUE} is not a valid status change'
      }
    }
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    versionKey: false
  }
);

// Index for bedId-based queries (get history for a specific bed)
occupancyLogSchema.index({ bedId: 1 });

// Index for userId-based queries (get logs for a specific user)
occupancyLogSchema.index({ userId: 1 });

// Index for timestamp-based queries (chronological sorting)
occupancyLogSchema.index({ timestamp: -1 });

// Compound index for bed history with time range
occupancyLogSchema.index({ bedId: 1, timestamp: -1 });

// Compound index for user activity with time range
occupancyLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('OccupancyLog', occupancyLogSchema);
