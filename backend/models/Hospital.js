// backend/models/Hospital.js
// Nearby hospital directory for referrals. Entries and bed counts are maintained by hospital admins.

const mongoose = require('mongoose');

const WARD_TYPES = ['ICU', 'Emergency', 'General', 'Pediatrics'];
const PHONE_PATTERN = /^[\d\s\-+()]+$/;

const wardBedSchema = new mongoose.Schema({
  wardType: {
    type: String,
    required: true,
    enum: WARD_TYPES
  },
  totalBeds: {
    type: Number,
    required: true,
    min: 0
  },
  availableBeds: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(value) {
        return value <= this.totalBeds;
      },
      message: 'Available beds cannot exceed total beds'
    }
  }
}, { _id: false });

const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Hospital name is required'],
      trim: true,
      maxlength: [200, 'Hospital name cannot exceed 200 characters']
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      maxlength: [500, 'Address cannot exceed 500 characters']
    },
    // Optional coordinates for the map link
    location: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
        default: null
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
        default: null
      }
    },
    distance: {
      type: Number,
      required: [true, 'Distance is required'],
      min: 0
      // Distance in kilometers from this hospital, entered by the admin
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
      match: [PHONE_PATTERN, 'Please provide a valid contact number']
    },
    emergencyContact: {
      type: String,
      trim: true,
      default: null,
      match: [PHONE_PATTERN, 'Please provide a valid emergency contact']
    },
    wards: {
      type: [wardBedSchema],
      validate: [
        {
          validator: (wards) => Array.isArray(wards) && wards.length > 0,
          message: 'Hospital must have at least one ward'
        },
        {
          validator: (wards) => new Set(wards.map((ward) => ward.wardType)).size === wards.length,
          message: 'Each ward type can only be listed once'
        }
      ]
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // When the bed counts were last updated, and by which admin
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Index for distance-based queries
hospitalSchema.index({ distance: 1 });

const Hospital = mongoose.model('Hospital', hospitalSchema);

module.exports = Hospital;
module.exports.WARD_TYPES = WARD_TYPES;
