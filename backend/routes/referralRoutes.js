// backend/routes/referralRoutes.js
// Routes for hospital referral system

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  getNearbyHospitals,
  getHospitalById,
  getAvailableCapacity,
  getReferralRecommendations
} = require('../controllers/hospitalReferralController');

// All routes require authentication and manager/admin role
router.use(protect);
router.use(authorize('manager', 'hospital_admin'));

// @route   GET /api/referrals/nearby-hospitals
// @desc    Get list of nearby hospitals with filtering options
// @query   ward, maxDistance, minAvailableBeds
router.get('/nearby-hospitals', getNearbyHospitals);

// @route   GET /api/referrals/hospitals/:id
// @desc    Get specific hospital details by ID
router.get('/hospitals/:id', getHospitalById);

// @route   GET /api/referrals/available-capacity
// @desc    Get hospitals with available capacity for specific ward
// @query   ward (required)
router.get('/available-capacity', getAvailableCapacity);

// @route   GET /api/referrals/recommendations
// @desc    Get referral recommendations based on urgency
// @query   ward (required), urgency (optional: high/medium/low)
router.get('/recommendations', getReferralRecommendations);

module.exports = router;
