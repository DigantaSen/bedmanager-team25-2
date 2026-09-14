// backend/models/User.js
// User model for bed manager system (doctors, nurses, admins, patients)

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/roles');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false // Don't return password by default
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ROLES,
        message: '{VALUE} is not a valid role'
      },
      default: 'ward_staff'
    },
    ward: {
      type: String,
      trim: true,
      maxlength: [100, 'Ward name cannot exceed 100 characters'],
      // Required for ward_staff and manager roles
      validate: {
        validator: function(value) {
          // If role is ward_staff or manager, ward is required
          if ((this.role === 'ward_staff' || this.role === 'manager') && !value) {
            return false;
          }
          return true;
        },
        message: 'Ward is required for ward_staff and manager roles'
      }
    },
    assignedWards: {
      type: [String],
      default: [],
      validate: {
        validator: function(value) {
          // Ensure all ward names are within length limits
          return value.every(ward => ward.length <= 100);
        },
        message: 'Each ward name cannot exceed 100 characters'
      }
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, 'Department name cannot exceed 100 characters']
    },
    profilePicture: {
      type: String,
      default: null
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[\d\s\-()]+$/, 'Please provide a valid phone number']
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, 'Address cannot exceed 500 characters']
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function(value) {
          return !value || value < new Date();
        },
        message: 'Date of birth must be in the past'
      }
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [1000, 'Bio cannot exceed 1000 characters']
    },
    // Account approval workflow: self-registered users start as pending
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected'],
        message: '{VALUE} is not a valid account status'
      },
      default: 'pending'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    versionKey: false
  }
);

// Index for role-based queries
userSchema.index({ role: 1 });

// Index for ward-based queries
userSchema.index({ ward: 1 });

// Index for department-based queries
userSchema.index({ department: 1 });

// Index for approval queue queries
userSchema.index({ status: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash if password is modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Accounts created before the approval workflow have no status - keep them active
userSchema.statics.approveLegacyAccounts = async function () {
  const result = await this.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'approved' } }
  );
  if (result.modifiedCount > 0) {
    console.log(`✅ Marked ${result.modifiedCount} existing user(s) as approved`);
  }
};

module.exports = mongoose.model('User', userSchema);
