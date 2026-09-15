// backend/routes/logRoutes.js
const express = require('express');
const router = express.Router();
const { getAllLogs, getBedLogs, getUserLogs } = require('../controllers/logsController');
const { protect, authorize } = require('../middleware/authMiddleware');

/**
 * @desc    Allow users to read their own activity, and managers/admins to read anyone's
 * @access  Private (requires protect middleware first)
 */
const canReadUserLogs = (req, res, next) => {
  const isSelf = req.user._id.equals(req.params.userId);
  if (isSelf || ['manager', 'hospital_admin'].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'You can only view your own activity log'
  });
};

// Occupancy logs show which staff moved which patient, so they need a login and a role
router.use(protect);

router.get('/', authorize('manager', 'hospital_admin'), getAllLogs);
router.get('/bed/:bedId', authorize('manager', 'hospital_admin'), getBedLogs);

// A user's own activity, or anyone's for managers and admins
router.get('/user/:userId', canReadUserLogs, getUserLogs);

module.exports = router;
