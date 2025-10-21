// backend/routes/bedRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllBeds,
  getBedById,
  updateBedStatus
} = require('../controllers/bedController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getAllBeds);
router.get('/:id', getBedById);

// Protected routes (requires JWT authentication)
router.patch('/:id/status', protect, updateBedStatus);

module.exports = router;
