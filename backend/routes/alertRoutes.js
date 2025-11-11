// backend/routes/alertRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAlerts,
  dismissAlert
} = require('../controllers/alertController');
const { protect } = require('../middleware/authMiddleware');

// GET /api/alerts - Get all alerts for authenticated user's role
router.get('/', protect, getAlerts);

// PATCH /api/alerts/:id/dismiss - Dismiss (mark as read) an alert
router.patch('/:id/dismiss', protect, dismissAlert);

module.exports = router;
