// backend/models/Bed.js
// Bed model for tracking hospital bed status and assignments

const mongoose = require('mongoose');

const bedSchema = new mongoose.Schema(
  {
    bedId: {
      type: String,
      required: [true, 'Bed ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      match: [
        /^[A-Z0-9-]+$/,
        'Bed ID must contain only uppercase letters, numbers, and hyphens'
      ]
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: ['available', 'occupied', 'maintenance', 'reserved'],
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
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      validate: {
        validator: async function(value) {
          if (!value) return true; // Allow null
          const User = mongoose.model('User');
          const user = await User.findById(value);
          return user && user.role === 'patient';
        },
        message: 'Patient ID must reference a valid user with role "patient"'
      }
    }
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    versionKey: false
  }
);

// Index for faster bedId lookups
bedSchema.index({ bedId: 1 });

// Index for ward-based queries
bedSchema.index({ ward: 1 });

// Index for status queries (find available beds)
bedSchema.index({ status: 1 });

// Compound index for ward + status queries
bedSchema.index({ ward: 1, status: 1 });

// Middleware to validate patientId only when status is 'occupied'
bedSchema.pre('save', function(next) {
  if (this.status === 'occupied' && !this.patientId) {
    return next(new Error('Patient ID is required when bed status is "occupied"'));
  }
  if (this.status !== 'occupied' && this.patientId) {
    this.patientId = null; // Clear patientId if bed is not occupied
  }
  next();
});

module.exports = mongoose.model('Bed', bedSchema);
