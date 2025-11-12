// backend/models/CleaningLog.js
// Model for tracking bed cleaning history and performance analytics

const mongoose = require('mongoose');

const cleaningLogSchema = new mongoose.Schema(
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
    ward: {
      type: String,
      required: [true, 'Ward is required'],
      trim: true
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
      default: Date.now
    },
    endTime: {
      type: Date,
      default: null
    },
    estimatedDuration: {
      type: Number, // Duration in minutes
      required: [true, 'Estimated duration is required'],
      min: [0, 'Estimated duration cannot be negative']
    },
    actualDuration: {
      type: Number, // Actual duration in minutes (calculated when completed)
      default: null,
      min: [0, 'Actual duration cannot be negative']
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: ['in_progress', 'completed', 'overdue'],
        message: '{VALUE} is not a valid cleaning status'
      },
      default: 'in_progress'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    notes: {
      type: String,
      default: null,
      maxlength: [500, 'Notes cannot exceed 500 characters']
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Indexes for performance
cleaningLogSchema.index({ bedId: 1, startTime: -1 });
cleaningLogSchema.index({ status: 1 });
cleaningLogSchema.index({ ward: 1, startTime: -1 });
cleaningLogSchema.index({ startTime: -1 });

// Virtual for progress percentage
cleaningLogSchema.virtual('progressPercentage').get(function() {
  if (this.status === 'completed') return 100;
  if (!this.startTime || !this.estimatedDuration) return 0;
  
  const now = new Date();
  const elapsedMs = now - this.startTime;
  const elapsedMinutes = elapsedMs / (1000 * 60);
  const progress = Math.min((elapsedMinutes / this.estimatedDuration) * 100, 100);
  
  return Math.round(progress);
});

// Virtual for time remaining
cleaningLogSchema.virtual('timeRemaining').get(function() {
  if (this.status === 'completed') return 0;
  if (!this.startTime || !this.estimatedDuration) return null;
  
  const now = new Date();
  const elapsedMs = now - this.startTime;
  const elapsedMinutes = elapsedMs / (1000 * 60);
  const remaining = this.estimatedDuration - elapsedMinutes;
  
  return Math.max(Math.round(remaining), 0);
});

// Virtual for is overdue
cleaningLogSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed') return false;
  if (!this.startTime || !this.estimatedDuration) return false;
  
  const now = new Date();
  const elapsedMs = now - this.startTime;
  const elapsedMinutes = elapsedMs / (1000 * 60);
  
  return elapsedMinutes > this.estimatedDuration;
});

// Middleware to calculate actual duration when status changes to completed
cleaningLogSchema.pre('save', function(next) {
  if (this.status === 'completed' && this.endTime && this.startTime && !this.actualDuration) {
    const durationMs = this.endTime - this.startTime;
    this.actualDuration = Math.round(durationMs / (1000 * 60)); // Convert to minutes
  }
  
  // Auto-update status to overdue if past estimated time
  if (this.status === 'in_progress' && this.isOverdue) {
    this.status = 'overdue';
  }
  
  next();
});

// Ensure virtuals are included in JSON output
cleaningLogSchema.set('toJSON', { virtuals: true });
cleaningLogSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('CleaningLog', cleaningLogSchema);
