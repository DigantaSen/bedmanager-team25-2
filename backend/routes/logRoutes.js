// backend/routes/logRoutes.js
const express = require('express');
const router = express.Router();
const { getAllLogs, getBedLogs, getUserLogs } = require('../controllers/logsController');
const { protect } = require('../middleware/authMiddleware');

// Public routes (can be changed to protected if needed)
router.get('/', getAllLogs);
router.get('/bed/:bedId', getBedLogs);

// Protected routes
router.get('/user/:userId', protect, getUserLogs);

module.exports = router;
