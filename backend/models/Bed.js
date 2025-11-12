// backend/models/Bed.js
// Bed model for tracking hospital bed status and assignments

const mongoose = require('mongoose');

const bedSchema = new mongoose.Schema(
  {
    bedId: {
      type: String,
      required: [true, 'Bed ID is required'],
      trim: true,
      match: [
        /^[A-Za-z0-9-]+$/,
        'Bed ID must contain only letters, numbers, and hyphens'
      ]
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: ['available', 'cleaning', 'occupied'],
        message: '{VALUE} is not a valid bed status'
      },
      default: 'available'
    },
    ward: {
      type: String,
      required: [true, 'Ward is required'],
      trim: true,
      maxlength: [100, 'Ward name cannot exceed 100 characters']
    },
    patientName: {
      type: String,
      default: null,
      trim: true,
      maxlength: [100, 'Patient name cannot exceed 100 characters']
    },
    patientId: {
      type: String,
      default: null,
      trim: true,
      maxlength: [50, 'Patient ID cannot exceed 50 characters']
    },
    // Task 2.5b: Cleaning/Maintenance tracking fields
    cleaningStartTime: {
      type: Date,
      default: null
    },
    estimatedCleaningDuration: {
      type: Number, // Duration in minutes
      default: null,
      min: [0, 'Estimated cleaning duration cannot be negative']
    },
    estimatedCleaningEndTime: {
      type: Date,
      default: null
    },
    // Task 2.5c: Notes field for additional information
    notes: {
      type: String,
      default: null,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    }
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    versionKey: false
  }
);

// Index for faster bedId lookups (unique)
bedSchema.index({ bedId: 1 }, { unique: true });

// Index for ward-based queries
bedSchema.index({ ward: 1 });

// Index for status queries (find available beds)
bedSchema.index({ status: 1 });

// Compound index for ward + status queries
bedSchema.index({ ward: 1, status: 1 });

// Middleware to validate patient info when status is 'occupied'
bedSchema.pre('save', function(next) {
  if (this.status === 'occupied' && !this.patientName && !this.patientId) {
    return next(new Error('Patient name or ID is required when bed status is "occupied"'));
  }
  if (this.status !== 'occupied') {
    this.patientName = null;
    this.patientId = null; // Clear patient info if bed is not occupied
  }
  
  // Task 2.5b: Clear cleaning fields if not in maintenance
  if (this.status !== 'maintenance') {
    this.cleaningStartTime = null;
    this.estimatedCleaningDuration = null;
    this.estimatedCleaningEndTime = null;
  }
  
  next();
});

module.exports = mongoose.model('Bed', bedSchema);
