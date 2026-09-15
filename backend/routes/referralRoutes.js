// backend/routes/referralRoutes.js
// Routes for hospital referrals and the nearby hospital directory

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  validateObjectId,
  validateCreateHospital,
  validateUpdateHospital,
  validateHospitalBeds
} = require('../middleware/validators');
const {
  getNearbyHospitals,
  getHospitalById,
  getAvailableCapacity,
  getReferralRecommendations,
  listHospitals,
  createHospital,
  updateHospital,
  updateHospitalBeds,
  deleteHospital
} = require('../controllers/hospitalReferralController');

// All routes require authentication
router.use(protect);

// Referral lookups: managers and hospital admins
const canUseReferrals = authorize('manager', 'hospital_admin');
// Directory management: technical team
const canManageDirectory = authorize('technical_team');

// @route   GET /api/referrals/nearby-hospitals
// @desc    Get active hospitals, nearest first, with filtering options
// @query   ward, maxDistance, minAvailableBeds
router.get('/nearby-hospitals', canUseReferrals, getNearbyHospitals);

// @route   GET /api/referrals/available-capacity
// @desc    Get hospitals with available capacity for specific ward
// @query   ward (required)
router.get('/available-capacity', canUseReferrals, getAvailableCapacity);

// @route   GET /api/referrals/recommendations
// @desc    Get referral recommendations based on urgency
// @query   ward (required), urgency (optional: high/medium/low)
router.get('/recommendations', canUseReferrals, getReferralRecommendations);

// @route   GET /api/referrals/hospitals/:id
// @desc    Get specific hospital details by ID
router.get('/hospitals/:id', authorize('manager', 'hospital_admin', 'technical_team'), validateObjectId, getHospitalById);

// ----- Directory management (technical team) -----

// @route   GET /api/referrals/hospitals
// @desc    List every hospital in the directory, including inactive ones
router.get('/hospitals', canManageDirectory, listHospitals);

// @route   POST /api/referrals/hospitals
// @desc    Add a hospital with its wards and current bed counts
router.post('/hospitals', canManageDirectory, validateCreateHospital, createHospital);

// @route   PUT /api/referrals/hospitals/:id
// @desc    Update name, address, distance, contacts, location or active status
router.put('/hospitals/:id', canManageDirectory, validateObjectId, validateUpdateHospital, updateHospital);

// @route   PUT /api/referrals/hospitals/:id/beds
// @desc    Replace ward bed counts (records when and by whom they were updated)
router.put('/hospitals/:id/beds', canManageDirectory, validateObjectId, validateHospitalBeds, updateHospitalBeds);

// @route   DELETE /api/referrals/hospitals/:id
// @desc    Remove a hospital from the directory
router.delete('/hospitals/:id', canManageDirectory, validateObjectId, deleteHospital);

module.exports = router;
