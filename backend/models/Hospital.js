// backend/models/Hospital.js
// Hospital model for nearby hospitals referral system

const mongoose = require('mongoose');

const wardBedSchema = new mongoose.Schema({
  wardType: {
    type: String,
    required: true,
    enum: ['ICU', 'Emergency', 'General', 'Pediatrics']
  },
  totalBeds: {
    type: Number,
    required: true,
    min: 0
  },
  availableBeds: {
    type: Number,
    required: true,
    min: 0
  },
  occupiedBeds: {
    type: Number,
    required: true,
    min: 0
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
    location: {
      latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180
      }
    },
    distance: {
      type: Number,
      required: true,
      min: 0,
      // Distance in kilometers from the main hospital
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact number is required'],
      trim: true,
      match: [/^[\d\s\-\+\(\)]+$/, 'Please provide a valid contact number']
    },
    emergencyContact: {
      type: String,
      required: [true, 'Emergency contact is required'],
      trim: true,
      match: [/^[\d\s\-\+\(\)]+$/, 'Please provide a valid emergency contact']
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      default: 4
    },
    wards: {
      type: [wardBedSchema],
      required: true,
      validate: {
        validator: function(wards) {
          return wards && wards.length > 0;
        },
        message: 'Hospital must have at least one ward'
      }
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Index for geospatial queries
hospitalSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

// Index for distance-based queries
hospitalSchema.index({ distance: 1 });

// Method to update bed availability for a specific ward
hospitalSchema.methods.updateWardBeds = function(wardType, availableBeds, occupiedBeds) {
  const ward = this.wards.find(w => w.wardType === wardType);
  if (ward) {
    ward.availableBeds = availableBeds;
    ward.occupiedBeds = occupiedBeds;
    ward.totalBeds = availableBeds + occupiedBeds;
    this.lastUpdated = Date.now();
  }
  return this;
};

// Static method to get hospitals with available capacity
hospitalSchema.statics.getHospitalsWithCapacity = async function(wardType, minBeds = 1) {
  return this.find({
    isActive: true,
    'wards.wardType': wardType,
    'wards.availableBeds': { $gte: minBeds }
  }).sort({ distance: 1 });
};

// Static method to get nearby hospitals within distance
hospitalSchema.statics.getNearbyHospitals = async function(maxDistance, filters = {}) {
  const query = {
    isActive: true,
    distance: { $lte: maxDistance }
  };

  if (filters.wardType) {
    query['wards.wardType'] = filters.wardType;
  }

  if (filters.minAvailableBeds) {
    query['wards.availableBeds'] = { $gte: filters.minAvailableBeds };
  }

  return this.find(query).sort({ distance: 1 });
};

const Hospital = mongoose.model('Hospital', hospitalSchema);

module.exports = Hospital;
