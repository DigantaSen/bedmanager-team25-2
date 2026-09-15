// backend/middleware/validators.js
// Reusable validation chains using express-validator

const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { ROLES, SELF_SIGNUP_ROLES, WARDS } = require('../config/roles');
const { MIN_PASSWORD_LENGTH } = require('../config/passwordPolicy');
const { WARD_TYPES: HOSPITAL_WARD_TYPES } = require('../models/Hospital');

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

    console.log('❌ Validation errors:', errorMessages);

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
    .isLength({ min: MIN_PASSWORD_LENGTH })
    .withMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`),
  
  body('role')
    .optional()
    .isIn(SELF_SIGNUP_ROLES)
    .withMessage(`Role must be one of: ${SELF_SIGNUP_ROLES.join(', ')}`),

  body('ward')
    .optional()
    .isIn(WARDS)
    .withMessage(`Ward must be one of: ${WARDS.join(', ')}`),

  handleValidationErrors
];

/**
 * @desc    Validation rules for approving a user account (the reviewer may adjust role/ward;
 *          technical team and admin roles are only given from the command line)
 */
const validateApproveUser = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID format'),

  body('role')
    .optional()
    .isIn(SELF_SIGNUP_ROLES)
    .withMessage(`Role must be one of: ${SELF_SIGNUP_ROLES.join(', ')}`),

  body('ward')
    .optional()
    .isIn(WARDS)
    .withMessage(`Ward must be one of: ${WARDS.join(', ')}`),

  handleValidationErrors
];

/**
 * @desc    Validation rules for routes that take a user ID param
 */
const validateUserIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID format'),

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
// Bed ID and ward rules shared by adding and editing beds
const bedIdRule = (chain) => chain
  .trim()
  .notEmpty()
  .withMessage('Bed ID is required')
  .isLength({ max: 20 })
  .withMessage('Bed ID cannot exceed 20 characters')
  .matches(/^[A-Za-z0-9-]+$/)
  .withMessage('Bed ID must contain only letters, numbers, and hyphens');

const bedWardRule = (chain) => chain
  .isIn(WARDS)
  .withMessage(`Ward must be one of: ${WARDS.join(', ')}`);

const validateCreateBed = [
  bedIdRule(body('bedId')),
  bedWardRule(body('ward')),
  handleValidationErrors
];

/**
 * @desc    Validation rules for changing a bed's ID or ward
 */
const validateUpdateBedDetails = [
  bedIdRule(body('bedId').optional()),
  bedWardRule(body('ward').optional()),
  body()
    .custom((value) => {
      if (value?.bedId === undefined && value?.ward === undefined) {
        throw new Error('Provide a new bedId or ward');
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
    .isIn(['available', 'cleaning', 'occupied'])
    .withMessage('Status must be one of: available, cleaning, occupied'),
  
  body('patientName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Patient name cannot exceed 100 characters'),
  
  body('patientId')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Patient ID cannot exceed 50 characters')
    .custom((value, { req }) => {
      // When status is occupied, either patientName or patientId must be provided
      if (req.body.status === 'occupied' && !value && !req.body.patientName) {
        throw new Error('Patient name or ID is required when status is occupied');
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
    .isIn(['available', 'cleaning', 'occupied'])
    .withMessage('Status must be one of: available, cleaning, occupied'),
  
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

const PHONE_PATTERN = /^[\d\s\-+()]+$/;

/**
 * @desc    Validation rules for nearby hospital directory details
 * @param   optionalFields - updates may send any subset of the fields
 */
const hospitalDetailRules = (optionalFields) => {
  const field = (name) => (optionalFields ? body(name).optional() : body(name));

  return [
    field('name')
      .trim()
      .notEmpty()
      .withMessage('Hospital name is required')
      .isLength({ max: 200 })
      .withMessage('Hospital name cannot exceed 200 characters'),

    field('address')
      .trim()
      .notEmpty()
      .withMessage('Address is required')
      .isLength({ max: 500 })
      .withMessage('Address cannot exceed 500 characters'),

    field('distance')
      .isFloat({ min: 0 })
      .withMessage('Distance must be a number of kilometres (0 or more)')
      .toFloat(),

    field('contactNumber')
      .trim()
      .notEmpty()
      .withMessage('Contact number is required')
      .matches(PHONE_PATTERN)
      .withMessage('Please provide a valid contact number'),

    body('emergencyContact')
      .optional({ values: 'falsy' })
      .trim()
      .matches(PHONE_PATTERN)
      .withMessage('Please provide a valid emergency contact'),

    body('location.latitude')
      .optional({ values: 'falsy' })
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90')
      .toFloat(),

    body('location.longitude')
      .optional({ values: 'falsy' })
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180')
      .toFloat(),

    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be true or false')
      .toBoolean()
  ];
};

/**
 * @desc    Validation rules for a hospital's ward bed counts
 */
const hospitalWardRules = [
  body('wards')
    .isArray({ min: 1 })
    .withMessage('Add at least one ward'),

  body('wards.*.wardType')
    .isIn(HOSPITAL_WARD_TYPES)
    .withMessage(`Ward type must be one of: ${HOSPITAL_WARD_TYPES.join(', ')}`),

  body('wards.*.totalBeds')
    .isInt({ min: 0 })
    .withMessage('Total beds must be a whole number (0 or more)')
    .toInt(),

  body('wards.*.availableBeds')
    .isInt({ min: 0 })
    .withMessage('Available beds must be a whole number (0 or more)')
    .toInt(),

  body('wards')
    .custom((wards) => {
      if (!Array.isArray(wards)) return true; // reported by the isArray rule
      const wardTypes = wards.map((ward) => ward.wardType);
      if (new Set(wardTypes).size !== wardTypes.length) {
        throw new Error('Each ward type can only be listed once');
      }
      if (wards.some((ward) => Number(ward.availableBeds) > Number(ward.totalBeds))) {
        throw new Error('Available beds cannot exceed total beds');
      }
      return true;
    })
];

/**
 * @desc    Validation rules for adding a hospital to the directory
 */
const validateCreateHospital = [
  ...hospitalDetailRules(false),
  ...hospitalWardRules,
  handleValidationErrors
];

/**
 * @desc    Validation rules for updating hospital details (bed counts have their own route)
 */
const validateUpdateHospital = [
  ...hospitalDetailRules(true),
  body('wards')
    .not()
    .exists()
    .withMessage('Update bed counts with PUT /api/referrals/hospitals/:id/beds'),
  handleValidationErrors
];

/**
 * @desc    Validation rules for updating a hospital's bed counts
 */
const validateHospitalBeds = [
  ...hospitalWardRules,
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateApproveUser,
  validateUserIdParam,
  validateCreateBed,
  validateUpdateBedDetails,
  validateUpdateBedStatus,
  validateBedQuery,
  validateObjectId,
  validateCreateOccupancyLog,
  validateCreateHospital,
  validateUpdateHospital,
  validateHospitalBeds
};
