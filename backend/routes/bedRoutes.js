// backend/routes/bedRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllBeds,
  getBedById,
  updateBedStatus
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
router.get('/:id', protect, validateObjectId, getBedById);

// Protected write routes (requires JWT authentication + role-based guards)
router.patch('/:id/status', protect, canUpdateBedStatus, validateUpdateBedStatus, updateBedStatus);

module.exports = router;
