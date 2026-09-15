// backend/routes/bedRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllBeds,
  getBedById,
  updateBedStatus,
  getOccupiedBeds,
  getOccupantHistory,
  getCleaningQueue,
  markCleaningComplete,
  updateDischargeTime,
  predictDischarge,
  predictCleaningDuration,
  createBed,
  updateBedDetails,
  retireBed,
  reactivateBed
} = require('../controllers/bedController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { canReadBeds, canUpdateBedStatus } = require('../middleware/roleGuards');
const {
  validateBedQuery,
  validateObjectId,
  validateCreateBed,
  validateUpdateBedDetails,
  validateUpdateBedStatus
} = require('../middleware/validators');

// Single-bed handlers also check the user's ward when the bed is loaded (services/bedAccess)

// Protected read routes (requires JWT authentication + role-based filtering)
router.get('/', protect, canReadBeds, validateBedQuery, getAllBeds);
router.get('/occupied', protect, authorize('manager', 'hospital_admin'), getOccupiedBeds); // Task 2.5: Get all occupied beds
router.get('/cleaning-queue', protect, authorize('manager', 'hospital_admin', 'ward_staff'), getCleaningQueue); // Task 2.5b: Get cleaning queue
router.get('/:id', protect, validateObjectId, getBedById);
router.get('/:id/occupant-history', protect, authorize('manager', 'hospital_admin'), validateObjectId, getOccupantHistory); // Task 2.5: Get bed occupancy history

// Protected write routes (requires JWT authentication + role-based guards)
router.patch('/:id/status', protect, canUpdateBedStatus, validateUpdateBedStatus, updateBedStatus);
router.put('/:id/cleaning/mark-complete', protect, authorize('manager', 'hospital_admin', 'ward_staff'), markCleaningComplete); // Task 2.5b: Mark cleaning complete - ward staff can mark beds as clean
router.patch('/:id/discharge-time', protect, authorize('manager', 'hospital_admin'), updateDischargeTime); // Update estimated discharge time

// ML-powered prediction routes
router.post('/:id/predict-discharge', protect, authorize('manager', 'hospital_admin', 'ward_staff'), predictDischarge); // ML: Predict discharge time
router.post('/:id/predict-cleaning', protect, authorize('manager', 'hospital_admin', 'ward_staff'), predictCleaningDuration); // ML: Predict cleaning duration

// Bed inventory (technical team; no patient data)
router.post('/', protect, authorize('technical_team'), validateCreateBed, createBed); // Add a bed
router.patch('/:id', protect, authorize('technical_team'), validateObjectId, validateUpdateBedDetails, updateBedDetails); // Change bed ID or ward
router.patch('/:id/retire', protect, authorize('technical_team'), validateObjectId, retireBed); // Take a bed out of service
router.patch('/:id/reactivate', protect, authorize('technical_team'), validateObjectId, reactivateBed); // Put a retired bed back into service

module.exports = router;
