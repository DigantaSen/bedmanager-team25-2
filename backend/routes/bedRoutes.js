// backend/routes/bedRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllBeds,
  getBedById,
  updateBedStatus
} = require('../controllers/bedController');
const { protect, authorize } = require('../middleware/authMiddleware');
const {
  validateBedQuery,
  validateObjectId,
  validateUpdateBedStatus
} = require('../middleware/validators');

// Public routes
router.get('/', validateBedQuery, getAllBeds);
router.get('/:id', validateObjectId, getBedById);

// Protected routes (requires JWT authentication)
router.patch('/:id/status', protect, validateUpdateBedStatus, updateBedStatus);

module.exports = router;
