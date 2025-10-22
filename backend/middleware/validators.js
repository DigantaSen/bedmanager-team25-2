// backend/middleware/validators.js
// Reusable validation chains using express-validator

const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * @desc    Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  
  next();
};

/**
 * @desc    Validation rules for user registration
 */
const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .escape(),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('role')
    .optional()
    .isIn(['admin', 'doctor', 'nurse', 'patient', 'staff'])
    .withMessage('Role must be one of: admin, doctor, nurse, patient, staff'),
  
  handleValidationErrors
];

/**
 * @desc    Validation rules for user login
 */
const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

/**
 * @desc    Validation rules for creating a bed
 */
const validateCreateBed = [
  body('bedId')
    .trim()
    .notEmpty()
    .withMessage('Bed ID is required')
    .matches(/^[A-Z0-9-]+$/)
    .withMessage('Bed ID must contain only uppercase letters, numbers, and hyphens')
    .toUpperCase(),
  
  body('ward')
    .trim()
    .notEmpty()
    .withMessage('Ward is required')
    .isLength({ max: 100 })
    .withMessage('Ward name cannot exceed 100 characters')
    .escape(),
  
  body('status')
    .optional()
    .isIn(['available', 'occupied', 'maintenance', 'reserved'])
    .withMessage('Status must be one of: available, occupied, maintenance, reserved'),
  
  body('patientId')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid patient ID format');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * @desc    Validation rules for updating bed status
 */
const validateUpdateBedStatus = [
  param('id')
    .notEmpty()
    .withMessage('Bed ID is required'),
  
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['available', 'occupied', 'maintenance', 'reserved'])
    .withMessage('Status must be one of: available, occupied, maintenance, reserved'),
  
  body('patientId')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid patient ID format');
      }
      return true;
    })
    .custom((value, { req }) => {
      if (req.body.status === 'occupied' && !value) {
        throw new Error('Patient ID is required when status is occupied');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * @desc    Validation rules for query parameters (filtering beds)
 */
const validateBedQuery = [
  query('status')
    .optional()
    .isIn(['available', 'occupied', 'maintenance', 'reserved'])
    .withMessage('Status must be one of: available, occupied, maintenance, reserved'),
  
  query('ward')
    .optional()
    .trim()
    .escape(),
  
  handleValidationErrors
];

/**
 * @desc    Validation rules for MongoDB ObjectId params
 */
const validateObjectId = [
  param('id')
    .notEmpty()
    .withMessage('ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        // Also check if it could be a bedId (alphanumeric string)
        if (!/^[A-Z0-9-]+$/i.test(value)) {
          throw new Error('Invalid ID format');
        }
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * @desc    Validation rules for creating occupancy log
 */
const validateCreateOccupancyLog = [
  body('bedId')
    .notEmpty()
    .withMessage('Bed ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid bed ID format');
      }
      return true;
    }),
  
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid user ID format');
      }
      return true;
    }),
  
  body('statusChange')
    .notEmpty()
    .withMessage('Status change is required')
    .isIn([
      'assigned',
      'released',
      'maintenance_start',
      'maintenance_end',
      'reserved',
      'reservation_cancelled'
    ])
    .withMessage('Invalid status change value'),
  
  body('timestamp')
    .optional()
    .isISO8601()
    .withMessage('Invalid timestamp format')
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error('Timestamp cannot be in the future');
      }
      return true;
    }),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateCreateBed,
  validateUpdateBedStatus,
  validateBedQuery,
  validateObjectId,
  validateCreateOccupancyLog
};
