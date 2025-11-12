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
  markCleaningComplete
} = require('../controllers/bedController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { canReadBeds, canUpdateBedStatus } = require('../middleware/roleGuards');
const {
  validateBedQuery,
  validateObjectId,
  validateUpdateBedStatus
} = require('../middleware/validators');

// Protected read routes (requires JWT authentication + role-based filtering)
router.get('/', protect, canReadBeds, validateBedQuery, getAllBeds);
router.get('/occupied', protect, getOccupiedBeds); // Task 2.5: Get all occupied beds
router.get('/cleaning-queue', protect, authorize('manager', 'hospital_admin'), getCleaningQueue); // Task 2.5b: Get cleaning queue
router.get('/:id', protect, validateObjectId, getBedById);
router.get('/:id/occupant-history', protect, getOccupantHistory); // Task 2.5: Get bed occupancy history

// Protected write routes (requires JWT authentication + role-based guards)
router.patch('/:id/status', protect, canUpdateBedStatus, validateUpdateBedStatus, updateBedStatus);
router.put('/:id/cleaning/mark-complete', protect, authorize('manager', 'hospital_admin'), markCleaningComplete); // Task 2.5b: Mark cleaning complete

module.exports = router;

